// Offline fresh-database replay of the actual repository migrations. Every
// profile owns a new in-memory PostgreSQL/WASM instance; no remote DB URL exists.
// Install PGlite under /tmp and pass its entry module via PGLITE_MODULE.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const { PGlite }=await import(process.env.PGLITE_MODULE);
const migrationDirectory=new URL('../supabase/migrations/',import.meta.url);
const migrations=(await readdir(migrationDirectory)).filter(n=>n.endsWith('.sql')).sort();
const profiles=['legacy-auto-grants','explicit-fresh','explicit-reset-replay'];
const tables=['black_betty_user_access','black_betty_planning_snapshot','black_betty_physical_snapshot','black_betty_promotion_intelligence'];
let checks=0,failures=0;
for(const profile of profiles){
 const db=new PGlite();
 const scalar=async sql=>(await db.query(sql)).rows[0].value;
 async function yes(sql,message){assert.equal(await scalar(sql),true,`${profile}: ${message}`);checks++;}
 async function denied(sql){await assert.rejects(()=>db.exec(sql),e=>e.code==='42501');checks++;}
 const actor=async(user)=>{await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='00000000-0000-4000-8000-${user}'; set request.jwt.claims='{}';`);};
 try{
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key,email text,created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000001','buyer@example.test'),('00000000-0000-4000-8000-000000000002','admin@example.test'),('00000000-0000-4000-8000-000000000003','inactive@example.test'),('00000000-0000-4000-8000-000000000004','outsider@example.test');
    alter default privileges for role postgres in schema public grant select,insert,update,delete on tables to anon,authenticated,service_role;
    alter default privileges for role postgres in schema public grant usage,select on sequences to anon,authenticated,service_role;
  `);
  if(profile!=='legacy-auto-grants')await db.exec(`
    alter default privileges for role postgres in schema public revoke select,insert,update,delete on tables from anon,authenticated,service_role;
    alter default privileges for role postgres in schema public revoke usage,select on sequences from anon,authenticated,service_role;
  `);
  // Prove the profile really removes automatic exposure and that RLS alone
  // cannot replace a table grant. These sentinel objects are local fixtures.
  await db.exec(`create table public.grant_sentinel(id int); insert into public.grant_sentinel values(1); alter table public.grant_sentinel enable row level security; create policy sentinel_reader on public.grant_sentinel for select to authenticated using(true); create sequence public.grant_sentinel_seq;`);
  await yes(`select has_table_privilege('authenticated','public.grant_sentinel','SELECT')=${profile==='legacy-auto-grants'} value`,'table default grants profile');
  await yes(`select has_sequence_privilege('authenticated','public.grant_sentinel_seq','USAGE')=${profile==='legacy-auto-grants'} value`,'sequence default grants profile');
  if(profile!=='legacy-auto-grants'){
    await actor('000000000001');await denied('select * from public.grant_sentinel');
    await db.exec('reset role; grant select on public.grant_sentinel to authenticated;');
    await actor('000000000001');await yes('select count(*)=1 value from public.grant_sentinel','explicit grant plus policy enables authorized read');
    await db.exec('reset role;');
  }
  await db.exec('drop table public.grant_sentinel; drop sequence public.grant_sentinel_seq;');
  // Product Master belongs to Ursus. Supply only its needed local test contract,
  // with an explicit read grant; do not substitute a fake application migration.
  await db.exec(`create table public.product(sku text primary key,is_active boolean); insert into public.product values('GRANTS-QA',true); revoke all on public.product from public,anon,authenticated,service_role; grant select on public.product to authenticated;`);
  for(const migration of migrations)await db.exec(await readFile(new URL(migration,migrationDirectory),'utf8'));
  await db.exec(`insert into public.black_betty_user_access(email,auth_user_id,role,is_active) values ('buyer@example.test','00000000-0000-4000-8000-000000000001','buyer',true),('admin@example.test','00000000-0000-4000-8000-000000000002','admin',true),('inactive@example.test','00000000-0000-4000-8000-000000000003','buyer',false);`);
  for(const table of tables){
    await yes(`select relrowsecurity value from pg_class where oid='public.${table}'::regclass`,`${table} enables RLS`);
    await yes(`select not has_table_privilege('anon','public.${table}','SELECT,INSERT,UPDATE,DELETE') value`,`${table} denies anon privileges`);
    await yes(`select has_table_privilege('authenticated','public.${table}','SELECT') value`,`${table} explicitly readable by authenticated`);
  }
  for(const [table,column] of [['black_betty_planning_snapshot','planning'],['black_betty_physical_snapshot','physical'],['black_betty_promotion_intelligence','workspace']]){
    await yes(`select not has_table_privilege('authenticated','public.${table}','UPDATE') value`,`${table} denies table-wide update`);
    await yes(`select has_column_privilege('authenticated','public.${table}','${column}','UPDATE') value`,`${table} allows only its document update`);
    await yes(`select not has_column_privilege('authenticated','public.${table}','version','UPDATE') value`,`${table} protects server version`);
    await yes(`select not has_table_privilege('authenticated','public.${table}','INSERT,DELETE') value`,`${table} forbids client insertion/deletion`);
  }
  await yes("select not has_column_privilege('authenticated','public.black_betty_promotion_intelligence','handoff_protocol','UPDATE') value",'handoff marker remains server-controlled');
  await yes("select not has_table_privilege('service_role','public.black_betty_promotion_intelligence','SELECT,INSERT,UPDATE,DELETE') value",'unused service role has no inbox access under either default profile');
  await yes("select has_table_privilege('service_role','public.black_betty_planning_snapshot','SELECT') value",'Ursus server read is explicit after a reset');
  if(profile!=='legacy-auto-grants')await yes("select not has_table_privilege('service_role','public.black_betty_planning_snapshot','INSERT,UPDATE,DELETE') value",'fresh Ursus server grant is read-only');

  await actor('000000000001');
  for(const table of tables.slice(1))await yes(`select count(*)=1 value from public.${table}`,'active buyer sees singleton');
  await yes('select count(*)=1 value from public.black_betty_user_access','buyer sees only own access record');
  await db.exec('update public.black_betty_planning_snapshot set planning=planning; update public.black_betty_physical_snapshot set physical=physical; update public.black_betty_promotion_intelligence set workspace=workspace;');checks++;
  await denied('update public.black_betty_promotion_intelligence set version=999');
  await denied('update public.black_betty_promotion_intelligence set handoff_protocol=999');
  await yes("with changed as (update public.black_betty_user_access set role='admin' returning email) select count(*)=0 value from changed",'buyer cannot self-promote');
  for(const user of ['000000000003','000000000004']){
    await actor(user);
    for(const table of tables.slice(1))await yes(`select count(*)=0 value from public.${table}`,'inactive/unrelated caller filtered by RLS');
  }
  await actor('000000000002');await yes('select count(*)>1 value from public.black_betty_user_access','admin retains access-management visibility');
  await db.exec('update public.black_betty_promotion_intelligence set workspace=workspace;');checks++;
  await db.exec('reset role; set role service_role;');
  await yes('select count(*)=1 value from public.black_betty_planning_snapshot','Ursus role actually reads planning');
  await denied('select * from public.black_betty_promotion_intelligence');
  if(profile!=='legacy-auto-grants')await denied('update public.black_betty_planning_snapshot set planning=planning');
  await db.exec('reset role;');
  // Exercise the real handoff trigger and private helper after all migrations,
  // with column-level grants and no implicit API grants in the fresh profiles.
  await actor('000000000001');
  const opportunity={id:'grants-opportunity',status:'APPROVED',productId:'grants-product',supplierSku:'GRANTS-QA',intelligence:{resolution:'MATCHED'}};
  await db.query("update public.black_betty_promotion_intelligence set workspace=jsonb_set(workspace,'{opportunities}',$1::jsonb)",[JSON.stringify([opportunity])]);
  const campaign={id:'grants-campaign',status:'draft',products:[{productId:'grants-product',promotionOpportunityIds:['grants-opportunity']}]};
  const product={id:'grants-product',sku:'GRANTS-QA',masterStatus:'verified',active:true,synthetic:false};
  await db.query("update public.black_betty_planning_snapshot set planning=jsonb_set(jsonb_set(planning,'{campaigns}',planning->'campaigns' || $1::jsonb),'{campaignProducts}',planning->'campaignProducts' || $2::jsonb)",[JSON.stringify([campaign]),JSON.stringify([product])]);checks++;
  await yes("select count(*)=1 value from public.black_betty_planning_snapshot,jsonb_array_elements(planning->'campaigns') c where c->>'id'='grants-campaign'",'guarded handoff succeeds with explicit grants');
  console.log(`${profile}: ${migrations.length} actual migrations replayed; grants/RLS/server-read/guard checks passed.`);
 }catch(error){failures++;console.error(`${profile}: ${error.message}`);}
 finally{await db.close();}
}
console.log(`${checks} fresh/reset/default-grant checks passed; ${failures} profile failures.`);
if(failures)process.exitCode=1;
