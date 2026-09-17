# Black Betty production gate

Validated on 2026-09-17 against the linked production Supabase project.

## Outcome

The code, migration, authorization, optimistic-concurrency, physical-boundary, and synthetic end-to-end gates pass. Production is deliberately not yet declared operational because the real OND workbook is not present in this repository and the secured Jeremy/Cherie browser credentials were not available to this run.

| Gate | Result | Evidence |
| --- | --- | --- |
| Unit suite | Pass | 41 files, 186 tests passed |
| Lint, typecheck, production build | Pass | `npm run lint`, `npm run typecheck`, and `npm run build` completed successfully |
| Production migrations | Pass | Versions `20260916215237`, `20260917002512`, `20260917164730`, and `20260917181555` are recorded locally and remotely |
| Buyer/admin RLS | Pass | Rollback-only production SQL gate confirms buyer planning write, buyer physical-write denial, and admin physical write |
| Optimistic conflict at database boundary | Pass | Rollback-only production SQL gate confirms Jeremy's write advances the version and Cherie's stale write affects zero rows |
| Jeremy/Cherie browser session | Pending secured run | Credential-gated Playwright test exists; production passwords are intentionally not stored in the repository |
| Synthetic OND workflow | Pass | Import, exception resolution, October/November/December navigation, and stable-map assertion pass in Playwright |
| Real OND import and source-row reconciliation | Blocked by missing source file | Repository contains generated TypeScript fixtures, not the actual buyer workbook |
| Campaign floorplan semantics | Pass | Campaign context exposes no layout editing, including when `mode=layout` is forced; explicit layout mode retains canonical editor behavior |
| Complete Playwright suite | Pass with one intentional skip | 59 passed, 1 credential-gated production collaboration test skipped |

## Data sources and assumptions

- Canonical physical counts were checked against `publishedFloorplans.generated.json` and its verified source metadata.
- Import and monthly-order browser checks use generated fixtures under `tests/fixtures`; they prove workflow behavior but are not evidence that production source rows reconcile.
- Production authorization and conflict behavior were checked through `supabase/tests/black_betty_production_gate.sql`. Every test mutation runs inside a transaction that is rolled back.
- The linked production planning snapshot currently contains no campaign, import, or allocation records. That is a safe empty starting state, not a completed OND rollout.

## Seven-test diagnosis

The failures were stale or incorrectly scoped expectations plus one persistence defect; the verified physical source was preserved.

1. Persisted current-format mock snapshots did not write the published-floorplan version marker. A new repository instance consequently treated them as legacy and reapplied the baseline, overwriting legitimate persisted geometry or assignments. The persistence path now writes the marker with the snapshot.
2. Legacy floorplan migration replaced the full `stores` collection although store identity and address metadata are not floorplan geometry. Migration now retains normalized store records and replaces only published physical collections.
3. Verified-source count assertions selected every active DisplayArea. Crown Isle has 43 total, 39 active, 31 verified, and 12 unverified areas; the verified-source assertion now selects active verified areas.
4. Coverage expectations used the older Crown Isle totals. They now reflect the current generated reference data without changing that data.
5. A uniqueness assertion treated local codes as global identifiers. Entity UUIDs and `(storeId, localCode)` are unique; codes such as `BR5`, `BR10`, `BR11`, and `BR12` may correctly recur in different stores.
6. A campaign assignment assertion searched only by store and could select an unrelated assignment already present in the seed. It now scopes identity by both campaign display and store.
7. The remaining persistence-related assertions passed once the version marker and store-preservation defects above were corrected; expected values were not changed to conceal implementation errors.

## Production authorization evidence

Confirmed active authenticated access records:

- Jeremy (`jeremy@cascadialiquor.com`) — buyer
- Cherie (`ckerwin@cascadialiquor.com`) — buyer
- Jay (`jay@trufflesgroup.com`) — admin

The production gate verifies that buyers can read planning and physical reference documents, can update only planning, and cannot update the physical document. The admin can update the physical document. Planning JSON is constrained against physical collection keys, and campaign serialization uses a disjoint allowlist.

## Floorplan ownership semantics

- A campaign assignment references a canonical `DisplayArea` by ID.
- Campaign-context floorplans are inspection/selection views and cannot drag, resize, edit category space, edit DisplayArea metadata, duplicate a layout, or activate a layout.
- Canonical drag/resize remains available only to an authorized admin in explicit layout-management mode.
- Campaign-specific geometry overrides are not currently supported. Any future implementation must use a separate campaign-owned object and must never write `DisplayArea.geometry`.

## Reproducible commands

```text
npm test
npm run lint
npm run typecheck
npm run build
npx playwright test
supabase migration list --linked
supabase db query --linked --file supabase/tests/black_betty_production_gate.sql
```

Run the live collaboration scenario from a secured shell or CI secret store:

```text
E2E_JEREMY_EMAIL
E2E_JEREMY_PASSWORD
E2E_CHERIE_EMAIL
E2E_CHERIE_PASSWORD
E2E_SHARED_CAMPAIGN_ID
```

Then run `npx playwright test tests/e2e/shared-supabase.spec.ts`. Do not commit these values.

## Remaining production actions

1. Supply the real OND workbook and import it into the empty production planning snapshot.
2. Reconcile a documented sample of at least ten source rows spanning October, November, December, Display Y, Display blank/N, and multiple stores. Record source row, SKU, store, month eligibility, display participation, and generated order quantity.
3. Create or select the real shared campaign, set the five secured E2E variables, and run the Jeremy/Cherie browser test.
4. Have Jeremy and Cherie confirm the resulting stable display map and actionable monthly order plans.

Only after these four actions pass should the workflow be called operational.
