# Legacy OND Allocation Import v1

This adapter supports one explicit Cascadia OND allocation workbook layout. It is not a general spreadsheet importer.

## Workbook contract

The first worksheet must use these headers in this exact order:

1. `Program`
2. `Store`
3. `Display #`
4. `SKU`
5. `Product`
6. `Case Qty`
7. `Vendor`
8. `Start Date`
9. `End Date`
10. `Reset Date`
11. `Promo Notes`

One row represents one product allocated to one store display for one date range. Rows sharing store, display, start date, end date, and period become one `DisplayAssignment` with multiple `DisplayAssignmentProduct` records.

## Validation

- Program must exactly match the selected program.
- Store must match a known store name or code.
- Display number must identify exactly one persistent display at that store.
- SKU must exist in the known OND product set, and Product must match its recorded name.
- Case quantity must be a positive whole number.
- Vendor must match a known supplier name or code.
- Dates must be ISO `YYYY-MM-DD` text or actual Excel date cells.
- Reset Date must match the reset configured for the applicable program period.
- A date mentioned only in Promo Notes is flagged and never inferred.
- Duplicate products for the same assignment are rejected.

Any warning or error blocks approval. The workbook must be corrected and uploaded again; ambiguous rows are never silently imported or partially applied.

## Output and persistence

The adapter normalizes approved rows into `MerchandisingProgram`, `DisplayAssignment`, `DisplayAssignmentProduct`, and `SupplierProductOption` contracts. The mock repository validates the entire batch before making one localStorage-backed state update.

Annotated Word floorplans are outside this workflow and are not parsed.
