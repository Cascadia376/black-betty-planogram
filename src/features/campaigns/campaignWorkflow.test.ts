import { describe, expect, it } from "vitest";
import { IDS, seedSnapshot } from "../../adapters/mock/seed";
import { campaignDisplayReadiness, campaignProductReadiness, campaignProductSummary, campaignStepStatuses } from "./campaignWorkflow";

describe("campaign workflow readiness", () => {
  it("blocks Products when a campaign has no products", () => {
    const campaign = structuredClone(seedSnapshot.campaigns.find((item) => item.id === IDS.beerCampaign)!);
    campaign.products = [];
    expect(campaignStepStatuses(campaign, seedSnapshot, "campaign").products).toBe("blocked");
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

  it("blocks Products when no campaign products exist and leaves new display and store work not started", () => {
    const source = seedSnapshot.campaigns.find((item) => item.id === IDS.beerCampaign)!;
    const campaign = {
      ...source,
      products: [],
      requirement: { ...source.requirement, displayType: "flex" as const, priority: "standard" as const, signage: "", minimumSpace: "To be defined during display building", executionNotes: "", prescriptive: false },
    };
    const statuses = campaignStepStatuses(campaign, { ...seedSnapshot, assignments: [] }, "review");
    expect(statuses).toMatchObject({ campaign: "complete", products: "blocked", displays: "not_started", stores: "not_started", review: "current" });
  });

  it("summarizes pending and inactive products for review", () => {
    const source = seedSnapshot.campaigns.find((item) => item.id === IDS.beerCampaign)!;
    const campaign = {
      ...source,
      products: [
        { id: "verified", campaignId: source.id, productId: IDS.coastalLagerProduct, role: "Feature" as const, required: true },
        { id: "pending", campaignId: source.id, productId: IDS.pendingCampaignProduct, role: "Core" as const, required: true },
        { id: "inactive", campaignId: source.id, productId: IDS.inactiveCampaignProduct, role: "Optional" as const, required: false },
      ],
    };
    expect(campaignProductSummary(campaign, seedSnapshot)).toEqual({ total: 3, verified: 1, pending: 1, reviewRequired: 2 });
    expect(campaignStepStatuses(campaign, seedSnapshot, "review").products).toBe("warning");
  });

  it("marks Displays complete only when legacy display guidance exists", () => {
    expect(campaignStepStatuses(seedSnapshot.campaigns.find((item) => item.id === IDS.beerCampaign), seedSnapshot, "review").displays).toBe("complete");
  });

  it("warns on unassigned products and empty displays, then completes when merchandising choices are explicit", () => {
    const campaign = structuredClone(seedSnapshot.campaigns.find((item) => item.id === IDS.octoberCampaign)!);
    expect(campaignDisplayReadiness(campaign, seedSnapshot)).toMatchObject({ assigned: 2, shelfSupported: 1, unassigned: 1, emptyDisplays: 2, status: "warning" });
    const completed = structuredClone(seedSnapshot);
    completed.campaignDisplays = completed.campaignDisplays.filter((display) => display.campaignId !== campaign.id || display.name === "Feature Display");
    completed.campaigns.find((item) => item.id === campaign.id)!.products[3].merchandisingState = "SHELF_SUPPORTED";
    expect(campaignDisplayReadiness(completed.campaigns.find((item) => item.id === campaign.id), completed).status).toBe("complete");
  });
});
