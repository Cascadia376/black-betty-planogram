# Store Layout Import Validation

## Objective and sources

Populate a current physical layout for all 12 Cascadia stores without merging regular `CategorySpace` records with promotional `DisplayArea` or campaign-level `CampaignDisplay` records.

Primary capacity source: `Planogram Spreadsheet all stores June 2026.xlsx`.

Secondary validation source: `Copy of Cooler Doors By Store 2026.xlsx`.

Geometry source: the supplied 2026 floorplan PDFs. Allandale uses `Allandale Floorplan NEW Aug 5.pdf`; the older Allandale map is not active.

## Metric definitions and validation checks

- `CategorySpace count` includes meaningful workbook capacity records, mapped floorplan-only segments whose capacity could not be assigned safely, and seven secondary cooler-summary records where values exist.
- `Mapped` means normalized geometry is present and visible on the category layer.
- `Unresolved` means geometry is absent or a mapped floorplan segment could not receive workbook capacity confidently. This is intentionally conservative.
- `Shelf`, `facing`, and `door` counts report records with those attributes, not sums of their capacity values.
- Every store has exactly one current layout; layout IDs are unique; every asset exists; geometry stays inside `0..1`; category/layout store IDs agree; every section references an existing category space.
- Existing DisplayAreas remain unchanged except for `active=true` and `verificationStatus=unverified`; no new guessed promotional areas were imported.

## Per-store results

| Store | Asset | CategorySpace | Mapped | Sections | With shelves | With facings | With doors | Unresolved | Verified DisplayAreas | Inactive legacy | Status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Allandale | `allandale.png` | 73 | 40 | 26 | 36 | 33 | 13 | 49 | 13 | 0 | Current; representative browser check passed |
| Caddy Bay | `caddy-bay.png` | 66 | 30 | 40 | 34 | 31 | 13 | 47 | 12 | 0 | Current; representative browser check passed |
| Crown Isle | `crown-isle.png` | 21 | 21 | 2 | 19 | 14 | 7 | 0 | 31 | 4 | Verified display map loaded; historical synthetic IDs preserved inactive |
| Eagle Creek | `eagle-creek.png` | 107 | 59 | 39 | 51 | 40 | 15 | 82 | 31 | 3 | Verified display map loaded; historical synthetic IDs preserved inactive |
| Hatley Park | `hatley-park.png` | 82 | 40 | 41 | 43 | 41 | 16 | 59 | 16 | 0 | Current; cooler conflict requires review |
| Langford | `langford.png` | 85 | 47 | 41 | 46 | 43 | 16 | 53 | 31 | 0 | Current |
| Nanoose | `nanoose.png` | 93 | 52 | 16 | 41 | 35 | 14 | 77 | 21 | 0 | Current; 0.5-door total difference retained |
| Parksville | `parksville.png` | 71 | 39 | 21 | 44 | 38 | 14 | 42 | 15 | 0 | Current; W5 uses an additional display section |
| Port Alberni | `port-alberni.png` | 60 | 36 | 11 | 35 | 31 | 12 | 35 | 10 | 0 | Current; open-cooler layout browser-checked |
| Quadra | `quadra.png` | 98 | 54 | 37 | 43 | 37 | 16 | 75 | 22 | 0 | Current; Cellar layout browser-checked |
| Royal Bay | `royal-bay.png` | 70 | 37 | 18 | 40 | 40 | 14 | 45 | 18 | 0 | Current; M3 uses an additional display section |
| Uptown | `uptown.png` | 84 | 30 | 26 | 47 | 42 | 15 | 69 | 27 | 0 | Current; angled footprint browser-checked |

## Detailed workbook versus cooler summary

Explicit detailed door totals count only workbook values stated in door equivalents. Open-cooler shelf counts are not converted into doors.

| Store | Detailed explicit doors | Summary doors | Material difference retained |
| --- | ---: | ---: | --- |
| Allandale | 19 | 20 | Summary includes 1 Cider door while detailed Cider records are shelf-based rather than door-based. |
| Caddy Bay | 14 | 16 | Small-fridge Cider/RTD records are shelf-based; summary classifies 1 Cider and 3 Singles doors. |
| Crown Isle | 24 | 24 | Totals reconcile, but detailed Domestic is 6D versus summary 4; summary also classifies Import 2 and Refresh 5 differently. Existing Crown notes retain this distinction. |
| Eagle Creek | 20 | 20 | Totals and broad classifications reconcile when the two detailed singles rows are combined. |
| Hatley Park | 30 | 22 | Major conflict: detailed rows include 6 Cider doors and 5 Craft Packaged doors, while summary reports Cider 2 and Craft 1. Neither source was overwritten. |
| Langford | 16 | 16 | Totals and broad classifications reconcile. |
| Nanoose | 17.5 | 18 | Detailed lacks an explicit Import door and records Domestic 4 versus summary Domestic 3; summary total is 0.5 door higher. |
| Parksville | 20 | 20 | Totals reconcile; detailed Domestic is 5D while summary splits Domestic 4 and Import 1. |
| Port Alberni | 14 | 14 | Door totals reconcile. Open-cooler singles are recorded as shelves/facings and are not converted to doors; summary leaves Singles blank. |
| Quadra | 22 | 22 | Totals and broad classifications reconcile. |
| Royal Bay | 29 | 29 | Totals reconcile; detailed Domestic is 6D and singles rows total 7D, while summary reports Domestic 4, Import 1, and Singles 8. |
| Uptown | 12 | 12 | Totals and broad classifications reconcile, including fractional doors. |

## Geometry confidence and limitations

- The initial overlay uses embedded PDF labels and their enclosing vector rectangles; it does not use OCR or infer shelf dimensions from image proportions.
- Allandale and Uptown align well despite portrait/angled layouts. Quadra is spatially dense, so small regions remain visually crowded at default zoom.
- Port Alberni open-cooler labels align, but shelf-based open-cooler records intentionally have no derived door equivalents.
- Caddy Bay, Hatley Park, Eagle Creek, Nanoose, and Quadra contain repeated or grouped labels. Capacity remains unmapped wherever a one-to-one physical match could not be established.
- Capacity-only records without confident geometry are still retained for later human mapping. Missing values remain missing.
- Store addresses were not present in the supplied layout sources; new store records explicitly say so rather than inventing addresses.

## Recommended review

Before commit, visually review Allandale, Quadra, Uptown, and Port Alberni. Pay particular attention to dense small labels, the Quadra Cellar region, Uptown angled perimeter, and Port Alberni open-cooler run. Hatley Park also needs a business decision on the 30-versus-22 cooler-door conflict.

## Automated validation status

Validated on September 2, 2026:

- TypeScript project check passed.
- ESLint passed.
- Vitest passed: 19 files, 97 tests.
- Production Vite build passed.
- Playwright passed: 53 Chromium scenarios, including exact source-backed and mapped counts for the six representative imported layouts.
- `git diff --check` passed.
