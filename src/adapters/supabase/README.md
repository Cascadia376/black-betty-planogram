# Supabase adapter boundary

The shared adapter is implemented. Older phase documents describing it as a skeleton are historical. UI uses `MerchandisingRepository`, not table calls.

## Current contract

`black_betty_planning_snapshot` contains the allowlisted shared campaign, import, store allocation and release collections. Referenced Product Master attributes are copied into `campaignProducts` for durable planning; this does not update the master catalog.

`black_betty_physical_snapshot` contains store layouts, category geometry, fixtures/zones and promotional display areas/sections. It has its own optimistic version. Editing planning never serializes physical collections, and physical editing never serializes planning.

Both documents are existing singletons protected by RLS and version triggers. Reads and mutations run through one local queue. Mutations commit against the last-loaded version; zero matching rows is a conflict. Failed writes restore the local committed checkpoint. `getCommittedSnapshot` allows the provider to render an accepted write without making a second fallible network call. Refresh explicitly fetches both remote documents.

Incomplete collection envelopes or invalid versions fail closed; they are not replaced with demo campaigns. Product references can still use seed attributes for historic demo records, but shared publication explicitly rejects synthetic products.

`SHARED_PLANNING_MUTATIONS` and `PHYSICAL_LAYOUT_MUTATIONS` are security-adjacent durability allowlists, not replacements for RLS. Methods whose full effects are not serialized (prototype ordering, legacy program operations, supplier intake, measurement and execution entry) reject before mutation. Add an operation only after its entire persistence scope and authorization are implemented and tested.

## Product Master

`SupabaseProductMasterLookup` reads the configured `public.product` contract; it does not fall back to `public.products`. Matching uses exact normalized SKUs and reports ambiguous/inactive/missing matches. A browser-safe publishable key is required (legacy anon key accepted); never supply a service-role key.

The app does not freshly re-query every Product Master attribute at publication. Latest imported/selected attributes and pending flags are validated. A dedicated final catalog refresh/reconciliation pass is a remaining integration improvement.

## Authorization and deployment

The read-only 21 September audit found buyer/admin SELECT and UPDATE policies for both planning and physical snapshots. This supersedes older admin-only physical-edit documentation. No permissions were changed by the hardening run. Store-scoped manager access is not implemented by these buyer/admin aggregate policies; printed packs are a manual distribution path.

Do not run bootstrap/seed SQL over the existing production documents. No SQL migration is needed for the optional release `executionData` JSON extension. Future per-campaign tables, narrower concurrent updates, audit history and store-scoped access require a reviewed migration/rollout plan.

See [architecture decision](../../../docs/ADR-0002-reliability-and-release-boundaries.md) and [production gate](../../../docs/PRODUCTION_GATE.md). Two-user and RLS browser checks require a deliberately isolated staging target; no production passwords belong in this repository.
