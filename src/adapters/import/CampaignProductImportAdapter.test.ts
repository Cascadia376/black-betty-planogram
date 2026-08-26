import { describe, expect, it } from "vitest";
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
});
