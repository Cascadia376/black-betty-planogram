import { beforeEach, describe, expect, it } from "vitest";
import { MockMerchandisingRepository } from "../mock/MockMerchandisingRepository";
import { MockProductMasterLookup } from "../mock/MockProductMasterLookup";
import { IDS, seedSnapshot } from "../mock/seed";
import { FlyerWorkbookImportAdapter, campaignWorkbookImportKey, toApplyCampaignWorkbookImport, validateWorkbookCampaignPeriod } from "./FlyerWorkbookImportAdapter";
import { createFlyerWorkbook } from "../../../tests/fixtures/flyerWorkbook";
import { stableProductIdForSku, type ProductMasterLookup } from "../../services/products/ProductMasterLookup";

const adapter = new FlyerWorkbookImportAdapter();
const context = { snapshot: seedSnapshot, productMaster: new MockProductMasterLookup(seedSnapshot.products) };
const planningHeaders = ["Vendor", "Category", "INV_NUM", "Product", "Order From", "LTO Month", "Display", "Display Area", "Oct Flyer", "Nov Flyer", "Dec Flyer", "Notes", "Crown Isle", "Port Alberni", "Total Cases"];

function planningRow(sku: string, product: string, options: { display?: string; code?: string; months?: string[]; crown?: unknown; port?: unknown } = {}) {
  return ["Mock", "WINE", sku, product, "", "", options.display ?? "", options.code ?? "", options.months?.includes("OCT") ? "Y" : "", options.months?.includes("NOV") ? "Y" : "", options.months?.includes("DEC") ? "Y" : "", "", options.crown ?? "", options.port ?? "", ""];
}

function parsePlanning(rows: unknown[][], fingerprint = "planning-fingerprint", fileName = "OND 2025 Worksheet.xlsx") {
  return adapter.parseRows([planningHeaders, ...rows], context, { sourceFileName: fileName, sourceSheet: "Sheet1", fingerprint });
}

describe("flyer workbook import adapter", () => {
  beforeEach(() => window.localStorage.clear());

  it("reconciles a monthly flyer by exact SKU, infers dates, and preserves promotion metadata", async () => {
    const result = await adapter.parseRows([
      ["Vendor", "", "SKU", "Product", "Selling Price", "Savings", "Sale Price", "Size", "Points", "LTOs", "Additional Notes"],
      ["Mock Coast", "BEER", "mock-1001", "Different supporting name", 20.99, 2, 18.99, "12x355ml", "2X", 2, "September LTO, Preordered for you"],
      ["", "", "", "Giveaways", "", "", "", "", "", "", ""],
      ["Mock Vendor", "BEER", "", "Product awaiting SKU", 15.99, "", 15.99, "6x355ml", "", "NA", ""],
    ], context, { sourceFileName: "09 September Flyer 2026.xlsx", sourceSheet: "September Flyer", fingerprint: "flyer-fingerprint" });

    expect(result.workbookKind).toBe("monthly_flyer");
    expect(result.campaignPeriodInferred).toBe(true);
    expect(result.suggestedCampaign).toMatchObject({ startDate: "2026-09-01", endDate: "2026-09-30", type: "Monthly flyer" });
    expect(result.rows[0]).toMatchObject({ status: "ready", sku: "MOCK-1001", product: { id: IDS.coastalLagerProduct } });
    expect(result.rows[0].source).toMatchObject({ skuRaw: "mock-1001", sellingPrice: 20.99, savings: 2, salePrice: 18.99, wholesaleLtoAmount: 2, loyaltyPointsMultiplier: 2, additionalNotes: "September LTO, Preordered for you" });
    expect(result.rows[0].allocations).toEqual([]);
    expect(result.placements).toEqual([]);
    expect(result.rows[1]).toMatchObject({ status: "information", productName: "Giveaways" });
    expect(result.rows[2]).toMatchObject({ status: "invalid", issues: [{ code: "missing_sku" }] });
  });

  it("requires review when a monthly flyer period cannot be inferred", async () => {
    const result = await adapter.parseRows([
      ["Vendor", "", "SKU", "Product", "Selling Price", "Savings", "Sale Price", "Size", "Points", "LTOs", "Additional Notes"],
      ["Mock", "BEER", "MOCK-1001", "Coastal Lager", 20, 2, 18, "", "", "", ""],
    ], context, { sourceFileName: "Current Flyer.xlsx", sourceSheet: "Flyer", fingerprint: "unknown-period" });
    expect(result.campaignPeriodInferred).toBe(false);
    expect(result.suggestedCampaign).toMatchObject({ type: "Monthly flyer", startDate: "", endDate: "" });
  });

  it("recognizes the sanitized workbook sheet through the file parser", async () => {
    const bytes = createFlyerWorkbook();
    const file = new File([bytes.slice().buffer], "09 September Flyer 2026.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const result = await adapter.parse(file, context);
    expect(result.sheetNames).toEqual(["September Flyer"]);
    expect(result.rows.map((row) => row.status)).toEqual(["ready", "ready", "information"]);
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("creates one OND campaign and retains different monthly participation flags", async () => {
    const result = await parsePlanning([
      planningRow("MOCK-1001", "Coastal Lager", { months: ["OCT"], crown: 2 }),
      planningRow("MOCK-2001", "Harvest Red", { months: ["NOV", "DEC"], crown: 3 }),
    ]);
    expect(result.workbookKind).toBe("ond");
    expect(result.suggestedCampaign).toMatchObject({ type: "OND", startDate: "2025-10-01", endDate: "2025-12-31" });
    expect(result.rows.map((row) => row.source.flyerMonths)).toEqual([["OCT"], ["NOV", "DEC"]]);
    expect(result.rows.map((row) => row.status)).toEqual(["ready", "ready"]);
    expect(validateWorkbookCampaignPeriod("ond", result.suggestedCampaign)).toEqual([]);
    expect(validateWorkbookCampaignPeriod("ond", { startDate: "2025-10-01", endDate: "2025-10-31" })).toContain("An OND campaign must span October 1 through December 31 of one year.");
  });

  it("blocks blank, TBD, compound, duplicate, and unmatched OND SKUs distinctly", async () => {
    const result = await parsePlanning([
      planningRow("", "Real product missing SKU", { crown: 1 }), planningRow("TBD", "Real TBD product", { crown: 1 }),
      planningRow("117/772525", "Compound product", { crown: 1 }), planningRow("MOCK-1001", "First exact product", { crown: 1 }),
      planningRow("MOCK-1001", "Duplicate exact product", { crown: 1 }), planningRow("UNKNOWN-1", "Unmatched product", { crown: 1 }),
    ]);
    expect(result.rows.map((row) => row.status)).toEqual(["invalid", "invalid", "invalid", "ready", "duplicate", "unmatched"]);
    expect(result.rows.map((row) => row.issues[0]?.code)).toEqual(["missing_sku", "tbd_sku", "compound_sku", undefined, "duplicate_sku", "unmatched_sku"]);
  });

  it("maps exact displays, keeps case quantities, and leaves repurposing unaccepted", async () => {
    const result = await parsePlanning([planningRow("MOCK-2001", "Harvest Red Blend", { display: "Y", code: "W8", months: ["OCT"], crown: 6, port: 3 })]);
    const crown = result.placements.find((item) => item.store.id === IDS.store)!;
    const port = result.placements.find((item) => item.store.name === "Port Alberni")!;
    expect(crown).toMatchObject({ status: "ASSIGNED", displayArea: { code: "CI-W8" }, caseQuantity: 6 });
    expect(port).toMatchObject({ status: "SUGGESTED", caseQuantity: 3 });
    expect(port.displayArea).toBeUndefined();
    const input = toApplyCampaignWorkbookImport(result, result.suggestedCampaign);
    expect(input.rows[0].allocations).toEqual(expect.arrayContaining([{ storeId: IDS.store, quantityCases: 6 }]));
    expect(input.placements.find((item) => item.storeId === port.store.id)).toMatchObject({ status: "SUGGESTED", displayAreaId: undefined, suggestionDisplayAreaId: port.suggestion?.id });
  });

  it("uses the Product Master boundary and returns stable SKU-backed identity", async () => {
    const requested: string[][] = [];
    const lookup: ProductMasterLookup = { async findByExactSkus(skus) { requested.push(skus); return { products: [seedSnapshot.products.find((product) => product.sku === "MOCK-1001")!], ambiguousSkus: [] }; } };
    const result = await adapter.parseRows([planningHeaders, planningRow("mock-1001", "Supporting name", { crown: 1 })], { snapshot: seedSnapshot, productMaster: lookup }, { sourceFileName: "OND 2025.xlsx", sourceSheet: "Sheet1", fingerprint: "lookup" });
    expect(requested).toEqual([["MOCK-1001"]]);
    expect(result.rows[0].status).toBe("ready");
    expect(await stableProductIdForSku(" mock-1001 ")).toBe(await stableProductIdForSku("MOCK-1001"));
  });

  it("includes workbook kind and normalized period in duplicate identity", async () => {
    const ond = await parsePlanning([planningRow("MOCK-1001", "Coastal Lager", { crown: 1 })], "same-sha");
    const monthly = await adapter.parseRows([
      ["Vendor", "", "SKU", "Product", "Selling Price", "Savings", "Sale Price", "Size", "Points", "LTOs", "Additional Notes"],
      ["Mock", "BEER", "MOCK-1001", "Coastal Lager", 20, 2, 18, "", "", "", ""],
    ], context, { sourceFileName: "09 September Flyer 2026.xlsx", sourceSheet: "Flyer", fingerprint: "same-sha" });
    expect(campaignWorkbookImportKey(ond, ond.suggestedCampaign)).toBe("flyer-workbook-import-v1 | same-sha | ond | 2025-10-01/2025-12-31");
    expect(campaignWorkbookImportKey(monthly, monthly.suggestedCampaign)).toBe("flyer-workbook-import-v1 | same-sha | monthly_flyer | 2026-09");
  });

  it("applies one OND draft and blocks the same workbook and period twice", async () => {
    const repository = new MockMerchandisingRepository();
    const snapshot = await repository.load();
    const result = await new FlyerWorkbookImportAdapter().parseRows([
      planningHeaders,
      planningRow("MOCK-2001", "Harvest Red", { display: "Y", code: "W8", months: ["OCT"], crown: 6, port: 3 }),
      planningRow("MOCK-1001", "Coastal Lager", { months: ["DEC"], crown: 2, port: 1 }),
    ], { snapshot, productMaster: new MockProductMasterLookup(snapshot.products) }, { sourceFileName: "OND 2026 Worksheet.xlsx", sourceSheet: "Sheet1", fingerprint: "atomic-import" });
    const input = toApplyCampaignWorkbookImport(result, result.suggestedCampaign);
    const applied = await repository.applyCampaignWorkbookImport(input);
    const state = await repository.load();

    expect(state.campaigns.find((item) => item.id === applied.campaignId)).toMatchObject({ type: "OND", startDate: "2026-10-01", endDate: "2026-12-31", status: "draft" });
    expect(state.campaignImports.find((item) => item.id === applied.importId)).toMatchObject({ importKey: input.importKey, workbookKind: "ond", rows: [{ flyerMonths: ["OCT"] }, { flyerMonths: ["DEC"] }] });
    expect(state.campaignStoreProductAllocations.filter((item) => item.campaignId === applied.campaignId)).toHaveLength(4);
    expect(state.campaignDisplayAssignmentProducts.some((item) => item.caseQuantity === 6 && item.quantitySource === "SPREADSHEET")).toBe(true);
    expect(state.campaignDisplayAssignments.find((item) => item.campaignId === applied.campaignId && item.storeId === snapshot.stores.find((store) => store.name === "Port Alberni")?.id)).toMatchObject({ status: "SUGGESTED", displayAreaId: undefined });
    await expect(repository.applyCampaignWorkbookImport(input)).rejects.toThrow("already been applied");
  });

  it("blocks the same monthly flyer workbook and month twice", async () => {
    const repository = new MockMerchandisingRepository();
    const snapshot = await repository.load();
    const productMaster = new MockProductMasterLookup(snapshot.products);
    const result = await adapter.parseRows([
      ["Vendor", "", "SKU", "Product", "Selling Price", "Savings", "Sale Price", "Size", "Points", "LTOs", "Additional Notes"],
      ["Mock", "BEER", "MOCK-1001", "Coastal Lager", 20, 2, 18, "", "", "", ""],
    ], { snapshot, productMaster }, { sourceFileName: "09 September Flyer 2026.xlsx", sourceSheet: "Flyer", fingerprint: "monthly-duplicate" });
    const input = toApplyCampaignWorkbookImport(result, result.suggestedCampaign);
    await repository.applyCampaignWorkbookImport(input);
    await expect(repository.applyCampaignWorkbookImport(input)).rejects.toThrow("already been applied");
  });
});
