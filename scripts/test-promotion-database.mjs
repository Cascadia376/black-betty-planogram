// Isolated PostgreSQL/WASM verification. Never connects to Supabase or production.
// Install PGlite in a temporary directory and pass its entry module with PGLITE_MODULE.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE);
const db = new PGlite();
try {
  await db.exec(await readFile(new URL('./promotion-database-fixtures.sql', import.meta.url),'utf8'));
  for (const migration of ['20261020040055_promotion_intelligence.sql','20261020041802_atomic_promotion_handoff.sql']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url),'utf8'));
  }
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
  await denied('update public.black_betty_promotion_intelligence set handoff_protocol=0');
  await denied('delete from public.black_betty_promotion_intelligence');
  await denied('insert into public.black_betty_promotion_intelligence(singleton) values (false)');
  await denied(`update public.black_betty_promotion_intelligence set workspace='{}'`);
  await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false)`);
  assert.equal((await db.query(`update public.black_betty_promotion_intelligence set workspace=workspace where version=1 returning version`)).rows[0].version,2); checks++;
  // Exact prior race: client A observes approval, buyer B commits revocation,
  // then A submits its stale prepared campaign. Guard must reject the entire write.
  const opportunity = { id: '00000000-0000-4000-8000-000000000011', status: 'APPROVED', productId: 'product-123', supplierSku: 'LIVE-123', intelligence: { resolution: 'MATCHED' } };
  const workspace = { sources: [], opportunities: [opportunity], priorities: { volume: 0, margin: 0, lift: 0 } };
  const candidate = { campaigns: [{ id: 'campaign-1', status: 'draft', products: [{ productId: 'product-123', promotionOpportunityIds: [opportunity.id] }] }], campaignProducts: [{ id: 'product-123', sku: 'LIVE-123', active: true, masterStatus: 'verified', synthetic: false }], campaignReleases: [] };
  async function saveApproval(status) { workspace.opportunities[0].status = status; await db.query('update public.black_betty_promotion_intelligence set workspace=$1', [JSON.stringify(workspace)]); }
  async function savePlanning(value,version=1) { return db.query('update public.black_betty_planning_snapshot set planning=$1 where version=$2 returning planning,version', [JSON.stringify(value),version]); }
  async function rejectPlanning(value, pattern, version=1) { await assert.rejects(() => savePlanning(value, version), pattern); checks++; }
  await saveApproval('APPROVED');
  const preflight = await db.query(`select workspace->'opportunities'->0->>'status' status from public.black_betty_promotion_intelligence`);
  assert.equal(preflight.rows[0].status,'APPROVED');
  await saveApproval('REJECTED');
  // Counterfactual regression: disable only this new guard inside a rolled-back
  // transaction in this disposable database. The former read-then-write design
  // accepts the stale approved client payload after revocation.
  await db.exec('begin; reset role; alter table public.black_betty_planning_snapshot disable trigger validate_black_betty_promotion_handoff; set role authenticated');
  assert.equal((await savePlanning(candidate)).rows[0].version,2); checks++;
  await db.exec('rollback');
  // With the real migration installed the exact same interleaving is rejected.
  await rejectPlanning(candidate,/approval changed/);
  assert.equal((await db.query('select version from public.black_betty_planning_snapshot')).rows[0].version,1); checks++;
  assert.equal((await db.query("select jsonb_array_length(planning->'campaigns') count from public.black_betty_planning_snapshot")).rows[0].count,0); checks++;
  await saveApproval('APPROVED');
  const originalProduct=workspace.opportunities[0].productId;
  workspace.opportunities[0].productId='other-product';
  await saveApproval('APPROVED'); await rejectPlanning(candidate,/approval changed/);
  workspace.opportunities[0].productId=originalProduct;
  workspace.opportunities[0].intelligence.resolution='PENDING';
  await saveApproval('APPROVED'); await rejectPlanning(candidate,/approval changed/);
  workspace.opportunities[0].intelligence.resolution='MATCHED'; await saveApproval('APPROVED');
  await db.exec('begin');
  await savePlanning({...candidate,campaigns:[{id:'campaign-1',status:'scheduled',products:[]}]});
  await rejectPlanning(candidate,/editable draft/,2);
  await db.exec('rollback');
  await rejectPlanning({...candidate,campaigns:[{...candidate.campaigns[0],status:'scheduled'}]},/editable draft/);
  await rejectPlanning({...candidate,campaignProducts:[{...candidate.campaignProducts[0],sku:'OTHER'}]},/Product Master/);
  const duplicate=structuredClone(candidate); duplicate.campaigns.push({...candidate.campaigns[0],id:'campaign-2'});
  await rejectPlanning(duplicate,/already linked/);
  // An inactive authoritative SKU cannot be slipped into an approved handoff.
  await db.exec('reset role; update public.product set is_active=false; set role authenticated');
  await rejectPlanning(candidate,/inactive, ambiguous/);
  await db.exec('reset role; update public.product set is_active=true; set role authenticated');
  const committed=await savePlanning(candidate);
  assert.equal(committed.rows[0].version,2); checks++;
  assert.equal((await savePlanning(candidate)).rows.length,0); checks++;
  // Lost acknowledgement retry: preserve the same link instead of creating one.
  const retry=await savePlanning(candidate,2);
  assert.equal(retry.rows[0].planning.campaigns.length,1); checks++;
  await saveApproval('REJECTED');
  const another=structuredClone(candidate); another.campaigns=[{...candidate.campaigns[0],id:'campaign-2'}];
  await rejectPlanning(another,/approval changed/,3);
  const missing=structuredClone(candidate); missing.campaigns=[{id:'campaign-2',status:'draft',products:[{productId:'product-123',promotionOpportunityIds:['missing-opportunity']}]}];
  await rejectPlanning(missing,/approval changed/,3);
  assert.deepEqual((await db.query('select planning from public.black_betty_planning_snapshot')).rows[0].planning,candidate); checks++;
  // No opportunity additions: existing planner commands are unaffected.
  const ordinary=structuredClone(candidate); ordinary.campaigns.push({id:'ordinary-draft',status:'draft',products:[]});
  assert.equal((await savePlanning(ordinary,3)).rows[0].version,4); checks++;
  console.log(`${checks} isolated database authorization, shape, audit and stale-write checks passed (synthetic fixtures).`);
} finally { await db.close(); }
