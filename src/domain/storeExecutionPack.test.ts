import { beforeEach, describe, expect, it } from "vitest";
import { MockMerchandisingRepository } from "../adapters/mock/MockMerchandisingRepository";
import { MockProductMasterLookup } from "../adapters/mock/MockProductMasterLookup";
import { seedSnapshot } from "../adapters/mock/seed";
import { FlyerWorkbookImportAdapter, toApplyCampaignWorkbookImport } from "../adapters/import/FlyerWorkbookImportAdapter";
import { resolveWorkbookRow } from "../adapters/import/workbookReview";
import { octoberExecutionRows } from "../../tests/fixtures/octoberExecutionWorkbook";
import { buildStoreExecutionPack, executionGroup } from "./storeExecutionPack";

export async function importedExecutionCase() {
  const repo = new MockMerchandisingRepository();
  const data = await repo.load();
  const result = await new FlyerWorkbookImportAdapter().parseRows(octoberExecutionRows, { snapshot: data, productMaster: new MockProductMasterLookup(data.products) }, { sourceFileName: "OND 2026 execution test.xlsx", sourceSheet: "OND Worksheet", fingerprint: "execution-test" });
  const applied = await repo.applyCampaignWorkbookImport(toApplyCampaignWorkbookImport(result, result.suggestedCampaign));
  return { repo, result, campaignId: applied.campaignId, data: await repo.load() };
}

describe("store execution pack and explicit workbook decisions", () => {
  beforeEach(() => localStorage.clear());
  it("retains exact quantities and separates every required exception class", async () => {
    const { data, campaignId, result } = await importedExecutionCase();
    const crown = data.stores.find((item) => item.name === "Crown Isle")!;
    const port = data.stores.find((item) => item.name === "Port Alberni")!;
    const pack = buildStoreExecutionPack(data, campaignId, crown.id)!;
    expect(pack.builds.find((item) => item.code === "W8")?.products).toContainEqual(expect.objectContaining({ sku: "MOCK-2001", cases: 6, notes: "Face labels forward" }));
    expect(pack.shelf).toContainEqual(expect.objectContaining({ sku: "MOCK-3001", cases: 4 }));
    expect(pack.exceptions.map((item) => item.kind)).toEqual(expect.arrayContaining(["Missing display code", "Unmatched SKU", "Inactive SKU"]));
    expect(result.rows.find((item) => item.sku === "MOCK-OLD-9001")?.status).toBe("inactive");
    const smallPack = buildStoreExecutionPack(data, campaignId, port.id)!;
    expect(smallPack.exceptions).toContainEqual(expect.objectContaining({ kind: "Suggested alternative requiring approval", message: expect.stringContaining("3 cases") }));
    expect(smallPack.builds.some((item) => item.products.some((product) => product.sku === "MOCK-2001"))).toBe(false);
  });
  it("changes only one store when approving an alternative and keeps its quantities", async () => {
    const { repo, data, campaignId } = await importedExecutionCase();
    const assignment = data.campaignDisplayAssignments.find((item) => item.campaignId === campaignId && item.intendedDisplayCode === "W8" && item.status === "SUGGESTED")!;
    await repo.updateCampaignDisplayAssignment({ campaignDisplayAssignmentId: assignment.id, displayAreaId: assignment.suggestionDisplayAreaId!, status: "ASSIGNED", placementSource: "BUYER_SELECTED" });
    const after = await repo.load();
    expect(after.campaignDisplays).toEqual(data.campaignDisplays);
    expect(after.campaignDisplayAssignmentProducts).toEqual(data.campaignDisplayAssignmentProducts);
    expect(after.campaignDisplayAssignments.filter((item) => item.storeId !== assignment.storeId)).toEqual(data.campaignDisplayAssignments.filter((item) => item.storeId !== assignment.storeId));
    expect(buildStoreExecutionPack(after, campaignId, assignment.storeId)!.builds.flatMap((item) => item.products)).toContainEqual(expect.objectContaining({ sku: "MOCK-2001", cases: 3 }));
    await expect(repo.updateCampaignDisplayAssignment({ campaignDisplayAssignmentId: assignment.id, displayAreaId: assignment.suggestionDisplayAreaId!, status: "ASSIGNED" })).resolves.toBeDefined();
    expect(after.displayAreas).toEqual(data.displayAreas);
  });
  it("explicit no-display approval becomes shelf instructions, not a lost allocation", async () => {
    const { repo, data, campaignId } = await importedExecutionCase();
    const assignment = data.campaignDisplayAssignments.find((item) => item.campaignId === campaignId && item.intendedDisplayCode === "W8" && item.status === "SUGGESTED")!;
    await repo.updateCampaignDisplayAssignment({ campaignDisplayAssignmentId: assignment.id, displayAreaId: null, status: "EXCLUDED", note: "Buyer approved shelf support" });
    const pack = buildStoreExecutionPack(await repo.load(), campaignId, assignment.storeId)!;
    expect(pack.shelf).toContainEqual(expect.objectContaining({ sku: "MOCK-2001", cases: 3 }));
    expect(pack.exceptions.some((item) => item.id === assignment.id)).toBe(false);
  });
  it("preserves original cells while explicitly resolving a missing cross-store code", async () => {
    const { result } = await importedExecutionCase();
    const row = result.rows.find((item) => item.sku === "MOCK-1002")!;
    const resolved = resolveWorkbookRow(result, row.rowNumber, { kind: "display", code: "BR2" }, seedSnapshot);
    const updated = resolved.rows.find((item) => item.rowNumber === row.rowNumber)!;
    expect(updated.allocations).toEqual(row.allocations);
    expect(updated.source.displayLocalCode).toBeUndefined();
    expect(updated.source.reviewedDisplay).toEqual({ code: "BR2", required: true });
    expect(updated.displayLocalCode).toBe("BR2");
    expect(resolved.placements.find((item) => item.store.name === "Crown Isle" && item.displayLocalCode === "BR2")?.caseQuantity).toBe(14);
    expect(() => resolveWorkbookRow(result, row.rowNumber, { kind: "display", code: "guess" }, seedSnapshot)).toThrow("recognized");
  });
  it("rejects inactive and duplicate product approvals; keeps source SKU on an explicit correction", async () => {
    const { result } = await importedExecutionCase();
    const row = result.rows.find((item) => item.sku === "UNKNOWN-EXACT")!;
    const active = seedSnapshot.products.find((item) => item.sku === "MOCK-1003")!;
    const resolved = resolveWorkbookRow(result, row.rowNumber, { kind: "product", product: active }, seedSnapshot);
    expect(resolved.rows.find((item) => item.rowNumber === row.rowNumber)).toMatchObject({ sku: "MOCK-1003", status: "ready", source: { skuRaw: "UNKNOWN-EXACT", reviewedSku: "MOCK-1003" }, allocations: row.allocations });
    expect(() => resolveWorkbookRow(result, row.rowNumber, { kind: "product", product: { ...active, active: false } }, seedSnapshot)).toThrow("Inactive");
    expect(() => resolveWorkbookRow(result, row.rowNumber, { kind: "product", product: seedSnapshot.products.find((item) => item.sku === "MOCK-2001")! }, seedSnapshot)).toThrow("already approved");
  });
  it("does not replace missing store cases with campaign recommended quantities", async () => {
    const { data, campaignId } = await importedExecutionCase();
    const assignment = data.campaignDisplayAssignments.find((item) => item.campaignId === campaignId && item.status === "ASSIGNED")!;
    const product = data.campaignDisplayAssignmentProducts.find((item) => item.campaignDisplayAssignmentId === assignment.id)!;
    product.caseQuantity = undefined; product.recommendedCases = 99;
    const pack = buildStoreExecutionPack(data, campaignId, assignment.storeId)!;
    expect(pack.builds.find((item) => item.id === assignment.id)!.products[0].cases).toBeUndefined();
    expect(pack.exceptions.some((item) => item.message.includes("store cases"))).toBe(true);
    expect(buildStoreExecutionPack(data, "unknown", assignment.storeId)).toBeUndefined();
    expect(executionGroup("Uncategorized")).toBe("Category requires review");
    expect(executionGroup("Ready to drink")).toBe("Beer/RTD");
    expect(executionGroup("Spirits")).toBe("Spirits");
  });

  it("preserves workbook cases when resolving a missing product display after Apply", async () => {
    const { repo, data, campaignId } = await importedExecutionCase();
    const display = data.campaignDisplays.find((item) => item.campaignId === campaignId && item.sourceLocalCode === "BR2")!;
    const productId = data.products.find((item) => item.sku === "MOCK-1002")!.id;
    const campaignProduct = data.campaigns.find((item) => item.id === campaignId)!.products.find((item) => item.productId === productId)!;
    await repo.assignCampaignProductsToDisplay({ campaignId, campaignDisplayId: display.id, campaignProductIds: [campaignProduct.id] });
    const state = await repo.load();
    for (const [storeName, cases] of [["Crown Isle", 2], ["Port Alberni", 1]] as const) {
      const store = state.stores.find((item) => item.name === storeName)!;
      expect(buildStoreExecutionPack(state, campaignId, store.id)!.builds.flatMap((item) => item.products)).toContainEqual(expect.objectContaining({ sku: "MOCK-1002", cases }));
    }
    const placement = state.campaignDisplayAssignmentProducts.find((item) => item.productId === productId)!;
    await repo.updateCampaignDisplayAssignmentProduct({ campaignDisplayAssignmentProductId: placement.id, caseQuantity: 7 });
    await repo.assignCampaignProductsToDisplay({ campaignId, campaignDisplayId: display.id, campaignProductIds: [campaignProduct.id] });
    expect((await repo.load()).campaignDisplayAssignmentProducts).toContainEqual(expect.objectContaining({ campaignDisplayAssignmentId: placement.campaignDisplayAssignmentId, productId, caseQuantity: 7, buyerOverride: true }));
  });
});
