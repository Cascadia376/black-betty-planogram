import { beforeEach, describe, expect, it } from "vitest";
import type { CreateDisplayAssignmentInput } from "../../domain/repositories";
import { MockMerchandisingRepository } from "./MockMerchandisingRepository";
import { IDS, seedSnapshot } from "./seed";
import { cascadiaOndRows as fixture } from "../../../tests/fixtures/cascadiaOndRows";
import { CascadiaOndAllocationImportAdapter } from "../import/CascadiaOndAllocationImportAdapter";

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

  it("atomically writes an approved OND import batch", async () => {
    const repository = new MockMerchandisingRepository();
    const result = new CascadiaOndAllocationImportAdapter().parseRows(fixture, { programId: IDS.ondProgram, snapshot: seedSnapshot });
    await repository.applyOndImport(result.batch);
    const state = await repository.load();
    const imported = state.displayAssignments.filter((item) => item.storeId === IDS.eagleStore);
    expect(imported).toHaveLength(2);
    expect(state.displayAssignmentProducts.filter((item) => imported.some((assignment) => assignment.id === item.assignmentId))).toHaveLength(3);
    expect(state.supplierProductOptions).toContainEqual(expect.objectContaining({ productId: IDS.ondHolidayProduct, supplierId: IDS.ondPreferredSupplier }));
  });

  it("does not partially write an import batch when an assignment overlaps", async () => {
    const repository = new MockMerchandisingRepository();
    const result = new CascadiaOndAllocationImportAdapter().parseRows(fixture, { programId: IDS.ondProgram, snapshot: seedSnapshot });
    const invalidBatch = structuredClone(result.batch);
    invalidBatch.assignments.push(structuredClone(invalidBatch.assignments[0]));

    await expect(repository.applyOndImport(invalidBatch)).rejects.toThrow("cannot overlap");
    const state = await repository.load();
    expect(state.displayAssignments.filter((item) => item.storeId === IDS.eagleStore)).toEqual([]);
  });

  it("updates an assignment and replaces its store-specific quantities", async () => {
    const repository = new MockMerchandisingRepository();
    const input = ondAssignmentInput();
    const assignment = await repository.createDisplayAssignment(input);
    await repository.updateDisplayAssignment(assignment.id, {
      assignment: { ...input.assignment, notes: "Updated in allocation planner." },
      products: input.products.map((product, index) => ({ ...product, caseQuantity: index === 0 ? 24 : product.caseQuantity })),
    });
    const state = await repository.load();
    expect(state.displayAssignments.find((item) => item.id === assignment.id)?.notes).toBe("Updated in allocation planner.");
    expect(state.displayAssignmentProducts.filter((item) => item.assignmentId === assignment.id).map((item) => item.caseQuantity)).toEqual([24, 6]);
  });

  it("rejects a missing case quantity for a required assignment product", async () => {
    const repository = new MockMerchandisingRepository();
    const input = ondAssignmentInput();
    input.products[0].caseQuantity = 0;
    await expect(repository.createDisplayAssignment(input)).rejects.toThrow("case quantity of at least one");
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
      strategy: "BRIDGE_BUY",
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
      strategy: "BRIDGE_BUY",
      eligibility: "review",
      bridgeHorizonDays: 14,
      maxWeeksOfSupply: 2,
      maxCases: 12,
      note: "Synthetic test buying decision.",
    });
  });

  it("loads synthetic supplier, inventory, inbound, and recommendation data", async () => {
    const state = await new MockMerchandisingRepository().load();
    expect(state.suppliers.map((supplier) => supplier.name)).toEqual(expect.arrayContaining(["Mock Coastal Distribution", "Mock Island Wholesale"]));
    expect(state.inventoryPositions.find((position) => position.productId === IDS.ondHarvestProduct)?.onHandCases).toBe(5);
    expect(state.inboundOrders.find((order) => order.id === IDS.ondInboundOrder)).toEqual(expect.objectContaining({ cases: 2, status: "confirmed" }));
    expect(state.orderRecommendations.find((recommendation) => recommendation.id === IDS.ondOpeningRecommendation)).toEqual(expect.objectContaining({ recommendationType: "opening_fill", status: "pending" }));
    expect(state.historicalDemand.some((record) => record.storeId === IDS.store && record.productId === IDS.ondHarvestProduct)).toBe(true);
  });

  it("persists store-manager ordering actions without changing buying policy", async () => {
    const repository = new MockMerchandisingRepository();
    await repository.updateOrderRecommendation({ id: IDS.ondBridgeRecommendation, status: "edited", recommendedCases: 10, note: "Store manager mock note." });
    const state = await repository.load();
    expect(state.orderRecommendations.find((item) => item.id === IDS.ondBridgeRecommendation)).toEqual(expect.objectContaining({ status: "edited", recommendedCases: 10, note: "Store manager mock note.", recommendationType: "bridge_buy" }));
    expect(state.bridgeStrategies.find((item) => item.productId === IDS.ondBridgeProduct)?.eligibility).toBe("yes");
  });
});
