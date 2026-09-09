# Phase 1: Real Store Model

## 1. Objective

Make the existing physical store model the spatial layer used during campaign planning: select participating stores, map each `CampaignDisplay` to a real store `DisplayArea`, inspect the placement on the existing floorplan, adjust store quantities, and review the resulting physical plan.

This phase does not publish campaigns to stores and does not regenerate floorplans, category geometry, or verified display locations.

## 2. What already existed before Phase 1

Phase 0 and the protected upstream imports already provided:

- one current physical layout and floorplan asset for each of 12 stores;
- source-backed `CategorySpace` records and conservative geometry mappings;
- 247 active, source-backed, verified promotional `DisplayArea` records;
- seven inactive/unverified synthetic `DisplayArea` records retained for historical references;
- campaign products, reusable campaign display concepts, store inclusion, store-specific placement records, quantity overrides, and localStorage persistence;
- a generic `/stores/:storeId/floorplan` route with base, category, display-area, and campaign-placement layers.

The protected baseline remains in `public/floorplans/*`, `src/adapters/mock/allStoreLayoutSeed.generated.ts`, and `src/adapters/mock/verifiedDisplaySeed.generated.ts`.

## 3. Store navigation architecture

`/stores` is the common store directory. The primary **Stores** navigation item opens it for planning and operations users. Each store card links directly to its generic floorplan route and its operational workspace.

The directory derives coverage from the current repository snapshot. It does not maintain a second copy of layout or display data. A current store floorplan is one click from the directory and two clicks or fewer from primary navigation.

Crown Isle was previously easier to reach because app-shell links selected the first included active-program store, which was Crown Isle. Other floorplans were technically routable but had no common discovery page.

## 4. Store-by-store floorplan and display coverage

Definitions:

- **Physical layout**: a `StoreLayout` with `status = current`.
- **Category spaces**: active `CategorySpace` records belonging to that current layout.
- **Mapped**: category spaces with normalized geometry.
- **DisplayAreas**: all persistent promotional records, including inactive historical records.
- **Verified / unverified**: source-verification state, independent of category-space mapping.

| Store | Physical layout | Category spaces | Mapped category spaces | DisplayArea count | Verified | Unverified |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Allandale | Current | 73 | 40 | 13 | 13 | 0 |
| Caddy Bay | Current | 66 | 30 | 12 | 12 | 0 |
| Crown Isle | Current | 21 | 21 | 35 | 31 | 4 |
| Eagle Creek | Current | 107 | 59 | 34 | 31 | 3 |
| Hatley Park | Current | 82 | 40 | 16 | 16 | 0 |
| Langford | Current | 85 | 47 | 31 | 31 | 0 |
| Nanoose | Current | 93 | 52 | 21 | 21 | 0 |
| Parksville | Current | 71 | 39 | 15 | 15 | 0 |
| Port Alberni | Current | 60 | 36 | 10 | 10 | 0 |
| Quadra | Current | 98 | 54 | 22 | 22 | 0 |
| Royal Bay | Current | 70 | 37 | 18 | 18 | 0 |
| Uptown | Current | 84 | 30 | 27 | 27 | 0 |
| **Total** | **12 current** | **910** | **485** | **254** | **247** | **7** |

The seven unverified records are inactive historical synthetic locations: four at Crown Isle and three at Eagle Creek. They remain addressable for existing execution history but cannot be selected for a new campaign placement. Category spaces are never treated as promotional display locations.

## 5. Campaign-to-DisplayArea mapping model

The planning relationship is:

`Campaign` → `CampaignDisplay` → `CampaignDisplayAssignment` (one store) → `DisplayArea` (same store)

`CampaignDisplay` describes a reusable merchandising requirement such as “Front Feature.” It is not physical. `CampaignDisplayAssignment` adds a participating store, dates, placement status, compatibility result, and optional real `displayAreaId`. `CampaignDisplayAssignmentProduct` stores the campaign default quantity and any store-specific adjustment.

The repository enforces that a selected area:

- exists;
- belongs to the assignment's store;
- is active;
- is not incompatible under the existing type/conflict checks.

Verified and needs-verification states remain visible. Verification alone does not add a new compatibility rule. A buyer can save, change, or explicitly clear a physical placement. Opening a floorplan carries `campaign`, `assignment`, and `area` context so the current placement is selected and other placements for that campaign remain visible.

## 6. Legacy assignment model findings

Two assignment models coexist and have different responsibilities.

### `CampaignDisplayAssignment` (planning model)

- Written by the campaign Stores step through `suggestCampaignDisplay` and `updateCampaignDisplayAssignment`.
- Read by campaign readiness, campaign review, and campaign-aware floorplans.
- Maps each campaign display/store pair to a real persistent `DisplayArea`.
- Has no store publishing or execution generation in Phase 1.

### `CampaignAssignment` (legacy campaign execution model)

- Written by the older assignment screen and `assignCampaign` repository method.
- Read by dashboard campaign activity, campaign detail assignment counts, floorplan operational state, execution context, compliance, and display-area performance/history pages.
- Seeded examples reference inactive synthetic Crown Isle/Eagle Creek areas retained for referential safety.

### `DisplayAssignment` (program/OND execution model)

- Separate from both campaign models.
- Drives program scheduling, store workspaces, orders, resets, publishing, and OND performance.

Removing `CampaignAssignment` now would break seeded executions, compliance navigation, dashboard summaries, and historical display profiles. Replacing `DisplayAssignment` would break the OND operational workflow. The canonical direction is additive: keep `CampaignDisplayAssignment` as the editable campaign planning model, then create immutable release data and downstream operational `DisplayAssignment` records only during a future explicit publish operation. A mapper at that boundary should preserve source assignment IDs. No destructive migration is appropriate in Phase 1.

## 7. Persistence-readiness findings

The active repository is `MockMerchandisingRepository`. It persists the complete snapshot to browser localStorage under `cascadia-merchandising-platform-v1`. Refresh and repository reconstruction preserve placements and quantity changes on the same browser profile, but data is neither shared nor multi-user.

`SupabaseMerchandisingRepository` is an intentionally disabled interface-complete stub. It has no migrations, queries, authentication contract, or RLS policies. Store/layout/display data is not demonstrated to exist in a live Supabase project.

Before Jeremy runs a shared live pilot, the following require shared persistence:

- campaigns and campaign products;
- campaign displays and display-product membership/default quantities;
- campaign store inclusion;
- campaign display-to-`DisplayArea` assignments and placement status;
- store quantity adjustments and their override/default provenance;
- stores, current layout metadata, category spaces, display areas, sections, and verification metadata as governed reference data.

Likely additive tables are `campaigns`, `campaign_products`, `campaign_displays`, `campaign_display_products`, `campaign_stores`, `campaign_display_assignments`, and `campaign_display_assignment_products`, plus the physical-model tables described in the adapter README. Foreign keys must enforce store consistency; database constraints should prevent duplicate campaign-display/store rows and overlapping accepted use of one display area. Auth claims, planning roles, store scope, audit columns, optimistic concurrency, release immutability, Data API grants, and RLS policies must be reviewed before enabling browser access. Production credentials and weakened RLS are explicitly out of scope.

## 8. Known limitations

- Campaign review is review-only; there is no campaign publish action.
- Campaign placement suggestions are deterministic compatibility helpers, not autonomous recommendations.
- Shared persistence, concurrency handling, and audit history are absent.
- Inactive legacy campaign areas remain visible only when historical workflows reference them.
- Floorplan hotspots indicate source locations; their marker dimensions do not claim physical capacity.
- Port Alberni M5 remains verified as a physical record but lacks a shared display-class mapping.
- Parksville W5 and Royal Bay M3 contain source-backed secondary sections.

## 9. Deferred work

- reviewed Supabase schema, migrations, auth/RLS, and contract tests;
- explicit campaign release/publish mapping into operational assignments;
- shared multi-user editing, audit history, and conflict handling;
- supplier intake, automated ordering, recommendations, ingestion, and store review requests;
- any new floorplan extraction, OCR, geometry inference, or display generation.

## 10. Manual test script (10–15 minutes)

1. Open **Stores** from primary navigation and confirm all 12 stores appear.
2. Open **Crown Isle → View floorplan** and confirm the established base floorplan and markers still look correct.
3. Return to **Stores**.
4. Open floorplans for Quadra, Royal Bay, and Port Alberni.
5. Confirm each page title, background image, category counts, and display markers are store-specific.
6. Open a draft campaign and add or select a campaign display with at least one product.
7. Open **Stores** within that campaign and include several stores.
8. Start or suggest placements, then choose one real display area for the first store.
9. Choose a different store-specific display area for the second store.
10. Confirm each selector contains only active areas for its own store and shows verification state.
11. Open the first placement's **Floorplan** link; confirm the campaign, campaign display, store, and selected display area are visible and the marker is selected.
12. Return to store placements, change the first location, then clear it; confirm the second store is unchanged.
13. Reassign the first store and adjust one store quantity while leaving the campaign default visible.
14. Open **Review** and confirm placed areas, display codes, products, default quantities, store adjustments, verification, and any missing placements are visible.
15. Refresh the browser and confirm placements and adjustments persist; confirm unplaced stores remain flagged and no enabled campaign publishing action exists.
