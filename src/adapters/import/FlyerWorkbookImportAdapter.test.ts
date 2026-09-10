import { beforeEach, describe, expect, it } from "vitest";
import { MockMerchandisingRepository } from "../mock/MockMerchandisingRepository";
import { IDS, seedSnapshot } from "../mock/seed";
import { FlyerWorkbookImportAdapter, toApplyCampaignWorkbookImport } from "./FlyerWorkbookImportAdapter";
import { createFlyerWorkbook } from "../../../tests/fixtures/flyerWorkbook";

const adapter = new FlyerWorkbookImportAdapter();
const context = { snapshot: seedSnapshot };

const planningHeaders = [
  "Vendor", "Category", "INV_NUM", "Product", "Order From", "LTO Month", "Display", "Display Area",
  "Oct Flyer", "Notes", "Crown Isle", "Port Alberni", "Total Cases",
];

function parsePlanning(rows: unknown[][], fingerprint = "planning-fingerprint") {
  return adapter.parseRows([planningHeaders, ...rows], context, {
    sourceFileName: "OND 2026 Worksheet.xlsx", sourceSheet: "Sheet1", fingerprint,
  });
}

describe("flyer workbook import adapter", () => {
  beforeEach(() => window.localStorage.clear());

  it("parses the audited flyer shape, infers monthly dates, and retains promotion metadata", () => {
    const result = adapter.parseRows([
      ["Vendor", "", "SKU", "Product", "Selling Price", "Savings", "Sale Price", "Size", "Points", "LTOs", "Additional Notes"],
      ["Mock Coast", "BEER", "MOCK-1001", "Coastal Lager 12 Pack", 20.99, 2, 18.99, "12x355ml", "2X", 2, "September LTO, Preordered for you"],
      ["", "", "", "Giveaways", "", "", "", "", "", "", ""],
    ], context, { sourceFileName: "09 September Flyer 2026.xlsx", sourceSheet: "September Flyer", fingerprint: "flyer-fingerprint" });

    expect(result.workbookKind).toBe("flyer");
    expect(result.suggestedCampaign).toMatchObject({ startDate: "2026-09-01", endDate: "2026-09-30", type: "Monthly flyer" });
    expect(result.rows[0]).toMatchObject({ status: "ready", sku: "MOCK-1001", product: { id: IDS.coastalLagerProduct } });
    expect(result.rows[0].source).toMatchObject({ sellingPrice: 20.99, savings: 2, salePrice: 18.99, wholesaleLtoAmount: 2, loyaltyPointsMultiplier: 2 });
    expect(result.rows[1]).toMatchObject({ status: "information", productName: "Giveaways" });
  });

  it("recognizes the sanitized workbook sheet through the file parser", async () => {
    const bytes = createFlyerWorkbook();
    const file = new File([bytes.slice().buffer], "09 September Flyer 2026.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const result = await adapter.parse(file, context);
    expect(result.sheetNames).toEqual(["September Flyer"]);
    expect(result.rows.map((row) => row.status)).toEqual(["ready", "ready", "information"]);
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("maps a local display code across stores and flags the smaller-store exception", () => {
    const result = parsePlanning([
      ["Mock Valley", "WINE", "MOCK-2001", "Harvest Red Blend", "", "", "Y", "W8", "Y", "", 6, 3, 9],
    ]);

    const crown = result.placements.find((item) => item.store.id === IDS.store)!;
    const portAlberni = result.placements.find((item) => item.store.name === "Port Alberni")!;
    expect(crown).toMatchObject({ displayLocalCode: "W8", status: "ASSIGNED", displayArea: { code: "CI-W8" }, caseQuantity: 6 });
    expect(portAlberni.status).toBe("SUGGESTED");
    expect(portAlberni.suggestion?.storeId).toBe(portAlberni.store.id);
    expect(portAlberni.reasons.join(" ")).toContain("W8 does not exist");
  });

  it("resolves historical store aliases and treats blank allocations as zero", () => {
    const headers = [...planningHeaders];
    headers[10] = "Courtenay";
    headers[11] = "Colwood";
    const result = adapter.parseRows([
      headers,
      ["Mock", "BEER", "MOCK-1001", "Coastal Lager", "", "", "", "", "Y", "", 4, "", 4],
    ], context, { sourceFileName: "Planning.xlsx", sourceSheet: "Sheet1", fingerprint: "aliases" });
    expect(result.rows[0].allocations).toHaveLength(1);
    expect(result.rows[0].allocations[0]).toMatchObject({ store: { name: "Crown Isle" }, quantityCases: 4 });
  });

  it("keeps exact SKU authoritative while skipping duplicates and unmatched rows", () => {
    const result = parsePlanning([
      ["Mock", "BEER", "MOCK-1001", "Different supporting name", "", "", "", "", "Y", "", 2, "", 2],
      ["Mock", "BEER", "MOCK-1001", "Duplicate", "", "", "", "", "Y", "", 2, "", 2],
      ["Mock", "BEER", "UNKNOWN-1", "Unknown", "", "", "", "", "Y", "", 2, "", 2],
    ]);
    expect(result.rows.map((row) => row.status)).toEqual(["ready", "duplicate", "unmatched"]);
    expect(toApplyCampaignWorkbookImport(result, result.suggestedCampaign).rows).toHaveLength(1);
  });

  it("applies one atomic draft campaign and rejects the same fingerprint twice", async () => {
    const repository = new MockMerchandisingRepository();
    const snapshot = await repository.load();
    const result = new FlyerWorkbookImportAdapter().parseRows([
      planningHeaders,
      ["Mock Valley", "WINE", "MOCK-2001", "Harvest Red Blend", "", "", "Y", "W8", "Y", "", 6, 3, 9],
      ["Mock Coast", "BEER", "MOCK-1001", "Coastal Lager", "", "", "", "", "Y", "Shelf only", 2, 1, 3],
    ], { snapshot }, { sourceFileName: "OND 2026 Worksheet.xlsx", sourceSheet: "Sheet1", fingerprint: "atomic-import" });
    const input = toApplyCampaignWorkbookImport(result, result.suggestedCampaign);
    const applied = await repository.applyCampaignWorkbookImport(input);
    const state = await repository.load();

    expect(state.campaigns.find((item) => item.id === applied.campaignId)).toMatchObject({ status: "draft", products: [{ merchandisingState: "DISPLAY_ASSIGNED" }, { merchandisingState: "SHELF_SUPPORTED" }] });
    expect(state.campaignImports.find((item) => item.id === applied.importId)).toMatchObject({ fingerprint: "atomic-import", rows: [{ sourceRow: 2 }, { sourceRow: 3 }] });
    expect(state.campaignStoreProductAllocations.filter((item) => item.campaignId === applied.campaignId)).toHaveLength(4);
    expect(state.campaignStoreProductAllocations.some((item) => item.productId === IDS.coastalLagerProduct && item.displayRequired === false && item.caseQuantity === 2)).toBe(true);
    expect(state.campaignDisplayAssignments.find((item) => item.campaignId === applied.campaignId && item.storeId === IDS.store)).toMatchObject({ status: "ASSIGNED", intendedDisplayCode: "W8" });
    expect(state.campaignDisplayAssignments.find((item) => item.campaignId === applied.campaignId && item.storeId === snapshot.stores.find((store) => store.name === "Port Alberni")?.id)?.status).toBe("SUGGESTED");
    expect(state.campaignDisplayAssignmentProducts.some((item) => item.caseQuantity === 6 && item.quantitySource === "SPREADSHEET")).toBe(true);

    const before = await repository.load();
    await expect(repository.applyCampaignWorkbookImport(input)).rejects.toThrow("already been applied");
    expect((await repository.load()).campaigns).toHaveLength(before.campaigns.length);
  });
});
