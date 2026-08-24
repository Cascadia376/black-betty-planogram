import { beforeEach, describe, expect, it } from "vitest";
import type { CreateDisplayAssignmentInput } from "../../domain/repositories";
import { MockMerchandisingRepository } from "./MockMerchandisingRepository";
import { IDS, seedSnapshot } from "./seed";

function ondAssignmentInput(startDate = "2026-10-01", endDate = "2026-11-11"): CreateDisplayAssignmentInput {
  return {
    assignment: {
      programId: IDS.ondProgram,
      periodId: IDS.ondEarlyPeriod,
      storeId: IDS.store,
      displayAreaId: IDS.endcapB,
      startDate,
      endDate,
      resetRequired: true,
      notes: "Synthetic repository test assignment.",
      status: "planned",
    },
    products: [
      {
        productId: IDS.ondHarvestProduct,
        sku: "MOCK-OND-1001",
        caseQuantity: 18,
        required: true,
        minimumFacings: 3,
        preferredSupplierId: IDS.ondPreferredSupplier,
      },
      {
        productId: IDS.ondBridgeProduct,
        sku: "MOCK-OND-1002",
        caseQuantity: 6,
        required: false,
      },
    ],
  };
}

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

  it("persists case quantities on assignment products", async () => {
    const repository = new MockMerchandisingRepository();
    const assignment = await repository.createDisplayAssignment(ondAssignmentInput());
    const state = await repository.load();
    const products = state.displayAssignmentProducts.filter((item) => item.assignmentId === assignment.id);
    expect(products.map((item) => item.caseQuantity)).toEqual([18, 6]);
    expect(products[0].preferredSupplierId).toBe(IDS.ondPreferredSupplier);
  });

  it("rejects overlapping OND assignments on one display", async () => {
    const repository = new MockMerchandisingRepository();
    await repository.createDisplayAssignment(ondAssignmentInput());
    await expect(repository.createDisplayAssignment(ondAssignmentInput("2026-11-01", "2026-11-11")))
      .rejects.toThrow("cannot overlap");
  });

  it("persists a bridge strategy across mock repository instances", async () => {
    const repository = new MockMerchandisingRepository();
    await repository.saveBridgeStrategy({
      productId: IDS.ondBridgeProduct,
      eligibility: "review",
      bridgeHorizonDays: 14,
      maxWeeksOfSupply: 2,
      maxCases: 12,
      note: "Synthetic test buying decision.",
    });

    const reloadedRepository = new MockMerchandisingRepository();
    const state = await reloadedRepository.load();
    expect(state.bridgeStrategies.find((item) => item.productId === IDS.ondBridgeProduct)).toEqual({
      productId: IDS.ondBridgeProduct,
      eligibility: "review",
      bridgeHorizonDays: 14,
      maxWeeksOfSupply: 2,
      maxCases: 12,
      note: "Synthetic test buying decision.",
    });
  });
});
