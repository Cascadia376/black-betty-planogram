# Black Betty hardening - 21 September 2026

Status: implemented and locally verified on an isolated engineering branch. Production data has not been changed. This note supersedes historical scope/readiness claims where they conflict with inspected code. Deployment remains subject to the engineering PR and the current production gate.

## Product requirement

A buyer can create a campaign, review product intake, select participating stores, assign permanent display areas, save/reopen changes, edit canonical display positions, and produce intelligible store instructions. Planning must never silently destroy saved work. Unimplemented ordering, measurement, notification and store-account workflows must not masquerade as production capabilities.

## Evidence and priority order

Baseline: main `f6034badac4d89b5286d08a76ff316283c68637c`. The repository already contains shared Supabase planning, floorplan editing, workbook review and campaign publishing; several earlier documents incorrectly describe these as absent. Read-only database inspection confirmed 13 physical layouts, 301 display-area records, 8 campaigns and 6 imports. These are real records, not authority to replace them.

Baseline local validation: 194 unit tests, 193 passed and one stale rotating-slot expectation failed. Type checking failed on a missing test product ID and React 19 useRef initialization. Lint failed on two unused variables. Vite's production build passed independently of those failures. Build success alone was not a quality gate.

Priority: (1) persistence and replay safety; (2) floorplan save/edit/navigation safety; (3) truthful shared-mode boundaries; (4) manager output and release correctness; (5) regression evidence and aligned documentation.

## Decisions

| Issue and evidence | Decision and rationale | Consequence / follow-up |
| --- | --- | --- |
| Local repository changed memory before localStorage writes; a quota failure could be saved by an unrelated later action. | Retain a committed checkpoint and roll back failed storage writes. | Failures do not silently persist half-finished work. |
| A malformed browser snapshot was silently replaced by demo seed. | Fail closed and preserve original bytes. Validate the versioned collection envelope. | Recovery is explicit; corrupt data is not overwritten. Row-level schema validation remains incremental. |
| Published baseline marker mismatch replaced saved physical layouts. | Migrate the envelope without replacing saved geometry or planning. | New browsers use the published baseline; existing browsers retain their work. |
| Two tabs could silently overwrite their whole snapshots. | Compare the last-read serialized value before each write and refuse stale writes. | This is best-effort local conflict detection, not atomic cross-tab CAS. Shared Supabase version checks remain authoritative for collaboration. |
| Supabase reads could replace the domain snapshot and version while a write was pending. | Serialize reads and writes on one adapter queue. Preserve separate physical and planning versions. | No refresh/write race within one repository instance; conflicts across users remain explicit. |
| Applying the same store workbook deleted/rebuilt imported display concepts and lost buyer adjustments. | An already-applied campaign/import key with matching fingerprint is a no-op; different content under the same key is rejected. | Retrying cannot undo subsequent buyer work. Revised workbooks require a new reviewed import. |
| Display drag drafts could survive failed saves without clear recovery or be abandoned by navigation. | Pointer autosave, explicit keyboard Save, retained failed draft, Retry/Cancel, one-step Undo, unsaved navigation guard, duplicate-write lock. | Pointer cancellation never saves; leaving while saving is blocked. |
| Store display positions are canonical store assets; category layout drafts do not own them. | Only current physical-layout management mode edits display positions; campaign/program views remain read-only. | No campaign-specific physical geometry was invented. Supporting per-campaign relocations would require a separate model. |
| Existing normalized geometry already scales with the source map. | Keep normalized rectangles; add finite-value validation, optional grid snapping and advisory overlap warnings. | No heavyweight layout engine or automatic aisle-safety claims. |
| New workbook revisions replaced store-specific quantities/instructions and re-included excluded stores. | Preserve buyer overrides and exclusions; treat differing non-empty notes as a conflict requiring confirmation. | Source baseline can change without erasing reviewed buyer choices; missing rows do not silently delete records. |
| Manager packs read current data even after publication. | Freeze the narrow manager-output projection in optional release executionData; block legacy frozen-copy fallback. | Later edits cannot silently rewrite released instructions or positions. Source image bytes remain a documented retention limitation. |
| Repeated publish created redundant releases/execution records. | Compare publication content excluding status bookkeeping and return the existing result when unchanged. | Deliberate changed content creates a new version; existing records are not duplicated on retry. |
| Prototype shared-mode operations could succeed even though their affected collections were not serialized. | Add a complete-operation allowlist and hide/block unsupported routes. | Ordering, legacy program operations, execution entry and analytics remain demo-only, not fake live success. |
| Production operations inherited a fixed demo date. | Use the Vancouver business date and real timestamps for shared mode; retain deterministic demo dates. | Test fixtures stay reproducible without backdating live publication. |
| Case defaults and unit guidance could be conflated. | Label defaults as cases; show cases and explicit minimum facings only. | No invented bottle/unit conversion or shelf arrangement. |
| Old docs claimed the live database was empty and physical writes were admin-only. | Replace current README/gate/adapter/floorplan/pack instructions, mark proposals historical and preserve history in Git. | No operator should follow obsolete reset/seed or permissions instructions. |

## Boundaries

No database migration, access grant, production publication, campaign edit, deletion, order submission, email or deployment promotion has been performed during this run. All destructive or synthetic test mutations use isolated mock state. Live Supabase checks are read-only. Production authorization still rests with existing RLS, not navigation visibility.

## Verification completed locally

| Check | Result | Scope |
| --- | --- | --- |
| TypeScript | Pass | `npm run typecheck` |
| ESLint | Pass | `npm run lint` |
| Unit/integration suite | Pass: 226 tests, 45 files | Includes local failure/reopen, import replay/revision, shared queue/CAS, release data/validation, floorplan recovery and clock boundaries |
| Vite production build | Pass | 1,837 modules; approximately 4.04 MB main JS / 610 KB gzip. Large seed/demo payload remains a performance follow-up. |
| Chromium suite | Pass: 62 tests; 1 intentional skip | 63 discovered; direct local transport, two workers, isolated mock state |
| Buyer end-to-end | Pass | UI create -> catalog selection -> display/guidance -> Crown Isle placement -> store note -> release -> reopen -> later edit -> immutable old release -> new version |
| Floorplan browser recovery | Pass | Drag, resize, touch cancel/save, keyboard, failed storage save/retry, Undo, navigation guard and reload |
| Print/mobile QA | Pass on synthetic fixtures | Five-page letter Crown Isle draft PDF rendered and all pages visually inspected; released pack checked at 390 px without page overflow |
| Secured two-user browser | Not run | Requires staging credentials/disposable campaign plus explicit write-test opt-in; not substituted with a production write |

Test PDFs contain synthetic product/SKU data with supplied store reference maps. They are QA artifacts, not approved instructions for stores. Earlier failing E2E selectors were corrected to actual controls; assertions still exercise real saves/reopens and no-op publication. The PDF test now waits for the requested month's heading before printing. No tests were removed to hide failures.

The local agent-browser binary was unavailable; browser verification used installed Playwright Chromium. No production account credentials were retrieved. The final security follow-up changes only fflate 0.8.2 to 0.8.3 and the transitive development dependency js-yaml 4.3.1 to 4.3.2; no broad dependency upgrade was performed. Source and locked dependencies were obtained through a short-lived isolated GitHub Actions bootstrap because the working container had no external network; that bootstrap is removed from the final branch content. The initial delivered product changes also passed the normal GitHub PR quality gate: run 35613453220 (226 unit/integration tests, 62 browser passes, one explicitly gated staging skip). The final image-readiness follow-up increases the unit suite to 233 tests across 46 files.

## Final image readiness and dependency security verification

A security retest (run 35614137369) surfaced an intermittent disabled Print button in the OND acceptance flow. Replaced reliance on the SVG image load event with an explicit image decode/readiness check, including already cached images, stale request cancellation, a bounded loading state and Retry floor map. Seven new unit tests protect these transitions; the buyer browser test now intentionally fails a map request and verifies safe recovery before printing. No assertion timeout was increased or disabled to hide the failure.

Inspection of the build log also revealed two existing advisory findings. The ZIP parser finding is relevant to workbook intake, not merely an unused development tool. Updated fflate to 0.8.3 (GHSA-px8p-9vwx-vf98) and the transitive development parser js-yaml to 4.3.2 (GHSA-2883-xcg3-v3hh). The direct fflate minimum is now ^0.8.3. A strict comparison rejects any unrelated dependency changes.

The patched lockfile passed npm audit at the moderate threshold, lint, TypeScript, all 233 unit/integration tests, build and the complete default browser suite (62 passed; one explicit secured-staging skip) before commit. An additional 15 browser tests passed across five repeats of the buyer release and OND importer/print flows. Evidence: https://github.com/Cascadia376/black-betty-planogram/actions/runs/35615335535. A permanent Dependency audit workflow reports advisories and fails on moderate-or-higher findings; no audit suppression or forced major update was used. This scan is evidence about known advisories at this time, not proof of absence of vulnerabilities.

References: https://github.com/101arrowz/fflate/releases/tag/v0.8.3 and https://github.com/nodeca/js-yaml/security/advisories/GHSA-2883-xcg3-v3hh.

## Remaining issues and next work

1. Run the secured two-user staging scenario and reconcile a real buyer workbook to the generated store packs; these are the highest-value acceptance gates, not missing documentation exercises.
2. Add explicit final Product Master refresh/reconciliation, including the UI for resolving already-imported pending identities. Current release validation uses the last selected/imported catalog state and blocks known pending/inactive/unresolved/synthetic products.
3. Maintain source image retention or archive released PDFs; frozen JSON alone does not freeze an image hosted at a mutable URL.
4. Whole-document optimistic concurrency is deliberately coarse. Consider per-campaign documents/rows and audit history only after pilot evidence, not as an unreviewed migration.
5. Complete manager authorization/delivery and execution/measurement integration as separately scoped capabilities. Until then, print/share approved release packs manually.
6. Local conflict detection remains best-effort and local recovery has no complete campaign backup UI. Large bundled demo/reference data remains a performance improvement opportunity.

No business decision blocked this engineering scope. Normal production use still requires approval of the release/pilot, intended access/distribution ownership and real-workbook/store acceptance under [the current gate](PRODUCTION_GATE.md).
