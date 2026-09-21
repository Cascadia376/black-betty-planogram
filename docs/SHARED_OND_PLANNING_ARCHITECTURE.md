> Historical proposal. Shared planning/physical aggregates are now implemented. Use [ADR 0002](ADR-0002-reliability-and-release-boundaries.md), [the adapter contract](../src/adapters/supabase/README.md) and [the current release gate](PRODUCTION_GATE.md) for actual runtime behaviour. Older empty-database, admin-only physical-write or future-implementation statements below are not current operational instructions.

# Shared OND planning architecture

## 1. Current behaviour

The mock `MerchandisingRepository` owns a complete in-memory `PlatformSnapshot` and writes it to browser `localStorage`. That preserves one browser's work, but it cannot share campaigns between authenticated users. The initial Supabase adapter work only persists floorplan slices in one JSON document, does not persist the campaign workflow, and does not condition updates on a version. Its first write can therefore overwrite a newer user's work.

The OND execution-pack projection also uses the selected month to remove products from display builds. This makes the floor map appear monthly even though the physical OND display plan is stable.

## 2. Affected domain objects

Shared mutable planning state includes campaign headers/status/notes, campaign products, campaign displays and their products, participating stores, store/display assignments and assignment products, store/product case allocations, campaign import/provenance records, campaign releases, and campaign-specific/store floorplan geometry records. Product Master lookup remains behind its existing secured adapter and is not duplicated into the planning document.

## 3. Minimum schema change

Use one `black_betty_planning_snapshot` row containing the mutable planning slices as JSONB plus `version`, `created_at`, `updated_at`, `created_by`, and `updated_by`. Authenticated Black Betty buyers/admins receive only `select` and `update`; RLS uses the existing `private.black_betty_role()` boundary. A trigger increments `version` and fills audit fields. Client updates include the version loaded by the user and treat a zero-row update as an optimistic-concurrency conflict.

This document schema is intentionally the minimum migration: it preserves the repository's existing aggregate and domain rules without spreading Supabase calls through feature components. Normalized campaign tables can be introduced later behind the same interface if reporting/query requirements justify them.

## 4. OND semantic change

Display participation (`Display`, merchandising state, display membership, and physical placement) is campaign-wide. Selecting October, November, or December must not change the store floor map or its display products. Ordering eligibility is independent and comes from normalized `LTO Month` metadata retained on the import row.

## 5. Migration approach

Seed the shared document from the verified repository snapshot, retaining existing store layouts and display geometry. The browser combines shared mutable slices with static seed/reference slices on load. Existing Product Master security, exact-SKU matching, and normal replenishment logic remain unchanged. Deployment applies the SQL migration before enabling the Supabase-backed app.

## 6. Test plan

- Exercise two repository instances against one fake Supabase store: create/load/edit/reload and stale-write rejection.
- Verify a Display Y October-LTO product and Display Y November-LTO product both stay on one OND display plan.
- Verify October and November order projections include only their corresponding LTO products.
- Verify a non-display product remains allocated and appears in its LTO month without requiring a display area.
- Verify import metadata keeps display participation and normalized LTO ordering months independently.
- Run lint, typecheck, unit tests, build, and E2E when the browser environment is available.
