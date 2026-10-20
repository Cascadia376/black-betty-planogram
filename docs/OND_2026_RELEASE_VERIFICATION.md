# OND 2026 release verification — 20 October 2026

The buyer confirms that a real multi-store OND campaign was created and released to stores. That successful operational milestone is accepted. This review checks what the accessible persisted records substantiate; it does not require repeating earlier readiness phases or re-running the campaign.

## Evidence and scope

Read-only inspection used the authorized Supabase management connector against `ursus_major` (`wobndqnfqtumbyxxtojl`), the independent planning/physical singleton documents, Product Master `public.product`, catalog/schema/policy metadata, and Vercel project/deployment metadata. All database statements were SELECTs. No migration, role change, campaign save, release publication, physical edit, store notification or order was performed.

Repository main is `ee1c26973be8870ce3b9db3c1f1923cce5d13d6e`. GitHub confirms PR #12 merged on 2 October at 02:38:07Z. PR #10/#11 remain open historical proposals whose implementation was reconciled into #12; they were not merged or duplicated. Vercel production deployment `dpl_3iTokQpcxdW4CUJbi27pK9qWED89` is READY, created 2 October at 02:38:11.186Z, target production, main at the same commit. Public alias: `https://black-betty-planogram.vercel.app`.

Planning version **26**, updated **23 September 21:47:17.095748Z**, contains ten campaigns and one campaign release. Physical version **313**, updated **18 September 23:41:48.232696Z**, contains 301 display areas, 13 layouts, 931 category spaces and two display-area sections. Repeat inspection during development found these same versions and timestamps. Release-array MD5 for subsequent non-security integrity comparison: `1feb5441964c394adf91439737f1f8e9`.

These are real shared records, not local seed/demo test results. The application also supports browser-only state; no buyer browser storage or authenticated buyer browser session was available. Subsequent authorized parent-thread Outlook/SharePoint research recovered distributed PDFs and a representative master (bounded evidence below). Those PDFs identify the Display Final draft, **not** the one persisted CampaignRelease. Operational distribution and immutable application publication are distinct facts. A filename containing `TEST` is not by itself proof that a buyer's workbook was synthetic.

## Identified records

| Record | Identity and persisted facts |
| --- | --- |
| Accessible released campaign | `4b23def0-ccba-4a60-b8c1-585a7609c80b`, **OND 2026**, owner Jeremy, 1 October–31 December 2026, scheduled, 123 campaign products |
| Release | `533b3deb-3e34-4bae-b41b-98978ceb92c3`, version **1**, published, recorded `2026-09-24T16:00:00.000Z`; no other release version exists in this document |
| Release membership | 12 included stores, each marked READY; store IDs end in `000001` through `000012` in the `10000000-0000-4000-8000-*` reference namespace |
| Released execution payload | Zero displays, zero display products, zero allocations, zero allocation products; **no `executionData`** and no displayAssignmentIds |
| Identified distributed draft | `f8b48965-66b3-4475-9776-2b6b72469c86`, **Cascadia OND 2026 Display Final**, draft, same date range, 162 products, 12 stores, 275 placement records and 970 store-product allocations |
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
| Match accessible release to distributed copies | Linked Nanoose/Courtenay PDF headers, distribution email and shared campaign IDs | **Fail — identities differ; Pass for identifying distributed draft** | Both PDFs identify `f8b48965-66b3-4475-9776-2b6b72469c86`; the only saved release belongs to `4b23def0-ccba-4a60-b8c1-585a7609c80b`. No saved release exists for the distributed campaign. This does not by itself mean its instructions were wrong. | Preserve the actual distributed PDF/master/flyer package and its provenance. Do not relabel it as release v1 or republish history. |
| Production code includes reconciled reliability work | GitHub #12 merge and Vercel deployment SHA | **Pass** | Current deployment is the consolidated main, not an obsolete PR. | No historical reimplementation. |
| Included stores represented | Frozen membership, draft scope, reference IDs, Nanoose/Courtenay PDF headers | **Pass** for 12 saved memberships and two sampled distributed stores; **Unverified** chain-wide PDF reconciliation | Nanoose maps to store ...0007 and Courtenay contents to Crown Isle ...0001. No missing member in saved scope; actual execution is separate. | Expand document reconciliation only where operationally material. |
| Frozen product identity integrity | Release's 123 product IDs joined to planning catalog and exact normalized public.product SKU | **Pass** for current identity matches | All 123 have saved catalog projections; zero pending, zero inactive in those projections, zero unmatched authoritative SKUs. Current catalog is not a historical frozen product snapshot. | Keep normal future release validation. |
| Recover immutable historical store instructions | Release snapshot; `snapshotForRelease` contract | **Fail — legacy data limitation** | Execution data is absent. Current code intentionally returns unavailable instead of rendering current draft geometry/products under version 1. Reliable historical map/product/quantity retrieval is not supported by this record. | Retained Nanoose/Courtenay PDFs were located; preserve originals and source/master/flyer context. Do not backfill history from a current draft or change the legacy release. |
| Released store quantities and display references | Empty release allocation/display arrays and no frozen executionData | **Unverified** | Header does not prove correct display/case instructions were frozen. | Check retained original pack. Current new-release freezing is already implemented/tested in #12. |
| Current Display Final assortment | Shared draft products joined to saved catalog projections | **Fail — draft outstanding work** | 135 verified and 27 pending products; zero store-product allocation rows outside included store scope. | Resolve pending identities if this draft is reused; do not replace buyer decisions automatically. |
| Current Display Final placements | Shared campaignDisplayAssignments joined to physical areas | **Fail — draft outstanding work** | Of 275 placement records, two lack an area, 39 reference unverified areas, two have conflicting execution notes; zero assigned areas missing/inactive; zero repeated non-null area references within a store. These are draft findings, not defects proven in a distributed pack. | Resolve only if this draft will be used again; preserve buyer decisions and canonical layout identities. |
| Saved case arithmetic | 970 Display Final store-product allocations | **Pass** for non-negative whole cases | Zero negative/fractional saved case counts. Five sampled Nanoose SKU/case/display rows match the supplied master/PDF and current persisted draft; full assortment remains unverified. | Buyer reconciliation against original source remains useful; no automatic changes. |
| October/November/December intent | Release product keys; import row metadata | **Unverified** | Release products have no frozen month fields. Its 143 import rows contain a flyerMonths key but no populated month values; Display Final's 1,029 store-sheet rows have no month fields. Flyer flags cannot establish an LTO month. | Confirm explicit source LTO-month evidence for future campaigns; do not infer or backfill. |
| Import provenance retained | Shared campaignImports | **Pass** for provenance; **Unverified** for complete acceptance | Released campaign import `1292a097-4329-4be4-8de2-63ee7cd8c0ac`, 143 rows, 21 with issues; Display Final import `6729022f-b3a6-44ca-8b39-52b7feea93df`, 1,029 rows, 168 with issues. Exceptions remain visible. | Review meaningful unresolved rows when reusing the plan; do not assume every source row applied. |
| Representative master/PDF/persisted-draft comparison | Parent's read-only Nanoose master/PDF inspection plus exact-SKU shared allocation query | **Pass** for five bounded sampled rows; **Unverified** full pack and immutable release equivalence | Five store/display/case samples agree. Preordered/unknown rows remain unresolved and rotating flyer omissions follow the stated distribution caveat. There is no frozen release for this campaign to compare. | Retain the versioned evidence and clarify remaining instructions; do not turn bounded sampling into a full approval. |
| Distribution notice vs delivery/acknowledgement/execution | Jeremy's sent distribution email and later PO revision email, supplied by parent research | **Pass** for sent linked-package notice; **Unverified** delivery, manager acknowledgement and floor execution | A sent notice linking SharePoint packages supports operational distribution; it does not prove reading, execution or an immutable application release. | Operational owner retains acknowledgement/execution evidence if needed. |

Import filenames are recorded as `Black_Betty_OND_Store_Display_MASTER TEST.xlsx`. The released campaign's fingerprint is `b3d2b6c7e4054ab5c54b260c8f58ec83d4b904145acf9dedb8a90d03bac541c9`; Display Final's fingerprint is `43d390cccd7a472a6f709888ef0dbe5314dc6ad2407caf64a4f4a30dd5d0e684`. Their differing row contracts/fingerprints must not be treated as interchangeable revisions of a frozen released pack.

## Engineering decision

No historical campaign, release or floorplan was repaired, regenerated or republished. Existing #12 code already freezes new releases and fails closed for incomplete legacy ones. A synthetic regression matching the observed legacy shape confirms that behaviour; it does not convert the actual release into a pass. The operational pack identity is now established for two representative exports and differs from the saved release. Full versioned pack/master/flyer reconciliation, later supersession and real-world acknowledgement remain bounded follow-up items independent of Promotion Intelligence. No watermark or source filename alone is treated as proof of incorrect instructions.

Read-only query strategy was: select document versions/counts; enumerate campaign/release headers; inspect frozen collection counts; join exact product identities; aggregate store allocation arithmetic and placement exceptions; inspect provenance/month keys and policy/schema metadata. Raw production documents, correspondence and confidential commercial terms were not committed into this repository.

## Distributed artifacts and bounded reconciliation follow-up

Additional evidence was supplied by the parent thread's authorized read-only Outlook/SharePoint researcher, without duplicating that search here. The database comparisons below were independently run with SELECTs in this coding environment. Parent-reported PDF bytes/version metadata are attributed to that research rather than represented as a second direct download.

- [Original OND Display Package & October Flyer notice](https://outlook.office365.com/owa/?ItemID=AAMkADFjY2U4ZDI3LTA1MjctNDczMS04NjQ0LWJhN2YwOTBlNTljNwBGAAAAAAAijt%2FgZQ9iS6g4tAABv22zBwCRULY4Xh%2F5QalnTQNSUU4iAAAAAAEMAACRULY4Xh%2F5QalnTQNSUU4iAAdGpXlXAAA%3D&exvsurl=1&viewmodel=ReadMessageItem): sent 24 September 00:56:05 UTC (23 September 17:56 local). Packages are **linked SharePoint files**, not attached PDFs. The substantive initial attachment was the revised October flyer workbook.
- [Nanoose display PDF](https://trufflesgroupttg.sharepoint.com/sites/CascadiaMain/Shared%20Documents/Cascadia%20Shared%20Folder%20-%20GMs/Merchandising/2026%20OND%20Display%20Packages/Nanoose/Nanoose%20OND%202026%20Display%20Package.pdf?web=1) and [Courtenay display PDF](https://trufflesgroupttg.sharepoint.com/sites/CascadiaMain/Shared%20Documents/Cascadia%20Shared%20Folder%20-%20GMs/Merchandising/2026%20OND%20Display%20Packages/Courtenay/Courtenay%20OND%202026%20Display%20Package.pdf?web=1): both header identities match campaign `f8b48965-66b3-4475-9776-2b6b72469c86`, title Cascadia OND 2026 Display Final and source Black_Betty_OND_Store_Display_MASTER TEST.xlsx. Both say DRAFT / unresolved exceptions. Routes identify the campaign/store pack, with no release ID identified in the extracted headers. Nanoose export shows 23 September 14:56 local; Courtenay shows 14:48 local. These facts establish draft-export provenance; a watermark alone does not establish incorrect product instructions.
- Parent validated Nanoose's actual file as **27 pages**; the printed final footer reads **27/35**. Do not infer eight missing pages from that printed-total discrepancy. PDF metadata created/modified: 23 September 14:56:31 PDT. SHA-256: `2a514a187f817a6b22776e6fcc5a5ac823d49e36013b5a812b987add07271834`. SharePoint history contains only v1.0, uploaded 24 September 00:15:45 UTC, supporting that the current stored PDF is the original persisted upload.
- [Nanoose master](https://trufflesgroupttg.sharepoint.com/sites/CascadiaMain/_layouts/15/Doc.aspx?sourcedoc=%7BBD61859C-4FEC-4078-B633-0EE0EFF62267%7D&file=Nanoose+OND+Display+Spreadsheet+2026+Master.xlsx&action=default&mobileredirect=true&web=1): parent found current v4.0 dated 23 September 22:09:16 UTC, before the distribution notice; v1–v3 are retained. This is a store master, not proof that its binary hash equals the consolidated import fingerprint.

Five Nanoose samples agree across parent-inspected master/PDF and current saved Display Final allocations:

| SKU | Product | Display | Cases | Persisted source cell |
| --- | --- | --- | ---: | --- |
| 682930 | Lucky | M1 | 60 | Nanoose!15 |
| 100594 | Kim Crawford Sauvignon Blanc | M5 | 24 | Nanoose!35 |
| 86256 | Mionetto Prosecco | W7 | 24 | Nanoose!90 |
| 796094 | Copper Moon Pinot Grigio 4L | W8 | 16 | Nanoose!91 |
| 881490 | Copper Moon Malbec 4L | W8 | 8 | Nanoose!92 |

The parent-reported rotating partner sections (BR1 VIB, BR3 Northam, BR4 Phillips, BR6 Mark Anthony Brands) have blank PDF product lists consistent with the original notice's explicit instruction to use the master spreadsheets and monthly flyer for those partner displays. They are not evidence that Betty should infer a product or LTO month. Full November/December monthly instructions remain unverified.

Corona SKU 44143 and Bailey's Chocolate SKU 318640 are preordered with blank master quantities and unresolved PDF guidance. Their saved Nanoose planning allocations are 0 (BR5 and Seasonal Table respectively). Treat these as unresolved source/quantity semantics, **not confirmed zero-order instructions**. Summerland Wines 1 lacks a supplied SKU/case count and appears pending in the sampled PDF. Signage is unspecified in sampled sections; separate signage instructions were not verified. These are explicit operational clarification points, not an automatic finding that every distributed instruction was unreliable.

The persisted distributed draft has 21 Nanoose placement records (none missing an area or flagged for conflicting notes) and 34 Crown Isle records (one without an area, no flagged note conflicts). Across all stores the existing draft exceptions in the table remain; bounded five-row sampling does not resolve them.

On 28 September 18:44 UTC Jeremy warned of PO errors; [the subsequent revised-PO notice](https://outlook.office365.com/owa/?ItemID=AAMkADFjY2U4ZDI3LTA1MjctNDczMS04NjQ0LWJhN2YwOTBlNTljNwBGAAAAAAAijt%2FgZQ9iS6g4tAABv22zBwCRULY4Xh%2F5QalnTQNSUU4iAAAAAAEMAACRULY4Xh%2F5QalnTQNSUU4iAAdKdOr1AAA%3D&exvsurl=1&viewmodel=ReadMessageItem) at 22:54 UTC says revised POs were uploaded. That is separate ordering/distribution evidence; it does not establish a new Black Betty visual release, and no PO was submitted or changed here. No verified later replacement visual release was found by the researcher. Some current masters have later modifications (Eagle Creek 9 October, Royal Bay 30 September, Hatley 29 September, Crown Isle local master 12 October), so current file contents cannot universally be assumed to be the original distribution versions.
