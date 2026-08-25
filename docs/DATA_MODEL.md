# Merchandising Data Model

This document defines the initial Supabase-compatible relational contract. The MVP implements the same model as TypeScript domain types and synthetic local data. It does not create or modify a database.

All primary keys are UUIDs. Foreign keys use the same shared IDs expected by Ursus Major for stores, products, and users.

## Core hierarchy

```text
merchandising_programs -> program_stores
                       -> program_releases
                       -> display_assignments -> display_assignment_products
                                              -> execution_tasks
                                              -> order_recommendations -> purchase_order_lines
execution_tasks -> execution_submissions -> compliance_reviews
purchase_orders -> purchase_order_lines -> inbound_orders
```

`display_areas` are persistent physical assets. Campaign changes never replace or repurpose their identity. Legacy campaign assignments remain supported, but new OND operational tasks reference `display_assignment_id` directly.

## Tables

| Table | Required fields | Ownership and notes |
| --- | --- | --- |
| `stores` | `id`, `code`, `name`, `address` | `id` must map to the shared Ursus store identity. |
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

Zone, fixture, and display-area geometry is stored as `x`, `y`, `width`, and `height` values normalized to `0..1`, with optional rotation. Every rectangle must remain inside the floorplan bounds.

## Product Master reconciliation contract

Campaign intake searches Product Master through the repository boundary, which is mock-backed today and can later be implemented by Ursus/Supabase. A valid SKU absent from Product Master may create a temporary product with `master_status = pending`; it can participate in campaign and display planning but must remain visibly flagged.

Future reconciliation should match a pending record to a trusted authoritative SKU, set its `authoritative_product_id`, and transactionally repoint campaign and display references to the authoritative product ID. Campaign, assignment, execution, and performance history must be preserved. The reconciliation process must reject ambiguous SKU matches and must not create a second authoritative product. Production reconciliation is intentionally outside the MVP mock adapter.

## Security assumptions

- RLS is required for every table exposed through the Supabase Data API.
- Data API grants and RLS policies are separate explicit controls.
- Store managers are scoped to assigned store IDs; buying, merchandising, and operations roles receive only the mutations their work requires.
- Authorization claims come from trusted `app_metadata`, not user-editable metadata.
- Browser code never receives a secret or service-role key.
