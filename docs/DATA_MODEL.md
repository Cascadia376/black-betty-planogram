# Merchandising Data Model

This document defines the initial Supabase-compatible relational contract. The MVP implements the same model as TypeScript domain types and synthetic local data. It does not create or modify a database.

All primary keys are UUIDs. Foreign keys use the same shared IDs expected by Ursus Major for stores, products, and users.

## Core hierarchy

```text
stores
  -> store_zones
    -> fixtures
      -> display_areas
        -> campaign_assignments
          -> execution_tasks
            -> execution_submissions
              -> compliance_reviews
```

`display_areas` are persistent physical assets. Campaign changes never replace or repurpose their identity.

## Tables

| Table | Required fields | Ownership and notes |
| --- | --- | --- |
| `stores` | `id`, `code`, `name`, `address` | `id` must map to the shared Ursus store identity. |
| `store_zones` | `id`, `store_id`, `name`, `category`, `geometry` | Belongs to one store. Geometry uses normalized coordinates. |
| `fixtures` | `id`, `store_id`, `zone_id`, `name`, `type`, `geometry` | Belongs to one zone and store. |
| `display_areas` | `id`, `store_id`, `zone_id`, `fixture_id`, `name`, `type`, `description`, `capacity`, `geometry` | Persistent first-class merchandising asset. |
| `campaigns` | `id`, `name`, `type`, `description`, `start_date`, `end_date`, `owner_user_id`, `supplier`, `status`, display requirement fields | Campaign dates use inclusive business dates. |
| `campaign_products` | `id`, `campaign_id`, `product_id` or `sku`, `name`, `category`, `role`, `required`, `minimum_quantity`, `minimum_facings` | Product master data remains externally owned. Snapshot names may be retained for historical display. |
| `campaign_assignments` | `id`, `campaign_id`, `store_id`, `display_area_id`, `effective_date`, `compatibility`, `notes` | Connects a campaign to one persistent area at one store. |
| `execution_tasks` | `id`, `assignment_id`, `due_date`, `status`, `issue` | One or more tasks may eventually exist per assignment. |
| `execution_submissions` | `id`, `execution_id`, `submitted_at`, `submitted_by_user_id`, `photo_storage_path`, `note`, unavailable SKU and substitution fields | Store only operationally necessary metadata. |
| `compliance_reviews` | `id`, `execution_id`, `reviewer_user_id`, `reviewed_at`, `decision`, `score`, `checks`, `comment` | Checks are requirements-based; a normalized child table can replace JSON if reporting needs demand it. |
| `display_area_history` | `id`, `display_area_id`, `campaign_id`, `assignment_id`, `execution_id`, `start_date`, `end_date` | Stable bridge for historical reporting. |
| `performance_records` | `id`, `campaign_id`, `store_id`, `display_area_id`, `period_start`, `period_end`, measured metrics | Every measurement remains traceable to campaign, store, area, and period. Avoid storing analytics that can be derived reliably. |
| `recommendations` | `id`, `display_area_id`, optional `campaign_id`, `rule`, `title`, `rationale`, `status`, `note` | Rule name and rationale make every recommendation explainable. |

## Geometry contract

Zone, fixture, and display-area geometry is stored as `x`, `y`, `width`, and `height` values normalized to `0..1`, with optional rotation. Every rectangle must remain inside the floorplan bounds.

## Security assumptions

- RLS is required for every table exposed through the Supabase Data API.
- Data API grants and RLS policies are separate explicit controls.
- Store managers are scoped to assigned store IDs; buying, merchandising, and operations roles receive only the mutations their work requires.
- Authorization claims come from trusted `app_metadata`, not user-editable metadata.
- Browser code never receives a secret or service-role key.

