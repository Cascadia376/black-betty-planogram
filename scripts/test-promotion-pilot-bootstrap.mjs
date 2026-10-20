// Offline PostgreSQL/WASM proof of the staging artifact, never a hosted pilot.
import assert from 'node:assert/strict';
import { preparePilot } from './prepare-promotion-pilot.mjs';
const { PGlite } = await import(process.env.PGLITE_MODULE);
await assert.rejects(() => preparePilot('wobndqnfqtumbyxxtojl'), /production is forbidden/);
await assert.rejects(() => preparePilot('invalid'), /isolated project ref/);
const sql = await preparePilot('abcdefghijklmnopqrst');
assert.equal(sql.includes('@cascadialiquor.com'), false);
assert.equal(sql.includes('@trufflesgroup.com'), false);
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;`);
  await db.exec(sql);
  const scalar = async query => (await db.query(query)).rows[0].value;
  assert.equal(await scalar('select count(*)::int value from public.black_betty_user_access'), 0);
  assert.equal(await scalar('select count(*)::int value from auth.users'), 0);
  assert.equal(await scalar("select planning->'campaigns' = '[]'::jsonb value from public.black_betty_planning_snapshot"), true);
  assert.equal(await scalar("select planning->'campaignReleases' = '[]'::jsonb value from public.black_betty_planning_snapshot"), true);
  assert.equal(await scalar("select bool_and(value='[]'::jsonb) value from public.black_betty_physical_snapshot,jsonb_each(physical)"), true);
  assert.equal(await scalar('select handoff_protocol=1 value from public.black_betty_promotion_intelligence'), true);
  assert.equal(await scalar("select count(*)::int value from public.product where sku like 'PILOT-%'"), 2);
  assert.equal(await scalar("select not has_table_privilege('anon','public.product','SELECT') value"), true);
  await db.exec('set role authenticated;');
  assert.equal(await scalar('select count(*)::int value from public.product'), 0);
  assert.equal(await scalar('select count(*)::int value from public.black_betty_promotion_intelligence'), 0);
  await db.exec('reset role;');
  await assert.rejects(() => db.exec(sql), /empty isolated project/);
  await db.exec('rollback;');
  console.log('15 offline pilot bootstrap checks passed; no hosted resources or identities created.');
} finally { await db.close(); }
