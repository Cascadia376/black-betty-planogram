# Jeremy review walkthrough and verification

## Isolated demonstration

Use the saved cloud checkout. Do not connect this test to a buyer's shared campaign. Clear `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_ANON_KEY`; `VITE_DATA_ADAPTER=mock` alone does not isolate the existing provider.

Run `npm ci --cache /tmp/betty-npm-cache`, then `npm run dev -- --host 127.0.0.1`. Open `/opportunities`. The header must say **DEMO · literal extraction · browser storage**. This parser demonstrates the workflow with labelled lines; it does not claim live natural-language extraction or live commercial data.

1. Click **Load synthetic example**, then **Extract and capture**. The sample supplier proposes MOCK-1001 in November, $12.99 retail, possible tasting support and Jeremy's cautious feedback. Exact dates and cost are missing. There is deliberately a supplier/master format discrepancy (source 6-pack, current mock SKU is 12-pack); review the authoritative description and correct interpretation rather than assuming the supplier description overrides Product Master.
2. Expand source-linked claims to inspect verbatim excerpts and their classifications. November remains literal text; no exact date or discount amount is created. Expand Original communications for the source. Notice missing cost and **Insufficient Evidence**.
3. Edit Product interpretation and Jeremy's judgement. Expand Correct commercial interpretations to enter structured buyer feedback on price, format, dates, support or other extracted fields. Save as Under Consideration. Original supplier claims remain intact; review history contains before/after feedback. Reload and reopen the same opportunity.
4. Click **Reconcile Product Master**. Exact active verified MOCK-1001 is shown with the current master description/check time. Save Buyer decision = APPROVED. Missing cost is still visible and commercial recommendations remain insufficient; approval is Jeremy's decision, not a fabricated financial assessment.
5. Choose an existing editable draft, or leave Prepare a new campaign draft and enter an explicit name and buyer-confirmed start/end dates. Click **Add approved opportunity to campaign**. The existing campaign Products editor opens with the product already selected. No display, store allocation, price, release or order is automatically changed.
6. Return to Promotion Intelligence and open the record. It shows Added to Campaign and a link back to the same editor. Repeated actions recover the same opportunity-to-campaign association. A failed inbox acknowledgement after a committed campaign save is retryable without another campaign/product.
7. Capture the same source again: already captured, no duplicate. Capture a revised offer adding `Price: $9.99 alternate offer`: two supplier claims and conflicting price are visible. Same SKU remains a separate offer until Jeremy explicitly associates evidence with a selected candidate; association retains both records and resets approval.
8. Test an unresolved product with the second fixture below. It stays usable in review but cannot hand off. Reject and reload to confirm the record remains historically available. Delete a source through Source retention and deletion to test redaction; fingerprint tombstones prevent accidental re-ingestion.

### Missing-terms fixture

```text
Supplier: Synthetic Supplier
Product: Proposed seasonal spirit
SKU: UNKNOWN-DEMO-42
Dates: November, exact dates to be confirmed
Discount: Supplier says a discount is planned; value not supplied
Jeremy: Interested, but require cost and pack details
Question: Confirm active Product Master SKU and cost
Action: Follow up before October 28
```

### Conflicting-source fixture

```text
Supplier: Synthetic Supplier
Product: Coastal Lager
SKU: MOCK-1001
Price: $12.99 proposed retail
Price: $9.99 in a separate supplier note; unconfirmed
Dates: November
Question: Which retail offer is valid and what is the exact date window?
```

These fixtures are entirely synthetic. No supplier terms or actual buyer campaign were copied into them.

## Shared/staging setup (review required; not performed on production)

1. Use an authorized isolated Supabase staging project with established Black Betty access, private role helper and existing planning audit trigger. Review/apply both `supabase/migrations/20261020040055_promotion_intelligence.sql` and `supabase/migrations/20261020041802_atomic_promotion_handoff.sql` there, in order. Shared handoff fails closed unless the atomic guard capability marker is present. Do not recreate existing snapshots, roles or geometry. Test active buyer/admin access and denied revoked/unrelated/anonymous users.
2. Configure the existing browser-safe Supabase URL/key as usual. On the server only, set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `AI_GATEWAY_API_KEY`, and an approved `PROMOTION_EXTRACTION_MODEL`. The server and browser must point to the same authorized staging project. Do not put gateway/API/service-role keys in any `VITE_` variable. No service-role key is required.
3. Review company data-handling/model-provider/retention approval before using real correspondence. Test the standalone fetch handler with `vercel dev` or an approved staging deployment, including request routing before the SPA catch-all. `vite` alone does not serve Vercel functions.
4. Paste a representative synthetic natural-language email to exercise the configured model; validate excerpts, denial, invalid-output and timeout behaviour. Source text is sent to the approved model gateway, with no tools or autonomous action capability. Without model credentials shared capture fails visibly rather than using the demo parser.
5. Use two authorized test users and a disposable staging campaign: capture/save/reload across sessions, verify stale save rejection, approve/reconcile/add/open the same draft, then simulate a failed acknowledgement/retry. This shared-authenticated scenario was not run here.
6. Sales reads retain existing caller SELECT authorization. Confirm `productdailysales` access, completeness, units and cost semantics before treating observed utility as a commercial decision aid. A permissions/schema/data error remains insufficient evidence; do not widen grants merely to make a demo work.

Code rollback and data-preserving migration rollback guidance are in ADR 0003. The feature branch explicitly disables its Vercel Git deployment; deployment/merge require separate approval.

## Executed engineering evidence

Final results are recorded in `PROMOTION_INTELLIGENCE_VALIDATION.md`. All test fixtures were isolated and synthetic. The OND audit used read-only real shared data and is reported separately; a passing mock suite does not establish live delivery, store execution, current session compatibility or live-model quality.

Commands:

```bash
npm run lint
npm run typecheck
npm test
npm run build
E2E_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium E2E_LOCAL_TRANSPORT=0 npm run test:e2e
```

The host's Playwright CDN download returned HTTP 403, so the browser suite used the available system Chromium through the optional executable override. No user's desktop or GitHub Actions was used.

Additional isolated PostgreSQL policy verification (PGlite test dependency is installed under `/tmp`, not added to application runtime):

```bash
npm install --prefix /tmp/betty-sql --cache /tmp/betty-npm-cache @electric-sql/pglite@0.5.10
PGLITE_MODULE=/tmp/betty-sql/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-promotion-database.mjs
```

The script creates a disposable in-memory PostgreSQL database, baseline role/auth/audit fixtures, and the new table. It cannot connect to production. It checks anonymous/unrelated/inactive denials, buyer/admin access, column permissions, shape constraints, audit fields, stale version rejection and the exact approval-revocation interleaving against the new transactional guard. The counterfactual disabling of the guard occurs only inside a rolled-back transaction in this disposable database. It does not substitute for validating inherited functions and policy semantics in real staging.

## Continued pilot readiness

See [actual staging-resource discovery and pending approvals](PROMOTION_INTELLIGENCE_STAGING_PILOT.md). No feature staging deployment/database or two existing authorized test sessions were available. The shared browser pilot now requires an explicit `E2E_SHARED_SUPABASE_URL`, rejects known production targets and mismatched compiled browser requests, and refuses campaigns outside the Synthetic pilot/QA/staging naming scope before writing. It does not create credentials or grant access.

For genuine concurrent local database verification, run `node scripts/test-promotion-postgres.mjs` on a Docker-capable cloud host. It starts/removes its own network-isolated, tmpfs PostgreSQL container and runs overlapping transaction tests against synthetic fixtures; it cannot connect to an external database URL. This verifies row-lock behaviour, not hosted Supabase/model acceptance.
