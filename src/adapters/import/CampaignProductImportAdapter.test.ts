import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { createWorkbook } from "../../../tests/fixtures/cascadiaOndWorkbook";
import { IDS, seedSnapshot } from "../mock/seed";
import { CampaignProductImportAdapter, CAMPAIGN_PRODUCT_IMPORT_HEADERS } from "./CampaignProductImportAdapter";

const adapter = new CampaignProductImportAdapter();
const context = { products: seedSnapshot.products, campaignProducts: [] };

describe("campaign product import adapter", () => {
  it("resolves known Product Master SKUs and preserves campaign metadata", () => {
    const result = adapter.parseRows([[...CAMPAIGN_PRODUCT_IMPORT_HEADERS], ["MOCK-1001", "Feature", "Yes", "Eye level"]], context);
    expect(result.rows[0]).toEqual(expect.objectContaining({ status: "matched", role: "Feature", required: true, note: "Eye level", product: expect.objectContaining({ id: IDS.coastalLagerProduct }) }));
  });

  it("reports duplicates, valid unknown SKUs, and invalid rows without producing import entries", () => {
    const result = adapter.parseRows([
      [...CAMPAIGN_PRODUCT_IMPORT_HEADERS],
      ["MOCK-1001", "Core", "No", ""],
      ["MOCK-1001", "Core", "No", ""],
      ["001234", "Supporting", "Yes", ""],
      ["ABC???", "Feature", "Maybe", ""],
    ], { products: seedSnapshot.products, campaignProducts: [{ id: "existing", productId: IDS.islandIpaProduct, role: "Core", required: true }] });
    expect(result.rows.map((row) => row.status)).toEqual(["matched", "duplicate", "pending", "invalid"]);
    expect(result.rows[2].sku).toBe("001234");
    expect(result.rows[3].issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["invalid_sku", "invalid_required"]));
  });

  it("recognizes products already in the campaign as duplicates", () => {
    const result = adapter.parseRows([[...CAMPAIGN_PRODUCT_IMPORT_HEADERS], ["MOCK-1001", "Feature", "Yes", ""]], { products: seedSnapshot.products, campaignProducts: [{ id: "existing", productId: IDS.coastalLagerProduct, role: "Feature", required: true }] });
    expect(result.rows[0].status).toBe("duplicate");
    expect(result.rows[0].issues).toContainEqual(expect.objectContaining({ code: "already_added" }));
  });

  it("routes consolidated OND workbooks to the importer that preserves store quantities", () => {
    const result = adapter.parseRows([
      ["Vendor", "Category", "INV_NUM", "Product", "Order From", "LTO Month", "Display", "Allandale"],
      ["Supplier", "WINE", 796094, "Copper Moon Pinot Grigio", "", "OND", "", 6],
    ], context);

    expect(result.rows).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "wrong_import_workflow",
        message: expect.stringContaining("full workbook importer"),
      }),
    ]);
  });

  it("routes OND store-display workbooks to the store display importer", () => {
    const result = adapter.parseRows([
      ["Vendor", "Category", "INV_NUM", "Product", "Display", "Case QTY", "Display Notes"],
      ["Supplier", "WINE", 796094, "Copper Moon Pinot Grigio", "W1", 2, "Feature"],
    ], context);

    expect(result.rows).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "wrong_store_display_import_workflow",
        message: expect.stringContaining("store display workbook importer"),
      }),
    ]);
  });

  it("treats an empty inlineStr cell without an inline-string payload as blank", async () => {
    const bytes = createWorkbook([
      ["SKU", "Role", "Required", "Notes"],
      ["MOCK-1001", "Feature", "Yes", ""],
    ], "Products");
    const archive = unzipSync(bytes);
    const sheetPath = "xl/worksheets/sheet1.xml";
    archive[sheetPath] = strToU8(strFromU8(archive[sheetPath]).replace('<is><t></t></is>', ""));
    const malformedEmptyCellWorkbook = zipSync(archive).slice().buffer;

    const result = await adapter.parse(new Blob([malformedEmptyCellWorkbook]), context);

    expect(result.issues).toEqual([]);
    expect(result.rows).toEqual([
      expect.objectContaining({ sku: "MOCK-1001", status: "matched", note: undefined }),
    ]);
  });
});
