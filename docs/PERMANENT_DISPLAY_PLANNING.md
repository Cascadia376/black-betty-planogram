# Permanent display planning

The campaign Displays step exposes active `DisplayArea` records from the same store inventory used by the floorplan. Choose a store, find an area by name or local code, and select **Use this area**. This includes the store and creates a campaign display with a dated placement referencing the existing physical area. The physical record is not copied or changed.

Select campaign products in the Product pool, then use **Add / move selected**. Products added after placement receive store quantity records. Review quantities in the Stores step. The existing campaign model moves products between campaign displays; it does not create independent per-store assortments.

Areas occupied by an overlapping accepted campaign placement are disabled. Existing placements in this campaign can be selected again for product assignment without creating duplicates. Inactive areas are excluded. Capacity and verification details remain governed by the physical store model.

Planning changes continue to use the existing browser-local repository. Live Supabase Product Master matching does not provide shared campaign persistence.
