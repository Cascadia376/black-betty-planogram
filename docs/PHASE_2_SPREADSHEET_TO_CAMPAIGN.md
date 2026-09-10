# Phase 2: Spreadsheet to Campaign

## Objective

Convert Jeremy's known merchandising workbook workflow into a reviewed, structured draft campaign that uses the verified Phase 1 store and DisplayArea model. Upload is read-only until the user explicitly selects Apply.

## Sources reviewed

### 09 September Flyer 2026.xlsx

- One visible sheet: `September Flyer`, `A1:K75`.
- Product rows are 2-65; rows 66-75 contain blanks and giveaway information.
- Columns: Vendor, an unlabeled category column, SKU, Product, Selling Price, Savings, Sale Price, Size, Points, LTOs, Additional Notes.
- The 64 product SKUs were complete and unique in this workbook.
- Sale Price is formula-derived as Selling Price minus Savings.
- LTO is a wholesale per-unit amount and must not drive retail pricing.
- `NA` means the product is not on an LTO.
- `TPR` codes describe multi-month temporary price reductions. The following letters are month initials.
- Points is a loyalty multiplier retained as informational metadata.
- Preorder and handling notes are operational metadata and do not affect price.
- The campaign covers the first through last day of the month named in the workbook.

### OND 2025 Worksheet Final - Jay Copy.xlsx

- One visible sheet: `Sheet1`, `A1:AC232`.
- 231 candidate product rows.
- Core columns: Vendor, Category, INV_NUM, Product, Order From, LTO Month, Display, Oct Flyer, Nov Flyer, Dec Flyer, Notes.
- Store columns contain case quantities. Blank store cells mean zero/no allocation.
- `Total Cases` is not authoritative; totals are recalculated from store cells.
- Broken `Total $$$` and unlabeled auxiliary columns are not imported.
- The individual store workbooks in `OND_2025_source_workbooks.zip` were store-distribution outputs, not primary inputs.

The two June 2026 capacity workbooks remain physical-model references only. They are not campaign inputs.

## Supported workbook contract

`FlyerWorkbookImportV1` has format id `flyer-workbook-import-v1` and detects two known shapes.

### Flyer product shape

The audited flyer columns are recognized positionally and by known headers. It produces campaign products and promotional metadata but no store allocations or physical placements.

### Consolidated campaign-planning shape

Required leading columns are:

```text
Vendor | Category | INV_NUM or SKU | Product
```

Known planning columns are located by header, so Jeremy may add `Display Area` without relying on a fixed column position. Recognized store columns contain non-negative whole case quantities.

Recommended 2026 additions:

```text
Display | Display Area
```

`Display Area` contains a cross-store local code such as `W8`, `BR2`, or `M4`. The importer expands that concept separately for every participating store.

## Normalization rules

- Trim whitespace and non-breaking spaces from identifiers.
- Uppercase SKU and display codes for comparison.
- Preserve the original source file, sheet, row, source cells, labels, and normalized issues.
- Treat blank store cells as zero. Zero allocations are omitted from the normalized positive-allocation list.
- Accept only non-negative whole case quantities.
- Recalculate allocation totals from store cells.
- Retain selling price, sale price, savings, wholesale LTO, TPR code, loyalty multiplier, vendor, size, and notes as import metadata.
- Giveaway/non-product rows remain visible as information and are excluded from campaign products.

## Product reconciliation

Exact active Product Master SKU is the only authoritative automatic product match. Product names are supporting evidence only. The production Product Master authority is Supabase; the current prototype uses whichever Product Master snapshot the active repository provides.

Duplicate, blank, compound, unknown, or inactive SKUs are not silently matched. They remain visible in review and are skipped only after the user explicitly acknowledges the skipped-row count.

## Store reconciliation

Store matching is deterministic. The currently approved aliases are:

- Courtenay to Crown Isle
- Colwood to Hatley Park
- Nanoose Bay to Nanoose

Blank allocations mean the product has no case allocation at that store. Unknown stores are never created by import.

## Display reconciliation

A spreadsheet display code is a reusable campaign display concept, not a physical DisplayArea id.

For every participating store and imported display concept:

1. Match the local code exactly within that store.
2. Automatically assign an active verified exact match.
3. If the code is missing, suggest an unused same-family area.
4. Otherwise suggest an unused Multi/flexible area.
5. Otherwise suggest another unused area as an explicit cross-category repurposing review.
6. If no area remains, keep the placement in Needs Review.
7. If none of that display's products has a positive allocation at the store, mark the display Excluded there.

Alternative and cross-category placements are suggestions only. The user must accept them. Selecting Optional / no display resolves the store placement as excluded without removing the campaign product or its source allocation.

## Quantity semantics

Consolidated store matrix values are cases. They populate store-specific `CampaignDisplayAssignmentProduct.caseQuantity` with source `SPREADSHEET`. The importer does not treat them as units, facings, capacity, or a campaign-wide default.

Flyer pricing, LTOs, and points do not populate case quantities.

## Cooler-door findings

The audited cooler-door workbook represents persistent physical capacity/category information, not monthly campaign allocation. It remains part of the Phase 1 physical model and is not parsed by `FlyerWorkbookImportV1`.

## Review workflow

The import page shows:

- detected workbook kind and sheets;
- suggested, editable campaign name and dates;
- product counts and exact matches;
- unmatched, duplicate, invalid, and informational rows;
- participating stores and quantity coverage;
- exact display mappings and per-store exceptions;
- metadata and source-row issues;
- the exact number of rows that Apply will skip.

After Apply, store placement opens in the store-first, Needs Attention view. Each exception can accept a suggestion, choose any active physical area, be marked optional/no display, or remain unresolved.

## Apply and idempotency

Apply creates one draft campaign transactionally:

- campaign products;
- campaign display concepts;
- product/display membership;
- participating stores;
- exact, suggested, excluded, and unresolved store placements;
- store-specific case quantities;
- store/SKU case intent independent of physical display placement;
- normalized provenance metadata;
- one SHA-256 workbook fingerprint.

Nothing is published. Any validation or persistence failure restores the prior repository state. Reapplying a fingerprint already recorded in `campaignImports` is rejected.

Raw workbook binaries are never stored in localStorage.

## Known limitations and deferred work

- The Supabase merchandising repository remains intentionally disabled; Phase 2 does not introduce a database migration.
- The prototype cannot match real flyer SKUs unless its active repository supplies the authoritative Product Master rows.
- Current workbooks do not provide UPCs.
- Product names are not used as authoritative fallbacks.
- Physical capacity is not automatically calculated from case quantities.
- Cross-category suitability requires human approval.
- TPR accumulation is retained as metadata; it does not drive retail price.
- Publishing, supplier submissions, automated ordering, and autonomous fuzzy matching remain out of scope.

## Jeremy manual test (10-15 minutes)

1. Open **Imports** and choose **Import workbook**.
2. Upload a representative `.xlsx` workbook.
3. Confirm the detected type, sheet, campaign name, and dates.
4. Confirm known SKUs show Ready and unresolved SKUs remain visible.
5. Filter the review to Unmatched and verify no product was guessed by name.
6. Review vendor, price, LTO, points, preorder, and notes metadata.
7. For a consolidated workbook, filter by store and confirm case totals use positive store cells only.
8. Confirm a local display code maps to the corresponding verified code at a store that has it.
9. Confirm a smaller store missing that code shows a suggestion or Needs Review.
10. Acknowledge skipped rows, if any, and select **Apply and create draft campaign**.
11. Confirm the app opens the store-first Needs Attention view.
12. Accept one same-family suggestion or select another physical area.
13. Mark one exception Optional / no display.
14. Open an assigned placement on its real floorplan and confirm its location.
15. Review quantities and confirm they are labeled as store adjustments/cases.
16. Refresh and confirm the imported draft persists.
17. Return to Imports, upload the identical workbook, and confirm duplicate Apply is blocked.
18. Open Campaign Review and confirm publishing has not occurred.
