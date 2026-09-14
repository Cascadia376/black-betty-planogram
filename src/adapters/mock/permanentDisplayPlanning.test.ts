import { beforeEach, describe, expect, it } from "vitest";
import { MockMerchandisingRepository } from "./MockMerchandisingRepository";

describe("planning products on permanent display areas", () => {
  beforeEach(() => window.localStorage.clear());

  it("reuses the physical area, includes its store and creates quantities for products added later", async () => {
    const repo = new MockMerchandisingRepository();
    const initial = await repo.load();
    const campaign = initial.campaigns.find((item) => item.products.length > 0)!;
    const area = initial.displayAreas.find((item) => item.active && !initial.campaignDisplayAssignments.some((placement) => placement.displayAreaId === item.id))!;
    const input = { campaignId: campaign.id, displayAreaId: area.id, display: { name: area.name, displayType: area.type, placementMode: "STORE_SPECIFIC" as const, prescriptive: false } };
    const display = await repo.createCampaignDisplay(input);
    await repo.assignCampaignProductsToDisplay({ campaignId: campaign.id, campaignDisplayId: display.id, campaignProductIds: [campaign.products[0].id] });
    const state = await new MockMerchandisingRepository().load();
    expect(state.displayAreas).toEqual(initial.displayAreas);
    expect(state.campaignStores).toContainEqual(expect.objectContaining({ campaignId: campaign.id, storeId: area.storeId, included: true }));
    const placement = state.campaignDisplayAssignments.find((item) => item.campaignDisplayId === display.id)!;
    expect(placement).toMatchObject({ displayAreaId: area.id, storeId: area.storeId, status: "ASSIGNED" });
    expect(state.campaignDisplayAssignmentProducts).toContainEqual(expect.objectContaining({ campaignDisplayAssignmentId: placement.id, productId: campaign.products[0].productId }));
    await expect(repo.createCampaignDisplay(input)).rejects.toThrow("overlapping");
    expect((await repo.load()).campaignDisplays).toHaveLength(state.campaignDisplays.length);
  });

  it("rejects unknown physical areas before changing the campaign", async () => {
    const repo = new MockMerchandisingRepository();
    const initial = await repo.load();
    await expect(repo.createCampaignDisplay({ campaignId: initial.campaigns[0].id, displayAreaId: "missing", display: { name: "Missing", displayType: "flex", placementMode: "STORE_SPECIFIC", prescriptive: false } })).rejects.toThrow("active permanent display area");
    expect(await repo.load()).toEqual(initial);
  });
});
