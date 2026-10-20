// Isolated PostgreSQL/WASM verification. Never connects to Supabase or production.
// Install PGlite in a temporary directory and pass its entry module with PGLITE_MODULE.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE);
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.black_betty_user_access(id uuid primary key, role text, is_active boolean);
    create function private.black_betty_role() returns text language sql stable security definer set search_path='' as $$ select role from public.black_betty_user_access where id=auth.uid() and is_active $$;
    grant usage on schema private,auth to authenticated;
    grant execute on function private.black_betty_role() to authenticated;
    create function private.set_black_betty_planning_snapshot_audit_fields() returns trigger language plpgsql security definer set search_path='' as $$ begin new.version=old.version+1; new.updated_at=now(); new.updated_by=auth.uid(); return new; end $$;
    insert into auth.users values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002'), ('00000000-0000-4000-8000-000000000003');
    insert into public.black_betty_user_access values ('00000000-0000-4000-8000-000000000001','buyer',true), ('00000000-0000-4000-8000-000000000002','admin',true), ('00000000-0000-4000-8000-000000000003','buyer',false);
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261020040055_promotion_intelligence.sql', import.meta.url),'utf8'));
  let checks = 0;
  async function denied(sql) { await assert.rejects(() => db.exec(sql)); checks++; }
  await db.exec('set role anon');
  await denied('select * from public.black_betty_promotion_intelligence');
  await denied(`update public.black_betty_promotion_intelligence set workspace='{}'`);
  await db.exec('reset role; set role authenticated');
  assert.equal((await db.query('select * from public.black_betty_promotion_intelligence')).rows.length,0); checks++;
  await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false)`);
  assert.equal((await db.query('select * from public.black_betty_promotion_intelligence')).rows.length,0); checks++;
  assert.equal((await db.query(`update public.black_betty_promotion_intelligence set workspace=workspace returning version`)).rows.length,0); checks++;
  await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false)`);
  assert.equal((await db.query('select version from public.black_betty_promotion_intelligence')).rows.length,1); checks++;
  const first = await db.query(`update public.black_betty_promotion_intelligence set workspace=workspace where version=0 returning version,updated_by`);
  assert.equal(first.rows[0].version,1); assert.equal(first.rows[0].updated_by,'00000000-0000-4000-8000-000000000001'); checks++;
  assert.equal((await db.query(`update public.black_betty_promotion_intelligence set workspace=workspace where version=0 returning version`)).rows.length,0); checks++;
  await denied('update public.black_betty_promotion_intelligence set version=999');
  await denied('delete from public.black_betty_promotion_intelligence');
  await denied('insert into public.black_betty_promotion_intelligence(singleton) values (false)');
  await denied(`update public.black_betty_promotion_intelligence set workspace='{}'`);
  await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false)`);
  assert.equal((await db.query(`update public.black_betty_promotion_intelligence set workspace=workspace where version=1 returning version`)).rows[0].version,2); checks++;
  console.log(`${checks} isolated database authorization, shape, audit and stale-write checks passed (synthetic fixtures).`);
} finally { await db.close(); }
