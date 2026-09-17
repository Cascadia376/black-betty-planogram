# Physical reference and campaign planning boundary

## Audit findings

1. The first shared planning document stores both campaign state and the following physical/reference collections: `storeLayouts`, `categorySpaces`, `categorySpaceSections`, `zones`, `fixtures`, `displayAreas`, and `displayAreaSections`. Consequently, every campaign save serializes canonical physical data back alongside the campaign.
2. All mutating `MerchandisingRepository` methods currently flow through the same Supabase proxy and versioned document write. Campaign operations therefore write the document containing physical reference collections even when those collections did not change.
3. Floorplan drag/resize is canonical-only today. `FloorplanCanvas` passes a `DisplayArea` or `DisplayAreaSection` geometry target to `PhysicalStoreFloorplanPage`, which calls `updateDisplayArea`. No campaign-specific placement geometry type or storage exists. Opening the floorplan in campaign context does not change that ownership.
4. Intentional physical mutations are `updateCategorySpace`, `createStoreLayout`, `duplicateStoreLayout`, `setCurrentStoreLayout`, `createDisplayArea`, `updateDisplayArea`, and `deleteDisplayArea`. They change layout versions, category-space reference data, DisplayArea definitions, or canonical geometry.
5. The UI and `PlatformProvider` currently expose those methods to both Black Betty `buyer` and `admin` roles. The shared-document RLS policy likewise permits both roles to update the row, so browser UI hiding alone would not protect the physical data.
6. The smallest safe production change is to move physical/reference collections into a separately versioned Supabase document, allow buyers/admins to read it, allow only admins to update it, classify the physical mutation methods explicitly in the repository adapter, and expose physical editing only inside an explicit admin layout-management mode. Campaign persistence must never serialize physical collections.

## Ownership invariants

### Canonical physical reference data

`StoreLayout`, `CategorySpace`, `CategorySpaceSection`, `StoreZone`, `Fixture`, `DisplayArea`, `DisplayAreaSection`, canonical geometry, layout versions, verification status, and physical source references are authoritative. Normal campaign operations may read and reference these objects by ID but must not update them.

### Campaign working data

Campaign headers, products, displays, participating stores, store/product allocations, display assignments and assignment products, imports/provenance, notes/status, releases, and other campaign execution state are ordinary shared planning data. A campaign placement references a canonical `DisplayArea` by `displayAreaId`; it does not own or rewrite that area's geometry.

Campaign-specific geometry overrides are not currently supported. If introduced later, they must be a distinct campaign-owned type keyed by campaign/store/assignment and must never be stored in `DisplayArea.geometry`.

## Authorization invariant

- Authenticated Black Betty buyers and admins may read both documents and update campaign planning.
- Only admins may update the physical reference document.
- Physical edits require the explicit layout-management mode; campaign-context floorplans remain read-only even for admins.
- Database RLS is authoritative. UI and repository checks provide clearer feedback but are not the security boundary.

The application serializes these documents from disjoint allowlists. The database also rejects a planning document containing any physical-reference collection key, so a buyer cannot reintroduce canonical objects through the planning write path.

## Production gate

Apply migrations in timestamp order: access/role setup, shared planning snapshot, `20260917164730_harden_physical_reference_boundary.sql`, then `20260917181555_initialize_black_betty_planning_shape.sql`. Do not enable production campaign planning until all of the following pass against the production Supabase project with separate buyer and admin accounts:

1. Both accounts can read the same planning and physical snapshots.
2. A buyer can save a campaign change, the planning version increments, and the physical version and JSON remain unchanged.
3. A direct buyer update to `black_betty_physical_snapshot.physical` is rejected by RLS.
4. An admin can enter layout-management mode, move one test DisplayArea, and increment only the physical version.
5. The campaign-context floorplan exposes no drag, resize, category edit, DisplayArea edit, layout duplication, or layout activation controls, including for an admin.
6. Jeremy and Cherie reproduce the shared stale-write conflict flow, then complete the real OND stable-map and October/November/December order-plan checks.
