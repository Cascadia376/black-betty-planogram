import { beforeEach, describe, expect, it } from "vitest";
import { MockMerchandisingRepository } from "./MockMerchandisingRepository";
import { IDS, seedSnapshot } from "./seed";

describe("mock merchandising workflow", () => {
  beforeEach(() => window.localStorage.clear());

  it("creates a campaign, assignment, execution, and compliance review", async () => {
    const repository = new MockMerchandisingRepository();
    const source = seedSnapshot.campaigns[0];
    const campaignId = await repository.createCampaign({
      name: "Integration Test Feature", type: source.type, description: "Test campaign", startDate: "2026-09-01",
      endDate: "2026-09-30", owner: "Test owner", supplier: "Test supplier", products: source.products,
      requirement: source.requirement,
    });
    const assignment = await repository.assignCampaign({ campaignId, storeId: IDS.store, displayAreaId: IDS.endcapB, effectiveDate: "2026-09-01", notes: "Test assignment" });
    let state = await repository.load();
    const execution = state.executions.find((item) => item.assignmentId === assignment.id);
    expect(execution).toBeDefined();
    await repository.completeExecution({ executionId: execution!.id, note: "Complete", photoName: "test.jpg", unavailableSkus: [], substitutionRequested: false });
    await repository.reviewCompliance({ executionId: execution!.id, decision: "approved", comment: "Meets requirements", checks: [{ key: "products", label: "Required products present", passed: true, required: true }] });
    state = await repository.load();
    expect(state.complianceReviews.find((item) => item.executionId === execution!.id)).toEqual(expect.objectContaining({ score: 100, decision: "approved" }));
  });

  it("rejects an incompatible campaign assignment", async () => {
    const repository = new MockMerchandisingRepository();
    await expect(repository.assignCampaign({ campaignId: IDS.beerCampaign, storeId: IDS.store, displayAreaId: IDS.cooler14, effectiveDate: "2026-09-01", notes: "" })).rejects.toThrow("incompatible");
  });
});

