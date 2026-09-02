# Merchandising Data Model

This document defines the initial Supabase-compatible relational contract. The MVP implements the same model as TypeScript domain types and synthetic local data. It does not create or modify a database.

All primary keys are UUIDs. Foreign keys use the same shared IDs expected by Ursus Major for stores, products, and users.

## Core hierarchy

Regular store layout is versioned independently from promotional placements:

```text
stores -> store_layouts -> category_spaces -> category_space_sections
```

`CategorySpace` represents a regular merchandising/category allocation. `DisplayArea` represents a persistent promotional destination. `CampaignDisplay` represents the merchandising concept a campaign intends to place. These records are deliberately separate even when rendered on the same floorplan.

```text
StoreLayout
    -> CategorySpace

Store
    -> DisplayArea
         <- CampaignDisplayAssignment
              <- CampaignDisplay
```

```text
merchandising_programs -> program_stores
                       -> program_releases
                       -> display_assignments -> display_assignment_products
                                              -> execution_tasks
                                              -> order_recommendations -> purchase_order_lines
execution_tasks -> execution_submissions -> compliance_reviews
purchase_orders -> purchase_order_lines -> inbound_orders
```

Campaign planning has a separate, pre-store hierarchy:

```text
campaigns -> campaign_products -> campaign_displays -> campaign_display_products
campaign_displays -> (Phase 3) display_areas
```

`campaign_displays` hold the intended merchandising concept, not a store location. `STANDARD` displays are reusable concepts and `STORE_SPECIFIC` displays require an explicit location later. `campaign_display_products` add display-only behavior (Hero/Supporting, optional minimum facings and quantities) without duplicating Product Master data. `SHELF_SUPPORTED` campaign products are intentionally part of the assortment but have no dedicated display.

`display_areas` are persistent physical assets. Campaign changes never replace or repurpose their identity. Legacy campaign assignments remain supported, but new OND operational tasks reference `display_assignment_id` directly.

## Tables

| Table | Required fields | Ownership and notes |
| --- | --- | --- |
| `stores` | `id`, `code`, `name`, `address` | `id` must map to the shared Ursus store identity. |
| `store_layouts` | `id`, `store_id`, `name`, `status`, timestamps | Versioned physical layout. Status is `draft`, `current`, or `archived`; background image URL and aspect ratio belong to the layout data, not a React component. |
| `category_spaces` | `id`, `store_id`, `layout_id`, `name`, `category`, `active` | Regular shelf, cooler, wall, cabinet, table, or other category home. Capacity and normalized geometry are optional when source data is missing. This is not a promotional `display_area`. |
| `category_space_sections` | `id`, `category_space_id`, `sort_order` | Lightweight optional detail for mixed widths/depths, partial doors, ledges, or other irregular configurations. It does not model individual shelves. |
| `store_zones` | `id`, `store_id`, `name`, `category`, `geometry` | Belongs to one store. Geometry uses normalized coordinates. |
| `fixtures` | `id`, `store_id`, `zone_id`, `name`, `type`, `geometry` | Belongs to one zone and store. |
| `display_areas` | `id`, `store_id`, `zone_id`, `fixture_id`, `name`, `type`, `description`, `capacity`, `geometry` | Persistent first-class merchandising asset. |
| `products` | `id`, `sku`, `name`, `category`, `master_status`, `case_pack`, `active` | Product Master abstraction. Production identity and attributes should be sourced from Ursus/Supabase, not inferred from campaigns or allocations. `pending` records are temporary planning records awaiting reconciliation. |
| `merchandising_programs` | `id`, `name`, `start_date`, `end_date`, `status`, `description` | A quarterly program may contain multiple periods and campaigns. |
| `program_stores` | `id`, `program_id`, `store_id`, `included`, `status`, optional `owner_user_id` | Establishes program scope before allocations exist, so not-started stores remain visible. |
| `program_releases` | `id`, `program_id`, `version`, `status`, `published_at`, `published_by_user_id` | Immutable release header. Published assignment/product snapshots should use child release tables or versioned JSON with an auditable schema. |
| `display_assignments` | `id`, `program_id`, optional `period_id`, `store_id`, `display_area_id`, `start_date`, `end_date`, `reset_required`, `notes`, `status` | Canonical OND operational allocation. Exclusion constraints should reject overlapping date ranges for one display. |
| `display_assignment_products` | `id`, `assignment_id`, `product_id`, `sku`, `case_quantity`, `required`, optional supplier/facing/note fields | Case quantity is store/display specific. |
| `campaigns` | `id`, `name`, `type`, `description`, `start_date`, `end_date`, `owner_user_id`, `supplier`, `status`, display requirement fields | Campaign dates use inclusive business dates. |
| `campaign_products` | `id`, `campaign_id`, `product_id`, `role`, `required`, optional `note` | References Product Master identity. Names, category, brand, package, case pack, active state, and supplier options remain Product Master owned. Historical releases may retain immutable snapshots outside this planning record. |
| `campaign_displays` | `id`, `campaign_id`, `name`, `display_type`, `placement_mode`, `prescriptive`, `sort_order`, optional execution guidance | Campaign-level merchandising concept. It must not be merged with a persistent `display_area`. |
| `campaign_display_products` | `id`, `campaign_display_id`, `campaign_product_id`, `product_id`, `role`, `required`, optional minimums and note | Display-specific membership. MVP allows one membership per campaign product; the relationship can expand later. |
| `campaign_assignments` | `id`, `campaign_id`, `store_id`, `display_area_id`, `effective_date`, `compatibility`, `notes` | Connects a campaign to one persistent area at one store. |
| `execution_tasks` | `id`, optional legacy `assignment_id`, optional `display_assignment_id`, `program_release_id`, `task_type`, `due_date`, `status`, `issue` | Require exactly one assignment reference. OND publish creates initial-set and reset tasks from display assignments. |
| `order_recommendations` | `id`, `store_id`, `product_id`, `display_assignment_id`, `supplier_id`, dates, cases, type, rationale, status, forecast metadata | Generated from assignment, demand, inventory, inbound, supplier, and Buying-owned bridge policy inputs. Keep rationale and source for auditability. |
| `purchase_orders` | `id`, `store_id`, `supplier_id`, optional `program_id`, `created_at`, `expected_arrival_date`, `status` | Supplier-grouped operational order batch. |
| `purchase_order_lines` | `id`, `purchase_order_id`, `recommendation_id`, `product_id`, `cases` | Connects accepted recommendations to a concrete order and resulting inbound records. |
| `execution_submissions` | `id`, `execution_id`, `submitted_at`, `submitted_by_user_id`, `photo_storage_path`, `note`, unavailable SKU and substitution fields | Store only operationally necessary metadata. |
| `compliance_reviews` | `id`, `execution_id`, `reviewer_user_id`, `reviewed_at`, `decision`, `score`, `checks`, `comment` | Checks are requirements-based; a normalized child table can replace JSON if reporting needs demand it. |
| `display_area_history` | `id`, `display_area_id`, `campaign_id`, `assignment_id`, `execution_id`, `start_date`, `end_date` | Stable bridge for historical reporting. |
| `performance_records` | `id`, `campaign_id`, `store_id`, `display_area_id`, `period_start`, `period_end`, measured metrics | Every measurement remains traceable to campaign, store, area, and period. Avoid storing analytics that can be derived reliably. |
| `recommendations` | `id`, `display_area_id`, optional `campaign_id`, `rule`, `title`, `rationale`, `status`, `note` | Rule name and rationale make every recommendation explainable. |

## Geometry contract

Zone, fixture, display-area, and category-space geometry is stored as `x`, `y`, `width`, and `height` values normalized to `0..1`, with optional rotation. Every supplied rectangle must remain inside the floorplan bounds. Category-space geometry may be absent while a source record is awaiting manual mapping.

## Layout versioning

A store may have many layouts but at most one `current` layout. Duplicating a layout creates a `draft` and copies its category spaces and irregular sections with new identities. Publishing that draft makes the prior current layout `archived`; archived layouts remain readable. `DisplayArea` remains store-level in this phase so campaign allocation behavior is unchanged.

The Crown Isle reference layout uses `/public/floorplans/crown-isle.png`, rendered from `Crown Isle Floorplan.pdf`. Capacity fields come from the `CROWNE ISLE` worksheet in `Planogram Spreadsheet all stores June 2026.xlsx`; cooler summary classifications are retained in notes when they differ from detailed records. Missing or ambiguous measurements remain unset.

## Product Master reconciliation contract

Campaign intake searches Product Master through the repository boundary, which is mock-backed today and can later be implemented by Ursus/Supabase. A valid SKU absent from Product Master may create a temporary product with `master_status = pending`; it can participate in campaign and display planning but must remain visibly flagged.

Future reconciliation should match a pending record to a trusted authoritative SKU, set its `authoritative_product_id`, and transactionally repoint campaign and display references to the authoritative product ID. Campaign, assignment, execution, and performance history must be preserved. The reconciliation process must reject ambiguous SKU matches and must not create a second authoritative product. Production reconciliation is intentionally outside the MVP mock adapter.

## Security assumptions

- RLS is required for every table exposed through the Supabase Data API.
- Data API grants and RLS policies are separate explicit controls.
- Store managers are scoped to assigned store IDs; buying, merchandising, and operations roles receive only the mutations their work requires.
- Authorization claims come from trusted `app_metadata`, not user-editable metadata.
- Browser code never receives a secret or service-role key.
# Campaign store allocation planning

Campaign store scope is represented by `CampaignStore`; stores can participate before a display is allocated. `CampaignDisplayAssignment` stores a planned display-to-store-to-DisplayArea relationship, its buyer approval state, suggestion provenance, and campaign dates. `CampaignDisplayAssignmentProduct` stores the final store-specific quantity while preserving the baseline recommendation and buyer override flag. These are planning entities, not replacements for the operational `DisplayAssignment` model.
