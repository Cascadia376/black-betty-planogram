import { describe, expect, it } from "vitest";
import type { Product, PurchaseOrder, Supplier } from "../../domain/types";
import { createPurchaseOrderCsvExport, purchaseOrderExportFormatForSupplier } from "./purchaseOrderExport";

const product: Product = {
  id: "product-1", sku: "554469", supplierProductCode: "BDL-9981", name: "Guinness 8pk", category: "Beer",
  masterStatus: "verified", active: true, synthetic: false,
};
const order: PurchaseOrder = {
  id: "order-12345678", storeId: "store-1", supplierId: "supplier-1", createdAt: "2026-09-23T10:00:00Z",
  expectedArrivalDate: "2026-09-30", status: "submitted",
  lines: [{ id: "line-1", purchaseOrderId: "order-12345678", recommendationId: "rec-1", productId: "product-1", cases: 5 }],
};

function supplier(code: string): Supplier {
  return { id: "supplier-1", name: `${code} Distribution`, code, active: true };
}

describe("purchase-order CSV exports", () => {
  it("creates the supplied LDB case-order layout", () => {
    const result = createPurchaseOrderCsvExport(order, supplier("LDB"), [product]);
    expect(result).toMatchObject({ format: "LDB", fileName: "LDB-order-2026-09-23-order-12.csv" });
    expect(result.csv).toBe("INV_NUM,UOM,QTY\r\n554469,CS,5");
  });

  it("creates the supplied BDL layout using the supplier Article ID", () => {
    const result = createPurchaseOrderCsvExport(order, supplier("BDL"), [product]);
    expect(result.csv).toBe("Article ID,Quantity\r\nBDL-9981,5");
  });

  it("falls back to the inventory number for BDL until Article IDs are supplied", () => {
    const result = createPurchaseOrderCsvExport(order, supplier("BDL"), [{ ...product, supplierProductCode: undefined }]);
    expect(result.csv).toBe("Article ID,Quantity\r\n554469,5");
  });

  it("does not offer a distributor export for an unconfigured supplier", () => {
    expect(purchaseOrderExportFormatForSupplier(supplier("MOCK-COASTAL"))).toBeUndefined();
  });
});
