# Commercial evidence: buyer correction readiness

This bounded pass starts from PR14 head `2ffe3b5dc7070c9188818792085de50df517b4f3`.
The coordinator refreshed PR14 as an open draft targeting
`codex/promotion-intelligence`; PR13 remains its dependency. The existing branch
deployment guards and prior evidence packages are unchanged.

Three concrete failures were reproduced locally, using synthetic data only:

| Finding | Before | After |
| --- | --- | --- |
| Correcting a SKU after loading commercial evidence | Save tried to retain evidence for the previous SKU, rejected the correction and kept the original saved SKU. Reloading evidence still used that saved SKU. | Editing the SKU discards only pending evidence. Save the correction, reconcile Product Master, then load evidence for the replacement. Historical receipts remain unchanged. |
| Current product identity | Lowercase supplier SKUs could reconcile successfully through the existing Product Master normalization but then fail receipt retention. Conversely, matching strings with a stale `UNMATCHED` resolution could retain a receipt. | Retention and current comparison require `MATCHED` and the existing trim/case normalization for supplier-to-master identity. Receipt SKU must still equal the exact canonical master SKU. Leading zeros, receipt hashes and source identity remain unchanged. |
| Reload and review overlap | While an inbox read was deliberately held after capturing its revision, Save review remained enabled. | Reload participates in the existing busy wrapper. Review writes and another reload remain disabled until the read completes; a subsequent save succeeds. |

The reload reproduction establishes an overlapping read/write opportunity. It
does not claim durable data loss, cross-device serialization or server idempotency.
The fix reuses the existing UI coordination; shared CAS and demo Web Locks remain
responsible for their existing persistence guarantees.

The [before screenshot](evidence/commercial-corrections/before-sku-correction.png)
shows the rejected correction. The
[after screenshot](evidence/commercial-corrections/after-sku-correction.png)
shows the replacement saved as unmatched, new evidence loading disabled until
reconciliation, and the original SKU's historical receipt retained. The browser
then reconciles the replacement and saves a second receipt, checking both receipt
SKUs and exact preservation of the first receipt.

## Executed checks

- Before changes: two focused unit assertions failed; the correction browser case
  failed with the old SKU still saved; the held-reload case showed Save review
  enabled. Actual outputs are retained in the [validation record](evidence/commercial-corrections-validation.json).
- `npx vitest run src/domain/promotion/decision.test.ts src/services/promotion/commercial.test.ts src/services/promotion/recovery.pass2.test.ts`:
  **57 passed / 3 files**.
- `npm run typecheck` and `npm run lint`: **passed**.
- Ten distinct relevant desktop cases passed: eight existing recovery/promotion
  cases plus the two new correction/reload cases. The initial focused run passed
  nine cases and timed out on a new test's overly exact label locator after its
  reload assertions passed. Correcting that locator and rerunning only the new
  file passed both cases. Both logs are retained; no single-run 10/10 result is
  claimed.
- The root coordinator independently reviewed current-identity normalization,
  exact receipt matching and pending-evidence invalidation without a material
  finding. The current pass did not repeat the prior broad unit/build suites.

Runnable local rehearsal:

```sh
VITE_DATA_ADAPTER=mock VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_SUPABASE_ANON_KEY= npm run dev -- --host 127.0.0.1 --port 5224 --strictPort
# In another terminal:
E2E_BASE_URL=http://127.0.0.1:5224 E2E_EXTERNAL_SERVER=1 E2E_LOCAL_TRANSPORT=0 E2E_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- tests/e2e/commercial-corrections.spec.ts --workers=1
```

The delayed-read test uses the running Vite repository module and releases the
captured result in a `finally` block. It exercises the actual UI and local demo
repository without contacting a live source or changing a shared workspace.

## Remaining gates

Live qualified commercial evidence still requires an accepted immutable source
revision, complete store/day coverage, financial definitions, independent POS
controls and reviewed authenticated source transport. Shared observations remain
unverified; synthetic/qualified buyer-supplied receipts stay rejected in shared
mode. Promotional lift remains unavailable without qualified promotion
classification and a matched baseline.

The two-buyer shared rehearsal still needs an approved staging target, sessions
and the existing PR13 migration approval. These changes need no new migration.
No live source/model calls, OND/floorplan changes, live campaign mutations,
deployments, merges, hosted CI or prior-denial retries occurred. Commits are local
for coordinator review; this lane did not push or edit PR descriptions.
