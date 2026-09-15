# October store execution pack

## Scope and data boundaries

The primary path is **Import OND workbook → review exceptions → Campaign Review → selected store execution pack**. This uses the existing consolidated workbook contract, not supplier-by-supplier submissions. Campaign planning is saved in browser localStorage. The only catalog integration remains read-only exact-SKU lookup; no production writes, migrations, service keys, publication, or deployment are introduced.

Protected floorplan images and generated layout/display seeds are unchanged. Maps reuse the current source image and normalized display geometry, including split-area sections.

## Decisions and provenance

- Codes can be supplied directly in `Display` (Jeremy's workbook), or in `Display Area` with a yes/no `Display` flag. Conflicting columns require approval; `Y` without a code is a missing-display exception. Exact codes apply only to stores with positive workbook quantities; blank/zero quantities do not invent allocations.
- The quick importer carries the selected file and existing campaign name/dates to full review. OND otherwise defaults to October 1–December 31 using the filename year, or the current calendar year if absent. Dates remain reviewable. Apply still creates a new draft; this handoff does not merge into the originating campaign.
- Cross-store codes (for example W8 or BR2) create reusable campaign display concepts. Exact verified store codes retain the existing import mapping behavior.
- The permanent-area picker only changes an existing campaign display assignment for one participating store. It cannot create a campaign concept, include additional stores, or move products. It shows the selected area before approval and links to the store pack after saving.
- Product corrections require an exact active Product Master lookup, a visible candidate, and explicit approval. Inactive, unmatched, ambiguous, duplicate, and invalid rows cannot become imported products automatically.
- Missing display codes can be corrected explicitly before Apply or explicitly changed to shelf support. The source SKU, source display fields, original issue codes, source cells, and store quantities remain alongside reviewed decisions.
- Suggested alternatives remain unassigned until a buyer approves them. Approving shelf support for a store retains the case quantities in the pack's no-display section.
- Applied skipped rows remain visible as exceptions. To correct skipped source rows after Apply, import a corrected consolidated workbook as a new draft; there is no implicit merge or replacement of an existing draft.

## Store pack

Route: `/campaigns/:campaignId/stores/:storeId/pack`, linked from Campaign Review. Only participating stores are accepted. The pack is a current planning copy, not a published release.

The data projection in `src/domain/storeExecutionPack.ts` reads store assignment quantities, never substituting campaign recommended quantities for unresolved cases. It separates approved display builds, shelf support, and unresolved exceptions. Unknown product categories remain explicit rather than guessed into a department. Missing signage, store quantities, or map verification keep the pack marked draft.

Print CSS uses letter portrait with 0.45-inch margins, repeated table headers, page breaks between department/build sections, and no application navigation. The print button waits for the full map to load. Browser Print / Save as PDF creates a copy of the current local plan; it does not publish, order, or mutate data.

## Reproducible validation

`tests/fixtures/octoberExecutionWorkbook.ts` is a synthetic consolidated workbook with real Crown Isle/Port Alberni store names and display codes. Crown Isle W8 receives six wine cases; Port Alberni receives three cases and requires approval of an alternative. Beer, spirits, shelf support, missing display code, unmatched SKU, and inactive SKU cases are included.

Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and `npm run test:e2e`. Playwright requires only the configured Chromium browser. The new acceptance test writes a Crown Isle PDF and screenshot under ignored `test-results/`.

On managed hosts where Chromium cannot open loopback sockets, set `E2E_LOCAL_TRANSPORT=1` when running Playwright. The optional fixture fulfills only the explicit `127.0.0.1` test-server requests using Playwright's request client. It does not disable browser security or forward production traffic. Normal hosts use direct browser networking by default.

## Jeremy's ten-minute test

Validation on 2026-09-14: lint and typecheck passed; all 156 unit/integration tests in 33 files passed; the production bundle built successfully; all 56 Chromium tests passed using the serial local-only transport. Chromium was already installed. The six-page Crown Isle PDF was confirmed as letter size (612 × 792 points) and visually inspected, including the corrected print background. No remaining test failures. Earlier direct-browser networking, parallel worker startup, request-teardown, and stale-selector failures were resolved before the final runs. Live Product Master contents and Jeremy's unsanitized workbook were not used in automated acceptance tests.

1. **0–2 minutes:** Click Import OND workbook. Upload the consolidated October–December workbook and check campaign dates and Crown Isle/Port Alberni case counts before Apply.
2. **2–4 minutes:** Resolve one missing display code or approve shelf support. For an unmatched SKU, look up one exact active SKU, check its product name, then approve it. Leave one unresolved item to check draft labeling.
3. **4–6 minutes:** Apply the reviewed draft. On Campaign Review, select Crown Isle and enter the actual approved signage/execution instructions where missing.
4. **6–8 minutes:** Open Crown Isle's execution pack. Check full-map highlights, department build sheets, product names/SKUs, cases, signage, notes, shelf items, and the remaining exception. Save as letter-size PDF and check page breaks.
5. **8–10 minutes:** Return to Review and select Port Alberni. Approve its missing-code alternative (or shelf support), open its pack, and confirm its smaller case quantities. Reopen Crown Isle to confirm that Port Alberni's override did not change Crown Isle.
