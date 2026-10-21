// Offline synthetic rehearsal. Loads only pure domain/fixture modules; no credentials,
// database clients, model calls, HTTP listener or live campaign records are used.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const runner = await createServer({ configFile: false, logLevel: 'silent', cacheDir: '/tmp/betty-commercial-demo-vite', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: null }, appType: 'custom' });
try {
  const { syntheticCommercialEvidence } = await runner.ssrLoadModule('/src/services/promotion/commercialFixture.ts');
  const { buildCommercialEvidence, verifyCommercialEvidence } = await runner.ssrLoadModule('/src/domain/promotion/commercial.ts');
  const { rankComparableReceipts, rankEvidence } = await runner.ssrLoadModule('/src/domain/promotion/ranking.ts');
  const request = { sku: '0000123', start: '2026-01-01', end: '2026-03-31', storeIds: Array.from({ length: 13 }, (_, index) => index + 1) };
  const complete = await syntheticCommercialEvidence(request);
  assert.equal(complete.observations.length, 1170);
  await verifyCommercialEvidence(complete);
  const second = await syntheticCommercialEvidence({ ...request, sku: '0000124' });
  const comparable = rankComparableReceipts([{ id: 'A', receipt: complete.receipt }, { id: 'B', receipt: second.receipt }], { volume: 1, margin: 1, lift: 0 });
  assert.equal(comparable.state, 'Comparable Evidence');
  const unverified = await buildCommercialEvidence(request, complete.observations);
  assert.equal(rankEvidence(unverified, { volume: 1, margin: 0, lift: 0 }).score, undefined);
  const missing = await buildCommercialEvidence(request, complete.observations.filter((row) => row.storeId !== '13'));
  assert.equal(missing.receipt.missingStoreDays, 90);
  const revisedScope = await syntheticCommercialEvidence({ ...request, sku: '0000124', start: '2026-01-02' });
  const incomparable = rankComparableReceipts([{ id: 'A', receipt: complete.receipt }, { id: 'B', receipt: revisedScope.receipt }], { volume: 1, margin: 0, lift: 0 });
  assert.equal(incomparable.state, 'Insufficient Evidence');
  assert.equal(rankEvidence(complete, { volume: 0, margin: 0, lift: 1 }).score, undefined);
  console.log(JSON.stringify({ contractVersion: 'betty-commercial-rehearsal-v1', mode: 'SYNTHETIC', liveIO: false, checksPassed: 7, complete: complete.receipt, unverified: unverified.receipt.qualification, missingStoreDays: missing.receipt.missingStoreDays, comparable, incomparable, promotionalLift: 'unavailable' }, null, 2));
} finally { await runner.close(); }
