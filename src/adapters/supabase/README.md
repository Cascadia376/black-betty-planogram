# Supabase adapter boundary

This directory is intentionally non-operational in the MVP. UI code depends on `MerchandisingRepository`, not `supabase-js`.

Before enabling this adapter:

- approve the shared store, SKU, and user identifier mapping;
- create reviewed migrations for the merchandising schema;
- explicitly grant Data API access where required;
- enable RLS on every exposed table and implement role/store-scoped policies;
- use authorization claims from `app_metadata`, never user-editable metadata;
- use only a publishable/anonymous browser key and never a service-role key;
- add contract tests that run against an isolated non-production project.

## OND planning migration outline

The additive mock contracts imply future tables for:

- `merchandising_programs`;
- `program_periods`;
- `display_assignments`;
- `display_assignment_products`;
- `suppliers`;
- `supplier_product_options`;
- `inventory_positions`;
- `inbound_orders`;
- `order_recommendations`;
- `historical_demand`;
- `bridge_strategies`.

`display_areas` will need non-null, store-scoped unique `display_number` and `code` columns while preserving its UUID primary key. Campaigns may optionally reference a program and period; programs and campaigns remain separate entities.

Use foreign keys for every program, period, store, display-area, product, and supplier relationship. Enforce non-overlapping active date ranges per display area with a PostgreSQL exclusion constraint over a daterange, excluding cancelled assignments. Keep `case_quantity` on `display_assignment_products`, supplier preference on `supplier_product_options`, and bridge policy in a buying-owned `bridge_strategies` table.

Inventory positions should use a store/product unique key and retain source update timestamps. Inbound orders and order recommendations should preserve their status history rather than overwriting external order facts. The current selector and coverage calculation are deterministic mock-domain helpers, not forecasting or purchasing integrations.

Historical demand access must implement the `HistoricalDemandSource` boundary. The rule-based OND service consumes that interface and must not query Supabase directly; a future adapter can supply approved store/SKU and category aggregates without changing recommendation logic.

No migration or live connection is included in this prototype.

Supabase changed new-table Data API exposure defaults in 2026, so grants and RLS must be treated as separate, explicit controls.
