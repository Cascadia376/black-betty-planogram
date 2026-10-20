// Real PostgreSQL, concurrent sessions, synthetic data only. This script starts
// its own disposable container: no network, no published ports, no host mounts,
// tmpfs data, no persistent credentials. It cannot connect to a supplied DB URL.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
const name=`betty-promotion-lock-test-${crypto.randomUUID().slice(0,8)}`;
const image='postgres:17';
const sessions=[];
let started=false,checks=0;
function command(args,input='') {
  return new Promise((resolve,reject)=>{
    const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});
    let out='',err='';child.stdout.on('data',b=>{out+=b;});child.stderr.on('data',b=>{err+=b;});
    child.on('error',reject);child.on('close',code=>resolve({code,out:out.trim(),err:err.trim()}));child.stdin.end(input);
  });
}
async function query(sql) {
  const r=await command(['exec','-i',name,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],sql);
  if(r.code!==0)throw new Error(`Isolated SQL failed: ${r.err}`);
  return r.out;
}
function session(label,user) {
  const child=spawn('docker',['exec','-i',name,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
  const s={child,out:'',err:'',done:undefined};
  child.stdout.on('data',b=>{s.out+=b;});child.stderr.on('data',b=>{s.err+=b;});
  s.done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>resolve(code));});
  child.stdin.write(`set application_name='${label}'; set role authenticated; set request.jwt.claim.sub='00000000-0000-4000-8000-${user}';\n`);
  sessions.push(s);return s;
}
async function marker(s,value) {
  for(let n=0;n<100;n++){if(s.out.includes(value))return;if(s.err)throw new Error(s.err);await delay(50);}
  throw new Error(`Session marker unavailable: ${value}`);
}
async function blocked(label) {
  for(let n=0;n<100;n++){
    if(await query(`select count(*) from pg_stat_activity where application_name='${label}' and wait_event_type='Lock';`)==='1')return;
    await delay(50);
  }
  throw new Error(`Expected PostgreSQL lock wait missing: ${label}`);
}
const userA="set role authenticated; set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';";
const userB="set role authenticated; set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';";
const opportunity={id:'00000000-0000-4000-8000-000000000011',status:'APPROVED',productId:'product-123',supplierSku:'LIVE-123',intelligence:{resolution:'MATCHED'}};
const workspace={sources:[],opportunities:[opportunity],priorities:{volume:0,margin:0,lift:0}};
const planning={campaigns:[{id:'concurrent-campaign',status:'draft',products:[{productId:'product-123',promotionOpportunityIds:[opportunity.id]}]}],campaignProducts:[{id:'product-123',sku:'LIVE-123',active:true,masterStatus:'verified',synthetic:false}],campaignReleases:[]};
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const planSql=(version)=>`update public.black_betty_planning_snapshot set planning=${literal(planning)} where version=${version} returning version;`;
const revokeSql="update public.black_betty_promotion_intelligence set workspace=jsonb_set(workspace,'{opportunities,0,status}','\"REJECTED\"');";
try{
  const launch=await command(['run','--detach','--rm','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data:rw','-e','POSTGRES_HOST_AUTH_METHOD=trust',image]);
  if(launch.code!==0)throw new Error(`Disposable PostgreSQL launch failed: ${launch.err}`);started=true;
  let ready=false;for(let n=0;n<100;n++){if((await command(['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres'])).code===0){ready=true;break;}await delay(100);}
  assert(ready,'Disposable PostgreSQL did not initialize');
  await query(await readFile(new URL('./promotion-database-fixtures.sql',import.meta.url),'utf8'));
  for(const migration of ['20261020040055_promotion_intelligence.sql','20261020041802_atomic_promotion_handoff.sql'])await query(await readFile(new URL(`../supabase/migrations/${migration}`,import.meta.url),'utf8'));
  console.log('Engine:',await query('select version();'));
  console.log('Image:',(await command(['image','inspect',image,'--format','{{index .RepoDigests 0}}'])).out);
  await query(`${userA} update public.black_betty_promotion_intelligence set workspace=${literal(workspace)};`);

  // Add owns promotion row lock. Concurrent revocation must wait, and another
  // authorized session must not observe the uncommitted draft.
  const a=session('betty-add-first','000000000001');a.child.stdin.write(`begin; ${planSql(1)} select 'ADD_STAGED';\n`);await marker(a,'ADD_STAGED');
  const b=session('betty-revoke-second','000000000002');b.child.stdin.write(`begin; ${revokeSql} select 'REVOKE_DONE'; commit;\n`);await blocked('betty-revoke-second');
  assert(!b.out.includes('REVOKE_DONE'));checks++;
  assert.equal(await query(`${userB} select jsonb_array_length(planning->'campaigns') from public.black_betty_planning_snapshot;`),'0');checks++;
  a.child.stdin.end('commit;\n');assert.equal(await a.done,0);await marker(b,'REVOKE_DONE');b.child.stdin.end();assert.equal(await b.done,0);
  assert.equal(await query(`${userB} select jsonb_array_length(planning->'campaigns') from public.black_betty_planning_snapshot;`),'1');checks++;
  assert.equal(await query(`${userA} select workspace->'opportunities'->0->>'status' from public.black_betty_promotion_intelligence;`),'REJECTED');checks++;

  // A repeated stale planning write changes zero rows. A current-version retry
  // retains the one existing link even if a later revocation has occurred.
  assert.equal(await query(`${userB} with changed as (${planSql(1).replace(';','')}) select count(*) from changed;`),'0');checks++;
  assert.equal(await query(`${userA} ${planSql(2)}`),'3');
  assert.equal(await query(`${userB} select jsonb_array_length(planning->'campaigns') from public.black_betty_planning_snapshot;`),'1');checks++;

  // Reverse ordering: A has read APPROVED, B holds an uncommitted revocation,
  // and A's prepared planning update blocks on the same promotion row. After B
  // commits, the trigger must see REJECTED and roll back the whole attempted add.
  await query(`${userA} update public.black_betty_planning_snapshot set planning='{"campaigns":[],"campaignProducts":[],"campaignReleases":[]}'::jsonb; update public.black_betty_promotion_intelligence set workspace=${literal(workspace)};`);
  const planVersion=await query(`${userA} select version from public.black_betty_planning_snapshot;`);
  const promoVersion=await query(`${userA} select version from public.black_betty_promotion_intelligence;`);
  assert.equal(await query(`${userA} select workspace->'opportunities'->0->>'status' from public.black_betty_promotion_intelligence;`),'APPROVED');
  const revoke=session('betty-revoke-first','000000000002');revoke.child.stdin.write(`begin; ${revokeSql} select 'REVOCATION_STAGED';\n`);await marker(revoke,'REVOCATION_STAGED');
  const add=session('betty-add-after-revoke','000000000001');add.child.stdin.write(`begin; ${planSql(planVersion)} commit;\n`);await blocked('betty-add-after-revoke');checks++;
  revoke.child.stdin.end('commit;\n');assert.equal(await revoke.done,0);
  assert.notEqual(await add.done,0);assert.match(add.err,/Promotion approval changed/);checks++;
  assert.equal(await query(`${userA} select version from public.black_betty_planning_snapshot;`),planVersion);checks++;
  assert.equal(await query(`${userB} select jsonb_array_length(planning->'campaigns') from public.black_betty_planning_snapshot;`),'0');checks++;
  assert.equal(await query(`${userA} with changed as (update public.black_betty_promotion_intelligence set workspace=${literal(workspace)} where version=${promoVersion} returning version) select count(*) from changed;`),'0');checks++;
  assert.equal(await query("set role authenticated; set request.jwt.claim.sub='00000000-0000-4000-8000-000000000003'; select count(*) from public.black_betty_promotion_intelligence;"),'0');checks++;
  const anonymous=await command(['exec','-i',name,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],'set role anon; select * from public.black_betty_promotion_intelligence;');
  assert.notEqual(anonymous.code,0);assert.match(anonymous.err,/permission denied/);checks++;
  console.log(`${checks} real PostgreSQL multi-session lock, authorization, stale-write, retry and cross-user checks passed (synthetic local fixtures).`);
}finally{
  for(const s of sessions){if(s.child.exitCode===null)s.child.stdin.end();}
  if(started){const cleanup=await command(['rm','--force',name]);assert.equal(cleanup.code,0,'Disposable database cleanup failed');console.log('Disposable container removed; no published ports, external network, host mounts, persistent credentials or database volumes created.');}
}
