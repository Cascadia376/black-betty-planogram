# Phase 0 stabilization notes

## Objective

Make the existing campaign-planning prototype reliable and understandable without adding the future supplier, store-review, ordering, or AI workflows.

## Architecture and data sources reviewed

- React 19 and Vite 6 single-page application with React Router 7.
- `MerchandisingRepository` is the only data-access boundary used by UI components.
- The active prototype adapter is `MockMerchandisingRepository`, persisted in browser `localStorage` under `cascadia-merchandising-platform-v1`.
- The Supabase adapter is an intentionally unavailable skeleton. No live Supabase project, migration directory, or production credentials are present.
- Vitest covers domain and repository logic. Playwright covers primary browser workflows.
- Vercel serves the built SPA and rewrites deep links to `index.html`.

## Terminology map

Internal identifiers remain unchanged for backward compatibility.

| Internal term | User-facing term |
| --- | --- |
| `prescriptive: true` | Required setup |
| `prescriptive: false` | Store choice |
| placement decision | Store placement |
| buyer override | Adjusted by store |
| `recommendedCases` used as the display baseline | Campaign default |
| non-overridden store quantity | Campaign default |

## Store quantity state model

1. `CampaignDisplayProduct.minimumQuantity` is the campaign default.
2. A `CampaignDisplayAssignmentProduct` inherits that value when `buyerOverride` is false.
3. Saving a different value for one store marks only that row as adjusted by store.
4. Changing the campaign default updates inherited rows and preserves store adjustments.
5. Reset copies the current campaign default into one store and clears its adjustment flag.
6. Apply default to all stores deliberately changes the campaign default and resets every store for that display product.

Campaign allocation has no lock field today, so lock/unlock behaviour is not applicable in Phase 0. Required setup controls execution flexibility; it does not silently lock quantities.

## Spreadsheet import decision

Two narrow, known-format importers are usable and remain enabled:

- Campaign product `.xlsx`: `SKU | Role | Required | Notes`, with validation and review before apply.
- Cascadia OND allocation `.xlsx`: its documented legacy format, with validation and review before apply.

Arbitrary monthly-flyer spreadsheet import remains disabled and clearly labelled as coming soon. Re-enabling it requires an approved workbook contract, explicit Product Master reconciliation rules, campaign/date mapping rules, transactional production persistence, permission checks, and representative fixture-based tests.

## Data-model sanity check

The current model can represent Campaign, Campaign Product, campaign-level Display, Store, persistent Store Display (`DisplayArea`), Campaign Display Assignment, store-level quantity adjustment, campaign dates, and campaign status. No destructive or additive migration was required for Phase 0.

Two constraints should be handled before production rollout:

- Legacy `CampaignAssignment` coexists with the newer planning `CampaignDisplayAssignment`. A production migration should define the read/write cutover and preserve historical IDs.
- The Supabase adapter has no implementation. Production persistence needs additive tables or mappings, RLS policies matching the existing role model, safe Data API grants, idempotent writes, and verified error translation before `VITE_DATA_ADAPTER` can select it.

The model does not block future Promotion Opportunity, supplier submission, store review, ordering, or Betty intelligence entities; those should be additive and remain outside Phase 0.

## Intentionally deferred inventory

- Campaign publish/store release: review is available; the publish action is visibly disabled.
- Arbitrary monthly-flyer spreadsheet import: visibly unavailable.
- Production Supabase persistence and migrations.
- Supplier intake, opportunity ranking, store review, automated ordering, performance intelligence, and autonomous decisions.
- Floorplan pan/zoom: the current canvas does not implement either, so layer changes have no viewport state to reset.

## Validation expectations

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`. Repository tests cover campaign persistence and rollback plus default, adjustment, reset, bulk reset, cross-store isolation, store selection, and reload behaviour. Browser tests cover create/reopen/edit/refresh, constrained spreadsheet import, layer controls, and campaign allocation navigation.
