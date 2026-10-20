# OND 2026 release verification — 20 October 2026

The buyer confirms that a real multi-store OND campaign was created and released to stores. That successful operational milestone is accepted. This review checks what the accessible persisted records substantiate; it does not require repeating earlier readiness phases or re-running the campaign.

## Evidence and scope

Read-only inspection used the authorized Supabase management connector against `ursus_major` (`wobndqnfqtumbyxxtojl`), the independent planning/physical singleton documents, Product Master `public.product`, catalog/schema/policy metadata, and Vercel project/deployment metadata. All database statements were SELECTs. No migration, role change, campaign save, release publication, physical edit, store notification or order was performed.

Repository main is `ee1c26973be8870ce3b9db3c1f1923cce5d13d6e`. GitHub confirms PR #12 merged on 2 October at 02:38:07Z. PR #10/#11 remain open historical proposals whose implementation was reconciled into #12; they were not merged or duplicated. Vercel production deployment `dpl_3iTokQpcxdW4CUJbi27pK9qWED89` is READY, created 2 October at 02:38:11.186Z, target production, main at the same commit. Public alias: `https://black-betty-planogram.vercel.app`.

Planning version **26**, updated **23 September 21:47:17.095748Z**, contains ten campaigns and one campaign release. Physical version **313**, updated **18 September 23:41:48.232696Z**, contains 301 display areas, 13 layouts, 931 category spaces and two display-area sections. Repeat inspection during development found these same versions and timestamps. Release-array MD5 for subsequent non-security integrity comparison: `1feb5441964c394adf91439737f1f8e9`.

These are real shared records, not local seed/demo test results. The application also supports browser-only state; no buyer browser storage, authenticated buyer browser session or archived distributed PDF was available. The database evidence therefore does **not** uniquely establish that its one release is the operational copy the buyer describes. A filename containing `TEST` is not by itself proof that a buyer's workbook was synthetic.

## Identified records

| Record | Identity and persisted facts |
| --- | --- |
| Accessible released campaign | `4b23def0-ccba-4a60-b8c1-585a7609c80b`, **OND 2026**, owner Jeremy, 1 October–31 December 2026, scheduled, 123 campaign products |
| Release | `533b3deb-3e34-4bae-b41b-98978ceb92c3`, version **1**, published, recorded `2026-09-24T16:00:00.000Z`; no other release version exists in this document |
| Release membership | 12 included stores, each marked READY; store IDs end in `000001` through `000012` in the `10000000-0000-4000-8000-*` reference namespace |
| Released execution payload | Zero displays, zero display products, zero allocations, zero allocation products; **no `executionData`** and no displayAssignmentIds |
| Most specifically named planning copy | `f8b48965-66b3-4475-9776-2b6b72469c86`, **Cascadia OND 2026 Display Final**, draft, same date range, 162 products, 12 stores, 275 placement records and 970 store-product allocations |
| Other planning copies | `4b433f9d-31be-4b59-a135-5022898e435d` (**OND 2026 Final**, draft, 162 products) and `7a7b834d-d12d-4b63-bdfb-910a2c9f2340` (**OND 2026**, draft, 290 products) also have 275 placements. Names do not establish which draft is intended for future use. |

The recorded publication/import time is later than the enclosing planning row's updated_at, and multiple imports share that exact business timestamp. Earlier code used a fixed demo business clock. Consequently these embedded timestamps establish **recorded values**, not independently verified wall-clock release or distribution time. No timestamp was corrected.

## Participating stores and draft quantities

Names below resolve the shared membership IDs through the repository's supplied physical-reference store directory. Quantities are sums of saved store-product case guidance in the **Display Final draft**, not reconstructed released quantities, purchase orders or physical inventory. Repeated allocation rows can belong to separate displays; these are row counts, not distinct SKU counts.

| Store / ID suffix | Allocation rows | Draft cases |
| --- | ---: | ---: |
| Crown Isle / 000001 | 137 | 1,177 |
| Eagle Creek / 000002 | 124 | 762 |
| Allandale / 000003 | 37 | 196 |
| Caddy Bay / 000004 | 16 | 76 |
| Hatley Park / 000005 | 52 | 272 |
| Langford / 000006 | 123 | 882 |
| Nanoose / 000007 | 87 | 474 |
| Parksville / 000008 | 83 | 414 |
| Port Alberni / 000009 | 24 | 157 |
| Quadra / 000010 | 101 | 514 |
| Royal Bay / 000011 | 95 | 616 |
| Uptown / 000012 | 91 | 529 |

## Targeted findings

| Check | Evidence source | Result | Operational impact | Necessary before future campaigns? |
| --- | --- | --- | --- | --- |
| Campaign/release persisted; release references its campaign and version 1 | Shared campaignReleases and campaigns | **Pass** | Header, assortment and 12-store membership are recoverable. | No recreation needed. |
| Match accessible release to the actual distributed operational copy | Shared records vs buyer's confirmation; no distributed pack/session provided | **Unverified** | Multiple similarly named drafts and a legacy release prevent a definitive identity match. | Obtain the actual pack's campaign/release identity and archive location; do not republish to discover it. |
| Production code includes reconciled reliability work | GitHub #12 merge and Vercel deployment SHA | **Pass** | Current deployment is the consolidated main, not an obsolete PR. | No historical reimplementation. |
| Included stores represented | Frozen membership; shared draft scopes; physical reference IDs | **Pass** for 12 saved memberships; **Unverified** against distributed packs | No missing member in the saved release list; physical execution is separate. | Confirm the actual distributed store list when matching the pack. |
| Frozen product identity integrity | Release's 123 product IDs joined to planning catalog and exact normalized public.product SKU | **Pass** for current identity matches | All 123 have saved catalog projections; zero pending, zero inactive in those projections, zero unmatched authoritative SKUs. Current catalog is not a historical frozen product snapshot. | Keep normal future release validation. |
| Recover immutable historical store instructions | Release snapshot; `snapshotForRelease` contract | **Fail — legacy data limitation** | Execution data is absent. Current code intentionally returns unavailable instead of rendering current draft geometry/products under version 1. Reliable historical map/product/quantity retrieval is not supported by this record. | Locate retained distributed PDFs/images/source files; preserve originals. Do not backfill history from a current draft or change the legacy release. |
| Released store quantities and display references | Empty release allocation/display arrays and no frozen executionData | **Unverified** | Header does not prove correct display/case instructions were frozen. | Check retained original pack. Current new-release freezing is already implemented/tested in #12. |
| Current Display Final assortment | Shared draft products joined to saved catalog projections | **Fail — draft outstanding work** | 135 verified and 27 pending products; zero store-product allocation rows outside included store scope. | Resolve pending identities if this draft is reused; do not replace buyer decisions automatically. |
| Current Display Final placements | Shared campaignDisplayAssignments joined to physical areas | **Fail — draft outstanding work** | Of 275 placement records, two lack an area, 39 reference unverified areas, two have conflicting execution notes; zero assigned areas missing/inactive; zero repeated non-null area references within a store. These are draft findings, not defects proven in a distributed pack. | Resolve only if this draft will be used again; preserve buyer decisions and canonical layout identities. |
| Saved case arithmetic | 970 Display Final store-product allocations | **Pass** for non-negative whole cases | Zero negative/fractional saved case counts. Source-to-pack quantities remain unverified. | Buyer reconciliation against original source remains useful; no automatic changes. |
| October/November/December intent | Release product keys; import row metadata | **Unverified** | Release products have no frozen month fields. Its 143 import rows contain a flyerMonths key but no populated month values; Display Final's 1,029 store-sheet rows have no month fields. Flyer flags cannot establish an LTO month. | Confirm explicit source LTO-month evidence for future campaigns; do not infer or backfill. |
| Import provenance retained | Shared campaignImports | **Pass** for provenance; **Unverified** for complete acceptance | Released campaign import `1292a097-4329-4be4-8de2-63ee7cd8c0ac`, 143 rows, 21 with issues; Display Final import `6729022f-b3a6-44ca-8b39-52b7feea93df`, 1,029 rows, 168 with issues. Exceptions remain visible. | Review meaningful unresolved rows when reusing the plan; do not assume every source row applied. |
| Representative workbook vs released pack | Workbook filename/hash only; no original workbook or reliable frozen pack available | **Unverified** | Direct row/SKU/case/map reconciliation cannot be completed. | Obtain one retained workbook and the corresponding distributed PDF for a targeted comparison. |
| Email delivery, manager acknowledgement, floor execution | No authorized delivery/acknowledgement/inspection record inspected | **Unverified — operational evidence** | Application publication proves none of these actions. | Operational owner retains evidence as appropriate. No engineering email/acknowledgement claim. |

Import filenames are recorded as `Black_Betty_OND_Store_Display_MASTER TEST.xlsx`. The released campaign's fingerprint is `b3d2b6c7e4054ab5c54b260c8f58ec83d4b904145acf9dedb8a90d03bac541c9`; Display Final's fingerprint is `43d390cccd7a472a6f709888ef0dbe5314dc6ad2407caf64a4f4a30dd5d0e684`. Their differing row contracts/fingerprints must not be treated as interchangeable revisions of a frozen released pack.

## Engineering decision

No historical campaign, release or floorplan was repaired, regenerated or republished. Existing #12 code already freezes new releases and fails closed for incomplete legacy ones. A synthetic regression matching the observed legacy shape confirms that behaviour; it does not convert the actual release into a pass. Outstanding recovery/identity work is material but independent of Promotion Intelligence. Proceed with the new intake-to-draft slice while the buyer identifies the retained operational pack.

Read-only query strategy was: select document versions/counts; enumerate campaign/release headers; inspect frozen collection counts; join exact product identities; aggregate store allocation arithmetic and placement exceptions; inspect provenance/month keys and policy/schema metadata. Raw production documents, correspondence and confidential commercial terms were not committed into this repository.
