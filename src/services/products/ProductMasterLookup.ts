import type { Product } from "../../domain/types";

export interface ProductMasterLookupResult {
  products: Product[];
  ambiguousSkus: string[];
}

/** Narrow read-only boundary for authoritative, exact-SKU Product Master reconciliation. */
export interface ProductMasterLookup {
  findByExactSkus(skus: string[]): Promise<ProductMasterLookupResult>;
}

export function normalizeProductSku(value: unknown): string {
  return String(value ?? "").trim().toLocaleUpperCase();
}

/**
 * Produces a stable UUID-shaped identity for SKU-keyed Product Master records.
 * Existing mock products retain their existing IDs; external SKU records use this identity.
 */
export async function stableProductIdForSku(sku: string): Promise<string> {
  const normalized = normalizeProductSku(sku);
  if (!normalized) throw new Error("A normalized SKU is required to derive a Product identity.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`black-betty:product:${normalized}`)));
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
