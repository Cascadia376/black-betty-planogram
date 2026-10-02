import type { CampaignRelease, PlatformSnapshot } from "./types";

/** Freeze the fields used by the manager pack, not the entire demo/analytics model. */
export function campaignReleaseSnapshot(data: PlatformSnapshot, campaignId: string): CampaignRelease["snapshot"] {
  const campaign = data.campaigns.find((item) => item.id === campaignId);
  if (!campaign) throw new Error("Campaign was not found.");
  const stores = data.campaignStores.filter((item) => item.campaignId === campaignId);
  const storeIds = new Set(stores.filter((item) => item.included).map((item) => item.storeId));
  const displays = data.campaignDisplays.filter((item) => item.campaignId === campaignId);
  const displayIds = new Set(displays.map((item) => item.id));
  const allocations = data.campaignDisplayAssignments.filter((item) => item.campaignId === campaignId && storeIds.has(item.storeId));
  const assignmentIds = new Set(allocations.map((item) => item.id));
  const areaIds = new Set(allocations.flatMap((item) => item.displayAreaId ? [item.displayAreaId] : []));
  const productIds = new Set(campaign.products.map((item) => item.productId));
  return structuredClone({
    campaign, stores, displays,
    displayProducts: data.campaignDisplayProducts.filter((item) => displayIds.has(item.campaignDisplayId)),
    allocations,
    allocationProducts: data.campaignDisplayAssignmentProducts.filter((item) => assignmentIds.has(item.campaignDisplayAssignmentId)),
    executionData: {
      products: data.products.filter((item) => productIds.has(item.id)),
      stores: data.stores.filter((item) => storeIds.has(item.id)),
      storeLayouts: data.storeLayouts.filter((item) => storeIds.has(item.storeId) && item.status === "current"),
      displayAreas: data.displayAreas.filter((item) => areaIds.has(item.id)),
      displayAreaSections: data.displayAreaSections.filter((item) => areaIds.has(item.displayAreaId)),
      campaignImports: data.campaignImports.filter((item) => item.campaignId === campaignId),
      campaignStoreProductAllocations: data.campaignStoreProductAllocations.filter((item) => item.campaignId === campaignId && storeIds.has(item.storeId)),
    },
  });
}

/** Ignore publication bookkeeping; unchanged repeated submissions are a no-op. */
export function sameReleaseContent(left: CampaignRelease["snapshot"], right: CampaignRelease["snapshot"]): boolean {
  const content = (value: CampaignRelease["snapshot"]) => {
    const result = structuredClone(value);
    result.campaign.status = "draft";
    delete result.campaign.programId;
    result.stores.forEach((store) => { store.status = "PLANNING"; });
    return JSON.stringify(result);
  };
  return content(left) === content(right);
}

/** Legacy releases cannot be silently rendered using current, unpublished data. */
export function snapshotForRelease(data: PlatformSnapshot, release: CampaignRelease): PlatformSnapshot | undefined {
  const snapshot = release.snapshot;
  if (!snapshot.executionData) return undefined;
  return {
    ...data, ...structuredClone(snapshot.executionData),
    campaigns: [structuredClone(snapshot.campaign)],
    campaignStores: structuredClone(snapshot.stores),
    campaignDisplays: structuredClone(snapshot.displays),
    campaignDisplayProducts: structuredClone(snapshot.displayProducts),
    campaignDisplayAssignments: structuredClone(snapshot.allocations),
    campaignDisplayAssignmentProducts: structuredClone(snapshot.allocationProducts),
  };
}
