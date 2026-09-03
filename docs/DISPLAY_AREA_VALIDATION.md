# Verified DisplayArea Import Validation

## Objective and sources

The objective was to replace guessed promotional locations with source-backed `DisplayArea` inventory while keeping `CategorySpace`, `DisplayArea`, and `CampaignDisplay` separate. The import used all 12 supplied store display-map Word documents and `Master Display Naming.xlsx`. Ordinary category floorplans were not used to create promotional locations.

## Import rules and metric definitions

- **Verified count** is the number of active logical DisplayAreas transcribed from a store's Word map.
- **Family counts** classify source codes as Wine (`W*`), Beer/RTD (`BR*`), or Multi (`M*`). Source-named Seasonal and Window locations remain named families.
- **Legacy count** is the number of pre-existing synthetic records retained inactive/unverified for referential safety.
- **Unmapped code** means a source-map code with no store-specific class mapping in the workbook.
- **Unclassified** means `displayClassDefinitionId` is intentionally absent; the physical record remains usable.
- Each marker uses a small normalized hotspot centred on the source label's mapped position. Label-box size is not treated as physical display size.
- Repeated local codes are one logical record plus `DisplayAreaSection` only where two distinct source locations are visible.

## Per-store results

| Store | Verified | Wine | Beer/RTD | Multi | Seasonal/named | Legacy | Duplicate local codes | Unmapped / unclassified | Geometry issues | Source ambiguities |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| Allandale | 13 | 3 | 3 | 6 | 1 | 0 | None | None | None | A second BR2 string above the drawing is a stray document annotation; only the map anchor was imported. |
| Caddy Bay | 12 | 6 | 2 | 4 | 0 | 0 | None | None | None | BR1 is split into separate glyphs in the Word PDF export; its visible source position was retained. |
| Crown Isle | 31 | 11 | 9 | 10 | 1 | 4 | None | None | None | None. |
| Eagle Creek | 31 | 15 | 7 | 7 | 2 | 3 | None | None | None | Source `Window display-W6` is retained as local W6 with family WINDOW, not Wine. |
| Hatley Park | 16 | 5 | 4 | 6 | 1 | 0 | None | None | None | None. |
| Langford | 31 | 11 | 10 | 9 | 1 | 0 | None | None | None | Workbook alias LA maps to application store code LF. |
| Nanoose | 21 | 8 | 6 | 6 | 1 | 0 | None | None | None | Workbook alias NA maps to application store code NB. |
| Parksville | 15 | 5 | 4 | 5 | 1 | 0 | W5 | None | None | W5 appears in two distinct positions and is modeled with one additional section. |
| Port Alberni | 10 | 2 | 3 | 5 | 0 | 0 | None | M5 (unclassified) | None | Physical M5 exists on the map but has no store-specific master-class mapping. |
| Quadra | 22 | 10 | 5 | 6 | 1 | 0 | None | None | None | Workbook alias QU maps to application store code QD; source Seasonal End remains an endcap type. |
| Royal Bay | 18 | 4 | 5 | 8 | 1 | 0 | M3 | None | None | M3 appears in two distinct positions and is modeled with one additional section. |
| Uptown | 27 | 7 | 8 | 11 | 1 | 0 | None | None | None | None. |
| **Total** | **247** | **87** | **66** | **83** | **11** | **7** | **2** | **1** | **0** | See above. |

`Seasonal/named` totals include ten Seasonal records plus Eagle Creek Window Display. There are 249 rendered hotspots because the 247 logical records include two additional sections.

## Shared taxonomy validation

- 63 `DisplayClassDefinition` records were loaded from rows 2–64 of the workbook.
- All class UUIDs are unique.
- Six legacy abbreviations collide by design: `WMD1`, `WMD2`, `BRMD1`, `BRMD2`, `MMD1`, and `MMD2` each identify both Medium and MINI definitions. No uniqueness constraint is applied to `legacyCode`.
- Six master rows have no store mapping in the workbook: row 18 Wine Small Display zone 2, row 23 Wine Feature table 2, row 35 Beer/RTD Large Display zone 3, row 46 Multi Front end 6, row 60 Multi Small Display zone 2, and row 62 Multi MINI Display zone 2.
- Workbook product/program examples, including `#REF!` cells, were not copied onto physical DisplayAreas. A later assignment import may use them only after its own source and data-quality review.

## Validation checks performed

- Reconciled logical counts to every source map and checked family totals.
- Confirmed all 247 global codes are unique while local codes repeat safely between stores.
- Confirmed every active imported record is verified and has a source reference.
- Confirmed all primary and section geometries stay within normalized floorplan bounds.
- Confirmed both duplicate-code cases resolve to an existing logical record and not an invented suffix.
- Confirmed seven legacy synthetic records remain addressable and inactive/unverified.
- Confirmed new allocation suggestions and choices use active records only.
- Added representative browser coverage for Crown Isle, Eagle Creek, Royal Bay, and Quadra.

## Limitations and human review

Hotspots were positioned from the supplied display-map annotations and visually checked against the underlying diagrams. They identify location but do not assert physical dimensions. Port Alberni M5 requires a human taxonomy decision. Parksville W5 and Royal Bay M3 should be confirmed as intentional multi-part displays rather than source errors. Caddy Bay BR1 and Allandale BR2 should be spot-checked in the original Word files if those documents are revised.

No production Supabase migration, product assignment import, automated image interpretation, drag-and-drop, or resize handling is included in this phase.
