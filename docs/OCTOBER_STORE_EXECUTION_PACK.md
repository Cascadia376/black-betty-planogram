# Store manager execution packs

Current behaviour: 21 September 2026 hardening branch. Packs support ordinary campaigns and OND; OND-only month controls are not shown for other campaign types. [Release gate](PRODUCTION_GATE.md).

## Buyer-to-store handoff

From Campaign Review select a participating store and open its current **draft** pack. Confirm the approved products, exact SKUs, physical display, dates, cases, explicit minimum facings, signage and store instructions. Unresolved data stays visible. A partial workbook import does not mean that all source rows were accepted.

Resolve blockers in the appropriate Products/Displays/Stores step. Finalize the store release. Open **Release N: Store pack**, then print/share that specific copy manually. Printing does not submit orders, send messages, grant a manager account or record completion.

Routes:

- Current planning copy: `/campaigns/:campaignId/stores/:storeId/pack`
- Released copy: the same route with `?release=<releaseId>`
- OND month overlay: add `month=OCT`, `NOV` or `DEC`; preserve the release parameter.

## What the manager receives

The full source floor map highlights approved locations. Each display has its own setup sheet: store/campaign/release identity, physical code/name, setup/removal dates, signage, store notes, SKU/product list, case quantities and supplied minimum facings. A paper checklist records what to inspect and provides completed-by/date space. This checklist is intentionally not presented as saved system execution data.

Shelf-supported products use their regular category home. Missing quantities, unknown categories, inactive/pending records, unverified areas, rotating flyer slots without a confirmed SKU list and conflicting instructions remain explicit exceptions. Product names are not used as a substitute for exact SKU identity. Manager notes are resolved against the same store's source rows, not borrowed from another store.

Case quantities are case guidance. The historical `minimumQuantity` display field is a campaign **case default**, not a bottle/unit arrangement. No unit conversion or shelf position is fabricated. Use minimum facings only when supplied.

The OND floor map stays constant across month navigation. A monthly order plan is promotional case intent from the workbook's LTO Month metadata, not an order submitted to a supplier. Flyer flags alone do not imply an LTO month.

## Draft and release integrity

Drafts always state **DRAFT - buyer review required**. They can change when the plan is edited and must not be described as approved just because no blockers are visible.

New releases freeze the campaign's instructions, product attributes, allocations, layout metadata and normalized display geometry. Later edits do not change those records. Identical repeated publication does not duplicate releases. Changed content creates a new version and labels the older copy superseded.

Map image URLs are stored with the release but binary images are not archived. Preserve the source image or retain the generated PDF for a fixed visual copy. Legacy releases lacking full execution data display an explicit unavailable message; today's unpublished data is never substituted under an old release number.

## Print and screen checks

Letter portrait, 0.45-inch margins, full map, one display setup per page, repeated table headers, readable case columns and no app navigation. Supporting shelf/month/exception sections flow together to avoid needless nearly-empty pages. The print button waits for the main map to load; map failure is explicit. Mobile controls wrap without horizontal page overflow.

`tests/e2e/october-execution.spec.ts` generates a synthetic Crown Isle PDF and tests Port Alberni differences, source exceptions and month navigation. `tests/e2e/buyer-release.spec.ts` creates a campaign through the UI, supplies products/guidance, selects a store/location, publishes/reopens, checks mobile width and verifies that later edits do not alter the released copy. Tests use synthetic catalog products with real supplied reference maps, not a production buyer release. Final evidence is recorded in [the hardening log](HARDENING_RUN_2026-09-21.md).
