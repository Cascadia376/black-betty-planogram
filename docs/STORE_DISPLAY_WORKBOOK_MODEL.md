# Store-display workbook model

## Ownership

The store-display workbook changes campaign planning only. It can create campaign displays, campaign display assignments, assignment products, campaign-store allocations, and campaign import evidence. It never writes `StoreLayout`, `CategorySpace`, `DisplayArea`, sections, fixtures, zones, or canonical geometry.

`CampaignDisplayAssignment.executionNotes` is the one shared display-build note for a campaign/store/display assignment. If source rows have identical non-empty notes, they collapse to one value. Distinct non-empty values set `hasConflictingExecutionNotes` and require a buyer edit before release.

## Product resolution

Each campaign product records one of `MATCHED_ACTIVE`, `MATCHED_INACTIVE`, `PENDING`, or `INVALID`. A pending row receives a campaign-only planning product projection, never a Product Master record. That projection is eligible for display membership and store allocation. Later reconciliation requires the exact supplied SKU and rewrites only the campaign relationships to the verified Product Master identity; placement, cases, notes, and provenance remain intact.

## Display interpretation

Blank display cells are retained as `UNRESOLVED`; they neither produce a fake display build section nor imply shelf support. A buyer can later create/select a real campaign display and physical DisplayArea, or explicitly set shelf support. Only the latter puts an item on the shelf-support section of the store package.

`N` is different: it is a temporary source-only marker with no domain meaning. It is displayed as needing cleanup and blocks Apply. It is neither persisted as `UNRESOLVED` nor converted into shelf support, no display, or new product.

## Source precedence

Campaign-level OND import owns assortment and LTO months. Store-display import owns store-local display source values, case quantity, and display notes. It does not alter month eligibility or physical geometry.
