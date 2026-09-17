# Courtenay OND display workbook audit

Source inspected locally on 2026-09-17: `Copy of Courtenay OND Display Spreadsheet 2026 Master.xlsx`. The workbook was read only; it was not copied into this repository and was not imported into production.

## Workbook structure

- Worksheets: one, named `Sheet1`.
- Headers: `Vendor`, `Category`, `INV_NUM`, `Product`, `Display`, `Case QTY`, `Display Notes`.
- Populated source rows: 169 (rows 2–170).
- No formulas and no merged cells were found. The file has normal workbook styles and shared strings only.
- `Case QTY` is blank on all 169 rows.
- `Display Notes` is blank on all 169 rows.

`Sheet1` is not a valid store alias. Although the file name identifies Courtenay, importer behavior intentionally does not infer a physical store from a filename. For this validated sample, the buyer explicitly maps `Sheet1` to the existing canonical `Crown Isle` store during review. No Courtenay store is created and no canonical store data is changed.

## Display source values

There are 36 unique values including blank:

`blank`, `BR1`, `BR2`, `BR3`, `BR4`, `BR5`, `BR7`, `BR8`, `BR9`, `BR10`, `BR12`, `BR13`, `M1`, `M2`, `M4`, `M5`, `M6`, `M7`, `M8`, `M9`, `M10`, `M11`, `N`, `SEASONAL TABLE`, `W1`, `W2`, `W3`, `W4`, `W5`, `W6`, `W7`, `W8`, `W9`, `W10`, `W11`, `W12`.

- Blank Display rows: 3 (119, 135, 163).
- Raw `Display = N` rows: 19 (50–53, 114, 121–124, 133–134, 140–141, 144–147, 150, 170).
- `N` is a temporary source marker only. It has no merchandising meaning, is surfaced as needing cleanup, and blocks Apply until it is removed or replaced in the source workbook. It is never persisted as campaign state.
- `SEASONAL TABLE` is retained as a source value and requires physical-display review unless a matching local DisplayArea exists for the selected store.

## Product source values

- Rows without `INV_NUM`: 10 (3–5, 14, 17–18, 92–93, 114–115).
- Duplicate `INV_NUM` values: none.
- Repeated product names: `Captian Morgan Spiced 750ml` (2), `Diabolica Red` (2), `Rotating Flyer Sku(s)` (4), and `Smirnoff 750ml` (2).

Rows without an SKU and unmatched SKU rows are retained as campaign-only pending products. Exact SKU matching is the only Product Master reconciliation method; there is no fuzzy name matching and no automatic Product Master creation.

## Dry-run reconciliation report

| Measure | Count | Interpretation |
| --- | ---: | --- |
| Total source rows | 169 | Retained in review |
| Store sheets resolved | 1 after review mapping | Buyer maps `Sheet1` to canonical `Crown Isle` |
| Unknown store-sheet rows | 0 after review mapping | No new store is created |
| Raw `N` rows | 19 | Temporary source markers; Apply is blocked until cleaned |
| Blank-display rows | 3 | Retained as unresolved display interpretation |
| Invalid Case QTY | 0 | All cells are blank, which remains unspecified rather than zero evidence |
| Non-empty display notes | 0 | No note conflicts in this workbook |
| Product Master matched active/inactive/pending counts | Not run | Requires a reviewed Product Master session and an explicit store-sheet mapping; no production import was attempted |
| Resolved physical display assignments | 0 | Store is deliberately unresolved |

The importer calculates active, inactive, pending, invalid, unresolved-display, and note-conflict counts in its review screen once the buyer maps the worksheet to a canonical store. It never uses the workbook filename for this decision.

## Source precedence

The consolidated OND workbook remains authoritative for campaign assortment, LTO month, and campaign-level promotion metadata. The store-display workbook supplies store-specific display source values, optional case quantity, and display notes. It does not overwrite LTO months. Where it overlaps with a store allocation, the reviewed store workbook case quantity is the store-level planning value; the source provenance is retained for both imports.

## Confirmed source rule

`N` is Jeremy’s temporary note-to-self placeholder, not a business state. It must be removed or replaced in the production workbook before Apply; buyers can see exactly which rows need cleanup during review.
