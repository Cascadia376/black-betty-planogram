# Cascadia supplier submission template — `SupplierSubmissionImportV1`

## Workbook rules

- File type: `.xlsx`.
- The first worksheet whose first row contains the required known headers is used.
- Row 1 is the header row; data begins on row 2.
- Required headers: `Supplier`, `SKU` (or `INV_NUM`/`INV NUM`/`INV NUMBER`), and `Product` (or `Product Name`).
- Header case, surrounding whitespace, underscores, and hyphens are normalized. Only the aliases below are recognized; semantic/fuzzy guessing is not used.
- Blank optional cells are allowed. Completely blank rows are ignored.
- Dates must be native Excel dates or `YYYY-MM-DD`. Money and quantities must be non-negative numbers; case/count quantities must be whole numbers.

## Columns

| Column | Required | Known aliases | Meaning |
|---|---:|---|---|
| Supplier | Yes | — | Supplier making the proposal |
| Supplier Contact | No | Contact | Human contact as supplied |
| Submitted At | No | Submission Date | Submission date |
| SKU | Yes for automatic match | INV_NUM, INV NUM, INV NUMBER | Exact Product Master key |
| Product | Yes | Product Name | Supplier-provided product name/evidence |
| Supplier Description | No | Product Description | Supplier wording |
| Vendor | No | — | Vendor label if distinct from supplier |
| Category | No | — | Supplier category; never overrides Product Master |
| Promotion Start / End | No | Promo Start / End | Proposed window |
| LTO | No | LTO Amount | Wholesale LTO amount |
| TPR | No | — | Supplier-provided TPR information/code |
| Proposed Retail | No | Retail | Proposed shelf/sale retail |
| Flyer Month | No | Flyer Request | Requested flyer timing |
| Promotional Mechanic | No | Promotion Mechanic | Proposal mechanic |
| Points | No | Points Request | Loyalty-points request metadata |
| Case Commitment | No | — | Proposed committed cases |
| Minimum Order | No | Min Order | Minimum cases/order |
| Preorder | No | Pre-order | Yes/No preorder requirement |
| Display Support | No | — | Supplier display support |
| Display Requested | No | Display Request | Yes/No request only; never a placement |
| Display Family | No | — | Wine, Beer/RTD, Multi, Seasonal, Window, Other |
| Display Count | No | — | Requested count, not a physical assignment |
| Placement Notes | No | Display Notes | Supplier placement request/evidence |
| Marketing Support | No | — | Marketing commitment |
| Supplier-Funded Support | No | Supplier Funded Support | Funding/support evidence |
| Assets Available | No | — | Yes/No assets indicator |
| Sample/Tasting Support | No | Sample Support, Tasting Support | Sampling support |
| Available Quantity | No | — | Supplier-stated available quantity |
| Availability Date | No | Available From | Availability date |
| Distribution Constraints | No | Availability Restrictions | Distribution limits |
| Stores/Regions | No | Stores or Regions | Explicit eligible geography |
| Rep Claims | No | Claims | Supplier representative claims |
| Notes | No | Additional Notes | Supplier notes |
| Raw Text | No | — | Relevant source text retained as evidence |

Unknown columns are retained in row `sourceValues` provenance but do not populate normalized fields. Do not place confidential real submissions in repository fixtures.
