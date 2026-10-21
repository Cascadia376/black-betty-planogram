# Comparable commercial evidence — review candidate, 21 October 2026

This follow-up builds on Promotion Intelligence PR13 at `473895b27ce314d17574f3e8f4e35cb926fbbbfc`. Main was refreshed at `ee1c269` before editing; open PR10/11/13 and remote branches were inspected. Approved opportunity → campaign draft remains the existing implementation. Actual OND releases, floorplans, buyer campaigns, model calls and hosted setup were not used or changed.

The previous adapter read at most 1,000 rows and rejected a full result. It ordered only by date, inferred sufficient commercial evidence from any dated rows, and computed a descriptive lift from unmatched classified observations. The new adapter reads bounded pages with a date/store cursor, requires explicit date/store scope, checks repeated-read drift, and retains exact source/scope receipts with a buyer decision. Qualified comparison is available only through an accepted immutable source contract; the current shared provider supplies no such contract and remains **unverified**. Lift is unavailable throughout this slice.

## Implemented behavior

- **Source reads:** user's existing Supabase client and SELECT RLS; `sku`, selected canonical stores and inclusive date window always filter every page. A filter does not grant store access. No service-role client, source write, credential, policy, migration or grant is added.
- **Pagination:** ascending `(sales_date, store_id)` is a total order for a fixed SKU. The retained Ursus schema audit records the unique `(store_id, sales_date, sku)` key: [source audit at main fe8ed0e](https://github.com/Cascadia376/ursus-major/blob/fe8ed0ea12c6bcb2629bc24eed3458ce8e8c2d79/docs/purchasing/pilot-production-preflight.json#L2117-L2124). The adapter validates strict cursor progress and duplicate grain on every response. It continues until an empty tail even when the server cap is lower than the requested 500 rows. Bounds are 13 canonical store IDs × 366 days (4,758 rows), 100 pages per pass, two passes and one 30-second source-read deadline. Empty, null, denied, malformed, out-of-scope and changed responses cannot masquerade as complete evidence.
- **Snapshot limits:** two identical reads detect ordinary drift but do **not** prove an atomic snapshot, exclude ABA changes, or authenticate an upstream revision. Their SHA-256 identifies the exact observed canonical SKU/store/period/row payload. Live reads therefore remain unverified, even with every requested store-day present.
- **Coverage:** each selected store/day requires an explicit observation. Missing stores/dates are gaps, never inferred zero sales. An explicitly recorded zero remains a real row. Returns retain their signed units/revenue/total cost. Nulls and unsupported precision fail closed. Total cost is never multiplied as a unit cost.
- **Qualification import boundary:** `ursus-commercial-source-v1` records source/contract identity and version, immutable source revision, owner approval identity/time, source as-of, exact request and payload SHA-256, CAD scale, sellable units, signed total COGS, net-merchandise and returns definitions, complete-day rule, store-map version, and an independently recorded control reference/version/totals. These declarations require source-owner validation; they are not a signature or authentication scheme. No actual accepted contract is supplied or claimed. Current fixtures explicitly identify their synthetic approvals/controls.
- **Shared-mode authority:** the current shared repository rejects synthetic receipts, qualified receipts and supplied source contracts on **both read and write**. Buyers cannot turn local fixture qualification into live authority through the application. The unconnected source-owner transport and authentication must be implemented/reviewed before lifting that gate. Direct privileged database edits are outside the application guarantee; this patch does not claim database-enforced immutable receipt history.
- **Decision receipts:** Save review retains a validated receipt, actor, time, decision and buyer weights in the existing versioned workspace. The SHA-256 and totals are checked before retention. Existing CAS prevents stale saves, including retry after a lost acknowledgement; old receipts are preserved by application checks. A source revision becomes another historical receipt. A SKU change invalidates the loaded evidence. History stops at 20 decisions per opportunity without silently deleting prior evidence; the existing 3 MB workspace bound remains.
- **Comparison:** every non-rejected/unassociated opportunity needs a receipt. All selected receipts must have identical dates, stores, source revision, accounting contract and fixture/observed mode. One mismatch suppresses all batch scores. Ties use stable opportunity IDs. Comparisons use current buyer weights; each original decision's weights remain saved. Retained receipts are historical evidence, not a fresh read.
- **Desktop workflow:** explicit dates and mapped stores, dated observation table with paging, current evidence JSON export, retained decision JSON export, and visible source/qualification gaps. Demo has a separate **Load synthetic commercial fixture** action and never substitutes fixture rows for failed shared reads.

## Local demonstration

From this worktree, install the exact lockfile using a writable cache:

```sh
npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/betty-npm-cache
node scripts/commercial-evidence-demo.mjs
```

The runner opens no HTTP listener and imports only pure domain/fixture modules. It executes seven assertions over 1,170 synthetic store-day rows: complete receipt, verification, matching comparison, unverified source, missing store, mismatched period and unavailable lift. Output is a versioned JSON report with `mode: SYNTHETIC` and `liveIO: false`.

Desktop rehearsal:

```sh
VITE_DATA_ADAPTER=mock VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_SUPABASE_ANON_KEY= npm run dev -- --host 127.0.0.1 --port 5200 --strictPort
```

1. Open `http://127.0.0.1:5200/opportunities`, load the synthetic supplier example and capture it.
2. Reconcile Product Master. Save a volume weight of 1 under Ranking priorities.
3. Choose 2026-01-01 through 2026-03-31 and the mapped stores. **Load observed sales** reports unavailable in demo mode. Explicitly choose **Load synthetic commercial fixture** to see 1,080 rows for the 12 mapped demo stores, including signed returns.
4. Inspect dated rows and export JSON. Choose a buyer decision and Save review. Reload the page; the exact receipt, scope, version and weights remain in the inbox. Export retained receipts separately.
5. Capture a second synthetic offer and retain the same scope: comparison becomes available. Retain a changed period/store scope for either offer: all comparison scores disappear. No campaign add is required for this rehearsal.

Automated desktop command (all data isolated in browser contexts):

```sh
E2E_BASE_URL=http://127.0.0.1:5200 E2E_EXTERNAL_SERVER=1 E2E_LOCAL_TRANSPORT=0 E2E_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- tests/e2e/promotion-intelligence.spec.ts --workers=1
```

## Evidence and limitations

Baseline: `npm test` passed **286 tests / 53 files**. The first dependency install could not use the default `/home/agent/.npm` cache; repeating with `/tmp/betty-npm-cache` succeeded. An intermediate typecheck correctly caught the old unqualified ranking fixture after the contract changed; that fixture now asserts qualification and unavailable lift. No runtime baseline failures were found.

Final command outcomes and artifact hashes are recorded in `docs/evidence/commercial-evidence-validation.json`. Tests cover >1,000 rows, short server caps, ordering ties, leading zeros, missing scope, signed returns, COGS units/precision, source changes, authorization/outages on several pages, malformed rows, mismatched receipts, shared authority rejection, CAS/uncertain saves, reloads and comparable/incomparable batches. Desktop runs at 1440×900 and 1280×720 use synthetic local records. No live sales validation, hosted CI, deployment or production migration is claimed.

Independent review identified and closed four integrity edge cases: canonical comparison of reordered imported scope keys; exact decimal margin subtraction; mutation of observations/receipts while hashing; and mutation of caller-owned workspace data while shared save awaits its current-state read. Verification now compares the exact captured payload across hashing, and writes use a validated deep snapshot captured before the first await. The neighboring source-contract, fixture-mode, buyer-status and weight boundaries follow the same capture rule. The retained fake-client probe demonstrates the shared-save failure at `009e977` and the safe result at `ac0799d`; it makes no network or business writes. The final independent reviewer reported no remaining blocking findings.

Run the independent safety probe from any checkout with dependencies installed:

```sh
node scripts/commercial-integrity-probe.mjs "$PWD" --assert-safe
```

## Exact live qualification decisions still needed

1. The Ursus source owner must accept the financial definition (including returns, tax, deposit/recycling treatment, cost scale and sellable units), map every intended Betty store to canonical IDs, and supply a versioned complete store/day source with independent POS/control totals. Existing table existence and date coverage do not prove this.
2. Supply/review a server-owned, authenticated immutable source revision and coverage transport. No endpoint, vendor export schema or signing credentials were invented here. The current shared read adapter is usable for labelled unverified observations; shared qualified comparison intentionally remains blocked.
3. Confirm the real two-buyer staging target/sessions and apply PR13's existing reviewed migrations only under separate authorization. Then verify actual RLS, source access, CAS/revocation, recovery and receipt retention. This lane adds no migration.
4. Define reviewed promotion identities/classifications, matched equal-duration baselines and stockout/return treatment before enabling promotional lift. The old unmatched arithmetic is removed.

All changes remain local/review-only until parent publication controls are complete. No merge, deployment, GitHub Actions, model request or live business write was performed.

## Second-pass follow-up

The bounded independent follow-up is recorded separately in [COMMERCIAL_EVIDENCE_PASS2.md](COMMERCIAL_EVIDENCE_PASS2.md). Original first-pass results and artifacts above remain unchanged.
