import { describe, expect, it } from "vitest";
import type { InboundOrder, InventoryPosition, SupplierProductOption } from "./types";
import { calculateUncoveredNeed, selectSupplierForRequiredDate } from "./ordering";

const productId = "product-1";
const options: SupplierProductOption[] = [
  { productId, supplierId: "preferred", supplierName: "Preferred Mock Supplier", preferred: true, leadTimeDays: 5, casePack: 6, availability: "available" },
  { productId, supplierId: "alternate", supplierName: "Alternate Mock Supplier", preferred: false, leadTimeDays: 2, casePack: 6, availability: "available" },
];

describe("OND ordering foundation", () => {
  it("chooses the preferred supplier when it can meet the required date", () => {
    const selection = selectSupplierForRequiredDate(productId, options, "2026-10-01", "2026-10-10");
    expect(selection).toEqual(expect.objectContaining({ isAlternate: false, expectedArrivalDate: "2026-10-06" }));
    expect(selection?.option.supplierId).toBe("preferred");
  });

  it("chooses and explains an alternate when the preferred supplier is too late", () => {
    const delayed = options.map((option) => option.preferred ? { ...option, leadTimeDays: 12 } : option);
    const selection = selectSupplierForRequiredDate(productId, delayed, "2026-10-01", "2026-10-06");
    expect(selection?.option.supplierId).toBe("alternate");
    expect(selection?.isAlternate).toBe(true);
    expect(selection?.rationale).toContain("cannot arrive");
  });

  it("reduces uncovered need with qualifying inbound orders", () => {
    const inventory: InventoryPosition = { storeId: "store-1", productId, onHandCases: 4, reservedCases: 1, updatedAt: "2026-10-01T12:00:00Z" };
    const inbound: InboundOrder[] = [{ id: "po-1", storeId: "store-1", productId, supplierId: "preferred", cases: 5, expectedArrivalDate: "2026-10-05", status: "confirmed" }];
    expect(calculateUncoveredNeed(12, inventory, [], "2026-10-10").uncoveredCases).toBe(9);
    expect(calculateUncoveredNeed(12, inventory, inbound, "2026-10-10")).toEqual(expect.objectContaining({ inboundCases: 5, uncoveredCases: 4 }));
  });
});
