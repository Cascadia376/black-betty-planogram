import { beforeEach, describe, expect, it } from "vitest";
import type { CreateDisplayAssignmentInput } from "../../domain/repositories";
import type { PlatformSnapshot } from "../../domain/types";
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

  it("updates category spaces, duplicates layouts, and preserves display/campaign data", async () => {
    const repository = new MockMerchandisingRepository();
    const before = await repository.load();
    const sourceSpace = before.categorySpaces[0];
    await repository.updateCategorySpace({ categorySpaceId: sourceSpace.id, patch: { coolerDoorEquivalent: 0.5, notes: "Fractional test allocation" } });
    const draft = await repository.duplicateStoreLayout(IDS.crownLayout, "Proposed reset");
    let after = await repository.load();

    expect(after.categorySpaces.find((space) => space.id === sourceSpace.id)).toEqual(expect.objectContaining({ coolerDoorEquivalent: 0.5 }));
    expect(after.categorySpaces.filter((space) => space.layoutId === draft.id)).toHaveLength(before.categorySpaces.filter((space) => space.layoutId === IDS.crownLayout).length);
    expect(after.categorySpaceSections.filter((section) => after.categorySpaces.some((space) => space.layoutId === draft.id && space.id === section.categorySpaceId))).toHaveLength(before.categorySpaceSections.length);
    expect(after.displayAreas).toEqual(before.displayAreas);
    expect(after.campaigns).toEqual(before.campaigns);

    await repository.setCurrentStoreLayout(draft.id);
    after = await repository.load();
    expect(after.storeLayouts.find((layout) => layout.id === draft.id)?.status).toBe("current");
    expect(after.storeLayouts.find((layout) => layout.id === IDS.crownLayout)?.status).toBe("archived");
    expect(await repository.getStoreLayout(IDS.crownLayout)).toEqual(expect.objectContaining({ status: "archived" }));
  });

  it("searches Product Master and creates a visibly pending temporary product", async () => {
    const repository = new MockMerchandisingRepository();
    const results = await repository.searchProducts("Coastal Lager");
    expect(results.map((product) => product.sku)).toContain("MOCK-1001");

    const pending = await repository.createPendingProduct({ sku: "001234", name: "Synthetic New Product", category: "Wine", brand: "Synthetic Estate", packageSize: "750 mL", casePack: 6, supplierName: "Synthetic Supplier", notes: "Pending review" });
    expect(pending).toEqual(expect.objectContaining({ sku: "001234", masterStatus: "pending", active: true, brand: "Synthetic Estate", casePack: 6 }));
    await expect(repository.createPendingProduct({ sku: "001234", name: "Duplicate", category: "Wine" })).rejects.toThrow("already exists");
  });

  it("creates displays, moves product membership, and records display-specific metadata", async () => {
    const repository = new MockMerchandisingRepository();
    const first = await repository.createCampaignDisplay({ campaignId: IDS.octoberCampaign, display: { name: "Test feature", displayType: "feature_display", placementMode: "STANDARD", prescriptive: false } });
    const second = await repository.createCampaignDisplay({ campaignId: IDS.octoberCampaign, display: { name: "Test endcap", displayType: "endcap", placementMode: "STORE_SPECIFIC", prescriptive: true } });
    const productId = "54000000-0000-4000-8000-000000000004";
    const [member] = await repository.assignCampaignProductsToDisplay({ campaignId: IDS.octoberCampaign, campaignDisplayId: first.id, campaignProductIds: [productId] });
    await repository.updateCampaignDisplayProduct({ campaignDisplayProductId: member.id, patch: { role: "Hero", minimumFacings: 3, minimumQuantity: 6 } });
    await repository.assignCampaignProductsToDisplay({ campaignId: IDS.octoberCampaign, campaignDisplayId: second.id, campaignProductIds: [productId] });
    let state = await repository.load();
    expect(state.campaignDisplayProducts.filter((item) => item.campaignProductId === productId)).toHaveLength(1);
    expect(state.campaigns.find((item) => item.id === IDS.octoberCampaign)?.products.find((item) => item.id === productId)?.merchandisingState).toBe("DISPLAY_ASSIGNED");
    await repository.setCampaignProductShelfSupport(IDS.octoberCampaign, [productId]);
    state = await repository.load();
    expect(state.campaignDisplayProducts.some((item) => item.campaignProductId === productId)).toBe(false);
    expect(state.campaigns.find((item) => item.id === IDS.octoberCampaign)?.products.find((item) => item.id === productId)?.merchandisingState).toBe("SHELF_SUPPORTED");
  });

  it("edits full display guidance, maintains zero-or-one Hero, and reorders planning priority", async () => {
    const repository = new MockMerchandisingRepository();
    const first = await repository.createCampaignDisplay({ campaignId: IDS.octoberCampaign, display: { name: "Priority one", displayType: "feature_display", placementMode: "STANDARD", prescriptive: false } });
    const second = await repository.createCampaignDisplay({ campaignId: IDS.octoberCampaign, display: { name: "Priority two", displayType: "endcap", placementMode: "STORE_SPECIFIC", prescriptive: true } });
    await repository.updateCampaignDisplay({ campaignDisplayId: first.id, patch: { placementMode: "STORE_SPECIFIC", signage: "A-frame", minimumSpace: "4 ft", executionNotes: "Face forward", prescriptive: true } });
    const campaign = (await repository.load()).campaigns.find((item) => item.id === IDS.octoberCampaign)!;
    const members = await repository.assignCampaignProductsToDisplay({ campaignId: campaign.id, campaignDisplayId: first.id, campaignProductIds: campaign.products.slice(0, 2).map((item) => item.id) });
    await repository.updateCampaignDisplayProduct({ campaignDisplayProductId: members[0].id, patch: { role: "Hero", required: false, minimumFacings: 2, minimumQuantity: 4, note: "Front row" } });
    await repository.updateCampaignDisplayProduct({ campaignDisplayProductId: members[1].id, patch: { role: "Hero" } });
    await repository.reorderCampaignDisplay({ campaignDisplayId: second.id, direction: "up" });
    await repository.reorderCampaignDisplayProduct({ campaignDisplayProductId: members[1].id, direction: "up" });
    const state = await repository.load();
    expect(state.campaignDisplays.find((item) => item.id === first.id)).toEqual(expect.objectContaining({ placementMode: "STORE_SPECIFIC", signage: "A-frame", minimumSpace: "4 ft", executionNotes: "Face forward", prescriptive: true }));
    expect(state.campaignDisplayProducts.filter((item) => item.campaignDisplayId === first.id && item.role === "Hero")).toHaveLength(1);
    expect(state.campaignDisplayProducts.find((item) => item.id === members[0].id)).toEqual(expect.objectContaining({ role: "Supporting", required: false, minimumFacings: 2, minimumQuantity: 4, note: "Front row" }));
    expect(state.campaignDisplays.find((item) => item.id === second.id)!.sortOrder).toBeLessThan(state.campaignDisplays.find((item) => item.id === first.id)!.sortOrder);
    await repository.updateCampaignDisplayProduct({ campaignDisplayProductId: members[1].id, patch: { role: "Supporting" } });
    expect((await repository.load()).campaignDisplayProducts.filter((item) => item.campaignDisplayId === first.id && item.role === "Hero")).toHaveLength(0);
  });

  it("returns populated display products to Unassigned and removes empty displays cleanly", async () => {
    const repository = new MockMerchandisingRepository();
    const display = await repository.createCampaignDisplay({ campaignId: IDS.octoberCampaign, display: { name: "Temporary", displayType: "flex", placementMode: "STANDARD", prescriptive: false } });
    const campaign = (await repository.load()).campaigns.find((item) => item.id === IDS.octoberCampaign)!;
    await repository.assignCampaignProductsToDisplay({ campaignId: campaign.id, campaignDisplayId: display.id, campaignProductIds: [campaign.products[0].id] });
    await repository.removeCampaignDisplay(display.id);
    let state = await repository.load();
    expect(state.campaigns.find((item) => item.id === campaign.id)?.products[0].merchandisingState).toBe("UNASSIGNED");
    const empty = await repository.createCampaignDisplay({ campaignId: campaign.id, display: { name: "Empty", displayType: "flex", placementMode: "STANDARD", prescriptive: false } });
    await repository.removeCampaignDisplay(empty.id);
    state = await repository.load();
    expect(state.campaignDisplays.some((item) => item.id === empty.id)).toBe(false);
  });

  it("plans display allocations per store without matching display numbers, and preserves quantity overrides", async () => {
    const repository = new MockMerchandisingRepository();
    const state = await repository.load();
    const campaign = state.campaigns.find((item) => item.id === IDS.octoberCampaign)!;
    const display = state.campaignDisplays.find((item) => item.campaignId === campaign.id && item.name === "RTD Endcap")!;
    await repository.assignCampaignProductsToDisplay({ campaignId: campaign.id, campaignDisplayId: display.id, campaignProductIds: [campaign.products[0].id] });
    await repository.setCampaignStores({ campaignId: campaign.id, storeIds: [IDS.store, IDS.eagleStore] });
    const suggestions = await repository.suggestCampaignDisplay({ campaignId: campaign.id, campaignDisplayId: display.id });
    expect(suggestions).toHaveLength(2);
    expect(suggestions.every((item) => item.status === "SUGGESTED")).toBe(true);
    await repository.updateCampaignDisplayAssignment({ campaignDisplayAssignmentId: suggestions[0].id, displayAreaId: IDS.endcapB, status: "ASSIGNED" });
    await repository.updateCampaignDisplayAssignment({ campaignDisplayAssignmentId: suggestions[1].id, displayAreaId: IDS.eagleEndcapA, status: "ASSIGNED", placementSource: "BUYER_SELECTED" });
    const after = await repository.load();
    const assignments = after.campaignDisplayAssignments.filter((item) => item.campaignDisplayId === display.id);
    expect(assignments.map((item) => item.displayAreaId)).toEqual(expect.arrayContaining([IDS.endcapB, IDS.eagleEndcapA]));
    const product = after.campaignDisplayAssignmentProducts.find((item) => item.campaignDisplayAssignmentId === suggestions[0].id)!;
    await repository.updateCampaignDisplayAssignmentProduct({ campaignDisplayAssignmentProductId: product.id, caseQuantity: 9 });
    expect((await repository.load()).campaignDisplayAssignmentProducts.find((item) => item.id === product.id)).toEqual(expect.objectContaining({ caseQuantity: 9, buyerOverride: true }));
  });

  it("creates a campaign, assignment, execution, and compliance review", async () => {
    const repository = new MockMerchandisingRepository();
    const source = seedSnapshot.campaigns.find((item) => item.id === IDS.beerCampaign)!;
    const campaignId = await repository.createCampaign({
      name: "Integration Test Feature", type: source.type, description: "Test campaign", startDate: "2026-09-01",
      endDate: "2026-09-30", owner: "Test owner", supplier: "Test supplier", products: source.products,
      requirement: source.requirement,
    });
    expect((await repository.load()).campaigns.find((campaign) => campaign.id === campaignId)?.products.every((product) => product.campaignId === campaignId)).toBe(true);
    const assignment = await repository.assignCampaign({ campaignId, storeId: IDS.store, displayAreaId: IDS.endcapB, effectiveDate: "2026-09-01", notes: "Test assignment" });
    let state = await repository.load();
    const execution = state.executions.find((item) => item.assignmentId === assignment.id);
    expect(execution).toBeDefined();
    await repository.completeExecution({ executionId: execution!.id, note: "Complete", photoName: "test.jpg", unavailableSkus: [], substitutionRequested: false });
    await repository.reviewCompliance({ executionId: execution!.id, decision: "approved", comment: "Meets requirements", checks: [{ key: "products", label: "Required products present", passed: true, required: true }] });
    state = await repository.load();
    expect(state.complianceReviews.find((item) => item.executionId === execution!.id)).toEqual(expect.objectContaining({ score: 100, decision: "approved" }));
  });

  it("creates a metadata-only campaign with legacy display defaults", async () => {
    const repository = new MockMerchandisingRepository();
    const campaignId = await repository.createCampaign({
      name: "Synthetic OND Shell", type: "OND", description: "Phase 1 campaign shell", startDate: "2026-10-01",
      endDate: "2026-12-31", owner: "Test owner", supplier: "", products: [],
    });
    const campaign = (await repository.load()).campaigns.find((item) => item.id === campaignId);
    expect(campaign).toEqual(expect.objectContaining({ type: "OND", products: [], status: "draft" }));
    expect(campaign?.requirement).toEqual(expect.objectContaining({ displayType: "flex", prescriptive: false }));
  });

  it("manages Product Master campaign membership without duplicating product details", async () => {
    const repository = new MockMerchandisingRepository();
    await expect(repository.searchProducts("MOCK-1001")).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ name: "Coastal Lager 12 Pack" })]));
    await expect(repository.searchProducts("Harvest Red")).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ sku: "MOCK-2001" })]));
    await expect(repository.searchProducts("Gifts")).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ sku: "MOCK-OLD-9001", active: false })]));

    const campaignId = await repository.createCampaign({
      name: "Product Master Test", type: "OND", description: "", startDate: "2026-10-01", endDate: "2026-12-31", owner: "Test owner", supplier: "", products: [],
    });
    const added = await repository.addCampaignProducts({ campaignId, productIds: [IDS.coastalLagerProduct, IDS.harvestRedProduct, IDS.coastalLagerProduct] });
    expect(added).toHaveLength(2);
    expect(added.map((item) => item.productId)).toEqual([IDS.coastalLagerProduct, IDS.harvestRedProduct]);
    await expect(repository.addCampaignProducts({ campaignId, productIds: [IDS.coastalLagerProduct] })).resolves.toEqual([]);

    const updated = await repository.updateCampaignProduct({ campaignId, campaignProductId: added[0].id, patch: { role: "Optional", required: false } });
    expect(updated).toEqual(expect.objectContaining({ productId: IDS.coastalLagerProduct, role: "Optional", required: false }));
    await repository.removeCampaignProduct(campaignId, added[1].id);

    const campaign = (await repository.load()).campaigns.find((item) => item.id === campaignId);
    expect(campaign?.products).toEqual([expect.objectContaining({ productId: IDS.coastalLagerProduct, role: "Optional", required: false })]);
    expect((await repository.load()).products.find((product) => product.id === IDS.coastalLagerProduct)).toEqual(expect.objectContaining({ name: "Coastal Lager 12 Pack", category: "Beer" }));
  });

  it("does not write campaign import rows until an approved batch is applied", async () => {
    const repository = new MockMerchandisingRepository();
    const campaignId = await repository.createCampaign({ name: "Import Approval Test", type: "OND", description: "", startDate: "2026-10-01", endDate: "2026-12-31", owner: "Test owner", supplier: "", products: [] });
    expect((await repository.load()).campaigns.find((campaign) => campaign.id === campaignId)?.products).toEqual([]);
    const imported = await repository.applyCampaignProductImport({ campaignId, products: [{ productId: IDS.coastalLagerProduct, role: "Feature", required: false, note: "Imported note" }] });
    expect(imported).toEqual([expect.objectContaining({ productId: IDS.coastalLagerProduct, role: "Feature", required: false, note: "Imported note" })]);
    await expect(repository.applyCampaignProductImport({ campaignId, products: [{ productId: IDS.coastalLagerProduct, role: "Core", required: true }] })).rejects.toThrow("already belong");
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
    expect(state.orderRecommendations.find((item) => item.displayAssignmentId === IDS.ondEndcapAEarlyAssignment && item.productId === IDS.ondBridgeProduct)?.recommendationType).toBe("opening_fill");
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

  it("publishes a versioned program into direct display execution and reset tasks", async () => {
    const repository = new MockMerchandisingRepository();
    const result = await repository.publishProgram({ programId: IDS.ondProgram, publishedBy: "Test Merchandiser" });
    const state = await repository.load();

    expect(result).toEqual(expect.objectContaining({ version: 1, executionCount: 4, recommendationCount: 8 }));
    expect(state.programs.find((item) => item.id === IDS.ondProgram)?.status).toBe("active");
    expect(state.programStores.find((item) => item.id === IDS.ondCrownProgramStore)?.status).toBe("published");
    expect(state.programStores.find((item) => item.id === IDS.ondEagleProgramStore)?.status).toBe("not_started");
    const holidayReset = state.executions.find((item) => item.displayAssignmentId === IDS.ondEndcapAHolidayAssignment);
    expect(holidayReset).toEqual(expect.objectContaining({ taskType: "reset", dueDate: "2026-11-12" }));
    expect(holidayReset?.assignmentId).toBeUndefined();
    expect(state.programReleases[0]).toEqual(expect.objectContaining({ version: 1, publishedBy: "Test Merchandiser" }));
    expect(state.programReleases[0].assignments).toHaveLength(4);
  });

  it("maintains program store scope before allocations exist", async () => {
    const repository = new MockMerchandisingRepository();
    await repository.setProgramStore({ programId: IDS.ondProgram, storeId: IDS.eagleStore, included: false });
    let state = await repository.load();
    expect(state.programStores.find((item) => item.id === IDS.ondEagleProgramStore)).toEqual(expect.objectContaining({ included: false, status: "not_started" }));
    await repository.setProgramStore({ programId: IDS.ondProgram, storeId: IDS.eagleStore, included: true });
    state = await repository.load();
    expect(state.programStores.find((item) => item.id === IDS.ondEagleProgramStore)?.included).toBe(true);
  });

  it("keeps a frozen release snapshot when planning changes after publish", async () => {
    const repository = new MockMerchandisingRepository();
    await repository.publishProgram({ programId: IDS.ondProgram, publishedBy: "Test Merchandiser" });
    const before = await repository.load();
    const released = before.programReleases[0].assignments.find((item) => item.assignment.id === IDS.ondFeatureAssignment)!;
    const current = before.displayAssignments.find((item) => item.id === IDS.ondFeatureAssignment)!;
    const products = before.displayAssignmentProducts.filter((item) => item.assignmentId === current.id).map(toProductInput);
    await repository.updateDisplayAssignment(current.id, { assignment: { ...current, notes: "Post-publish planning change." }, products });
    const after = await repository.load();
    expect(after.displayAssignments.find((item) => item.id === current.id)?.notes).toBe("Post-publish planning change.");
    expect(after.programReleases[0].assignments.find((item) => item.assignment.id === current.id)?.assignment.notes).toBe(released.assignment.notes);
  });

  it("regenerates explainable recommendations and creates a supplier order with inbound stock", async () => {
    const repository = new MockMerchandisingRepository();
    const count = await repository.refreshOrderRecommendations({ programId: IDS.ondProgram, storeId: IDS.store });
    let state = await repository.load();
    expect(count).toBe(8);
    const recommendation = state.orderRecommendations.find((item) => item.displayAssignmentId === IDS.ondEndcapAEarlyAssignment && item.productId === IDS.ondHarvestProduct)!;
    const relatedBefore = state.orderRecommendations.find((item) => item.displayAssignmentId === IDS.ondFeatureAssignment && item.productId === IDS.ondHarvestProduct)!;
    expect(recommendation).toEqual(expect.objectContaining({ forecastConfidence: "high", forecastSource: "store_sku" }));
    expect(recommendation.forecastCases).toBeGreaterThan(0);

    const orderId = await repository.createPurchaseOrder({ storeId: IDS.store, supplierId: recommendation.supplierId, programId: IDS.ondProgram, recommendationIds: [recommendation.id] });
    state = await repository.load();
    expect(state.purchaseOrders.find((item) => item.id === orderId)?.lines).toEqual([expect.objectContaining({ recommendationId: recommendation.id, cases: recommendation.recommendedCases })]);
    expect(state.orderRecommendations.find((item) => item.id === recommendation.id)?.status).toBe("ordered");
    expect(state.inboundOrders).toContainEqual(expect.objectContaining({ productId: recommendation.productId, cases: recommendation.recommendedCases, status: "submitted" }));
    expect(state.orderRecommendations.find((item) => item.id === relatedBefore.id)?.recommendedCases).toBeLessThan(relatedBefore.recommendedCases);
  });
});

function toProductInput(product: PlatformSnapshot["displayAssignmentProducts"][number]): CreateDisplayAssignmentInput["products"][number] {
  return { productId: product.productId, sku: product.sku, caseQuantity: product.caseQuantity, required: product.required, minimumFacings: product.minimumFacings, preferredSupplierId: product.preferredSupplierId, note: product.note };
}
