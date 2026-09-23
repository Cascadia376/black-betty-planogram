import type { Product, PurchaseOrder, Supplier } from "../../domain/types";

export type PurchaseOrderExportFormat = "LDB" | "BDL";

export interface PurchaseOrderCsvExport {
  fileName: string;
  csv: string;
  format: PurchaseOrderExportFormat;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Returns the configured distributor format from the supplier's stable code. */
export function purchaseOrderExportFormatForSupplier(supplier: Supplier): PurchaseOrderExportFormat | undefined {
  const supplierCode = supplier.code.trim().toUpperCase();
  if (supplierCode === "LDB" || supplierCode === "BDL") return supplierCode;
  return undefined;
}

/**
 * Produces the distributor-approved CSV shape for a completed order batch.
 * LDB orders are always submitted in cases, per the supplied order form.
 */
export function createPurchaseOrderCsvExport(
  order: PurchaseOrder,
  supplier: Supplier,
  products: Product[],
): PurchaseOrderCsvExport {
  const format = purchaseOrderExportFormatForSupplier(supplier);
  if (!format) throw new Error(`${supplier.name} is not configured for a BDL or LDB purchase-order export.`);

  const productById = new Map(products.map((product) => [product.id, product]));
  const rows = order.lines.map((line) => {
    const product = productById.get(line.productId);
    if (!product) throw new Error("A purchase-order product could not be found.");
    const identifier = format === "BDL" ? product.supplierProductCode || product.sku : product.sku;
    if (!identifier.trim()) throw new Error(`${product.name} is missing its ${format === "BDL" ? "BDL Article ID" : "LDB INV_NUM"}.`);
    return { identifier, cases: line.cases };
  });

  const header = format === "LDB" ? ["INV_NUM", "UOM", "QTY"] : ["Article ID", "Quantity"];
  const body = rows.map((row) => format === "LDB"
    ? [row.identifier, "CS", row.cases]
    : [row.identifier, row.cases]);
  const csv = [header, ...body].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const createdOn = order.createdAt.slice(0, 10);
  return { format, csv, fileName: `${format}-order-${createdOn}-${order.id.slice(0, 8)}.csv` };
}

export function downloadPurchaseOrderCsv(exportFile: PurchaseOrderCsvExport): void {
  const blob = new Blob([exportFile.csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFile.fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
