import { describe, expect, it } from "vitest";
import { IDS, seedSnapshot } from "../../adapters/mock/seed";
import { extractSkuColumn, parseSkuInput, reviewSkus } from "./productIntake";

describe("campaign product intake", () => {
  it("parses newline-separated SKUs without losing leading zeros", () => {
    expect(parseSkuInput("001234\nMOCK-1001\nMOCK-1002")).toEqual(["001234", "MOCK-1001", "MOCK-1002"]);
  });

  it("parses comma and Excel tab-separated SKUs while removing exact duplicates", () => {
    expect(parseSkuInput("MOCK-1001, MOCK-1002\tMOCK-1001")).toEqual(["MOCK-1001", "MOCK-1002"]);
  });

  it("distinguishes matched, already-added, unknown, and invalid SKUs", () => {
    const review = reviewSkus(
      "MOCK-1001 MOCK-1002 001234 ABC???",
      seedSnapshot.products,
      [{ id: "campaign-product", productId: IDS.coastalLagerProduct, role: "Feature", required: true }],
    );
    expect(review.alreadyAdded.map((product) => product.sku)).toEqual(["MOCK-1001"]);
    expect(review.found.map((product) => product.sku)).toEqual(["MOCK-1002"]);
    expect(review.unknown).toEqual(["001234"]);
    expect(review.invalid).toEqual(["ABC???"]);
  });

  it("extracts only the explicit SKU column from a known spreadsheet shape", () => {
    expect(extractSkuColumn([["Product SKU", "Name"], ["001234", "Example"], ["MOCK-1001", "Coastal"]])).toEqual(["001234", "MOCK-1001"]);
    expect(() => extractSkuColumn([["Item", "Name"], ["001234", "Example"]])).toThrow("Spreadsheet must contain");
  });
});
