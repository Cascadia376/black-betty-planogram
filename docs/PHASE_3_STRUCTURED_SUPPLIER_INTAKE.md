# Phase 3 — Structured supplier intake

## Purpose and boundaries

Phase 3 turns a structured supplier XLSX submission into merchant-reviewable promotion opportunities. The three records are deliberately separate:

- `SupplierSubmission` is the received source and its import identity.
- `PromotionOpportunity` is normalized supplier evidence linked to Product Master where possible.
- `Campaign` remains a downstream execution plan and is never created by this import.

Phase 3 does not rank opportunities, create displays or store allocations, order product, or publish execution work.

## Source and field authority

`SupplierSubmissionImportV1` is the only supported format. The workbook is supplier evidence. `ursus_major.public.product`, accessed through the existing read-only `ProductMasterLookup`, remains authoritative for product identity, name, and category. Exact normalized SKU is the only automatic match. Supplier product names, descriptions, categories, terms, claims, and notes remain separately visible and never overwrite Product Master.

Blank, TBD, compound, unmatched, and ambiguous SKUs create `NEEDS_REVIEW` opportunities. Product name is supporting evidence only. See [the template specification](./SUPPLIER_SUBMISSION_TEMPLATE.md).

## Parse, review, Apply

1. Parse reads XLSX, validates the known header contract, hashes the workbook, and performs batched exact-SKU lookup. It does not mutate repository state.
2. Review shows submission facts, all normalized rows, source issues, and filters for supplier, category, status, month, flyer request, and display request. Clean rows are `READY_FOR_REVIEW`; issue rows are `NEEDS_REVIEW`.
3. Apply requires an explicit click and issue acknowledgement. It atomically creates one `SupplierSubmission` retaining every source row and creates `PromotionOpportunity` records only for eligible `READY_FOR_REVIEW` rows. Blocking and exact-duplicate rows are skipped as actionable opportunities without losing provenance. A failed Apply restores the previous state.

Apply creates no Campaign, CampaignDisplay, DisplayAssignment, store allocation, order, purchase order, execution task, or published program.

## Statuses and merchant decisions

- `NEW`: parsed but not yet reviewed (available for future workflows).
- `NEEDS_REVIEW`: unresolved identity or validation issue.
- `READY_FOR_REVIEW`: sufficiently complete for merchant evaluation.
- `APPROVED`: Jeremy wants to carry the opportunity forward.
- `PASSED`: Jeremy declined it.
- `DEFERRED`: retained for a later planning window.

The `/opportunities` workspace supports supplier/category/month/status/flyer/display filters, Approve, Pass, Defer, and a human-authored Jeremy comment. Approval does not create a campaign. Comments are stored as evidence and are not scored or interpreted.

## Provenance, duplicates, and revisions

Every opportunity retains workbook name, SHA-256, sheet, row, original cell values, normalized values, import timestamp, Product Master match method, and issues. Raw workbook binaries are not persisted.

Replay identity is schema version + workbook SHA-256 + normalized supplier + proposed submission period. Reapplying the same source is blocked. Opportunity identity is not SKU-only: the same SKU with different periods or commercial terms is preserved. An exact repeated proposal row is retained in submission provenance, flagged, and skipped so it does not create a second actionable opportunity. A changed workbook hash creates a new submission version; earlier evidence and merchant decisions are not overwritten.

## Persistence and security

Phase 3 uses the existing mock/localStorage merchandising repository. No Supabase tables, writes, migrations, service-role credentials, or RLS changes are introduced. Product reconciliation remains the narrow browser-safe read of `ursus_major.public.product` using existing publishable/anonymous credentials and RLS.

A future shared-persistence phase should add `supplier_submission` and `promotion_opportunity` tables plus immutable row-provenance storage. It must define authenticated merchant roles, SELECT/INSERT/UPDATE RLS policies, audit ownership, and explicit Data API exposure before enabling mutations.

## Limitations and future Betty enrichment

- XLSX only; no supplier portal, email/deck extraction, or fuzzy header/product matching.
- One known Cascadia template; mixed-supplier files are visible as `Multiple suppliers` and should be corrected upstream.
- Problem rows can be retained for review, but the prototype does not offer inline workbook correction.
- No AI score, sales/margin/inventory enrichment, supplier reliability, or recommendation engine.

The additive opportunity structure can later hold enrichment and evidence references without replacing original supplier evidence or Jeremy's decision.

## Manual test script

1. Open **Spreadsheet imports → Supplier promotion submission**.
2. Upload a sanitized template containing one exact SKU and one blank/unmatched SKU.
3. Confirm Product Master identity/category appear only for the exact SKU and both original supplier values remain visible.
4. Filter by supplier, category, status, promotion month, flyer request, and display request.
5. Confirm Apply is gated until issue rows are acknowledged.
6. Apply and verify `/opportunities` shows both records; no campaign appears.
7. Approve, Pass, and Defer an opportunity; save a Jeremy comment; reload and verify persistence.
8. Upload the identical file again and confirm replay is blocked.
9. Change a commercial term and re-upload; confirm a new submission version is retained.
