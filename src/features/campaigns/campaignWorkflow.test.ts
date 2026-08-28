import { describe, expect, it } from "vitest";
import { IDS, seedSnapshot } from "../../adapters/mock/seed";
import { campaignProductReadiness, campaignStepStatuses } from "./campaignWorkflow";

describe("campaign workflow readiness", () => {
  it("treats a campaign with no products as not started for Products", () => {
    const campaign = structuredClone(seedSnapshot.campaigns.find((item) => item.id === IDS.beerCampaign)!);
    campaign.products = [];
    expect(campaignStepStatuses(campaign, seedSnapshot, "campaign").products).toBe("not_started");
  });

  it("marks Products complete when all campaign products are active and verified", () => {
    const campaign = structuredClone(seedSnapshot.campaigns.find((item) => item.id === IDS.beerCampaign)!);
    campaign.products = [{ id: "verified-campaign-product", campaignId: campaign.id, productId: IDS.coastalLagerProduct, role: "Feature", required: true }];
    expect(campaignProductReadiness(campaign, seedSnapshot)).toEqual(expect.objectContaining({ total: 1, verified: 1, needsReview: 0 }));
    expect(campaignStepStatuses(campaign, seedSnapshot, "campaign").products).toBe("complete");
  });

  it("allows planning to continue but warns when pending or inactive products need review", () => {
    const campaign = structuredClone(seedSnapshot.campaigns.find((item) => item.id === IDS.beerCampaign)!);
    campaign.products = [
      { id: "pending-campaign-product", campaignId: campaign.id, productId: IDS.pendingCampaignProduct, role: "Supporting", required: true },
      { id: "inactive-campaign-product", campaignId: campaign.id, productId: IDS.inactiveCampaignProduct, role: "Optional", required: false },
    ];
    expect(campaignProductReadiness(campaign, seedSnapshot)).toEqual(expect.objectContaining({ total: 2, pending: 1, inactive: 1, needsReview: 2 }));
    expect(campaignStepStatuses(campaign, seedSnapshot, "campaign").products).toBe("warning");
  });
});
