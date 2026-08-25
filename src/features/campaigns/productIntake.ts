import type { CampaignProduct, Product } from "../../domain/types";

export interface BulkSkuReview {
  submitted: string[];
  found: Product[];
  alreadyAdded: Product[];
  unknown: string[];
  invalid: string[];
}

export function parseSkuInput(value: string): string[] {
  return [...new Set(value.split(/[\s,]+/).map((sku) => sku.trim()).filter(Boolean))];
}

export function isValidSku(sku: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(sku);
}

export function reviewSkus(value: string, products: Product[], campaignProducts: CampaignProduct[]): BulkSkuReview {
  const submitted = parseSkuInput(value);
  const catalogBySku = new Map(products.map((product) => [product.sku.toLocaleLowerCase(), product]));
  const addedIds = new Set(campaignProducts.map((product) => product.productId));
  const review: BulkSkuReview = { submitted, found: [], alreadyAdded: [], unknown: [], invalid: [] };

  for (const sku of submitted) {
    if (!isValidSku(sku)) {
      review.invalid.push(sku);
      continue;
    }
    const product = catalogBySku.get(sku.toLocaleLowerCase());
    if (!product) review.unknown.push(sku);
    else if (addedIds.has(product.id)) review.alreadyAdded.push(product);
    else review.found.push(product);
  }
  return review;
}

export function extractSkuColumn(rows: unknown[][]): string[] {
  if (!rows.length) return [];
  const headers = rows[0].map((value) => String(value ?? "").trim().toLocaleLowerCase().replaceAll(/[^a-z0-9]/g, ""));
  const skuIndex = headers.findIndex((header) => header === "sku" || header === "productsku");
  if (skuIndex < 0) throw new Error('Spreadsheet must contain a column named "SKU" or "Product SKU".');
  return rows.slice(1).map((row) => String(row[skuIndex] ?? "").trim()).filter(Boolean);
}

export function campaignProductFromMaster(product: Product): CampaignProduct {
  return { id: crypto.randomUUID(), productId: product.id, role: "Supporting", required: true };
}
