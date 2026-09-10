import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "../../domain/types";
import type { ProductMasterLookup, ProductMasterLookupResult } from "../../services/products/ProductMasterLookup";
import { normalizeProductSku, stableProductIdForSku } from "../../services/products/ProductMasterLookup";

interface ProductMasterRow {
  sku: string;
  product_name: string;
  category: string | null;
  subcategory: string | null;
  size: string | null;
  units_per_case: number | null;
  supplier: string | null;
  is_active: boolean | null;
}

export const PRODUCT_MASTER_BATCH_SIZE = 50;

/** Read-only browser adapter for ursus_major.public.product under its reviewed SELECT RLS policy. */
export class SupabaseProductMasterLookup implements ProductMasterLookup {
  constructor(private readonly client: SupabaseClient) {}

  async findByExactSkus(skus: string[]): Promise<ProductMasterLookupResult> {
    const requested = [...new Set(skus.map(normalizeProductSku).filter(Boolean))];
    const groups = new Map<string, ProductMasterRow[]>();
    requested.forEach((sku) => groups.set(sku, []));
    for (const batch of batchesOf(requested, PRODUCT_MASTER_BATCH_SIZE)) {
      const { data, error } = await this.client
        .from("product")
        .select("sku,product_name,category,subcategory,size,units_per_case,supplier,is_active")
        .or(batch.map((sku) => `sku.ilike.${quotePostgrestValue(escapeLikePattern(sku))}`).join(","));
      if (error) throw new Error(`Product Master batch lookup failed: ${error.message}`);
      const requestedBatch = new Set(batch);
      ((data ?? []) as ProductMasterRow[]).forEach((row) => {
        const normalized = normalizeProductSku(row.sku);
        if (requestedBatch.has(normalized)) groups.set(normalized, [...(groups.get(normalized) ?? []), row]);
      });
    }

    const products = await Promise.all([...groups.values()].filter((matches) => matches.length === 1).map(async ([row]): Promise<Product> => ({
      id: await stableProductIdForSku(row.sku),
      sku: normalizeProductSku(row.sku),
      name: row.product_name,
      category: row.category ?? "Uncategorized",
      subcategory: row.subcategory ?? undefined,
      packageSize: row.size ?? undefined,
      casePack: row.units_per_case ?? undefined,
      supplierName: row.supplier ?? undefined,
      masterStatus: "verified",
      authoritativeProductId: normalizeProductSku(row.sku),
      active: row.is_active !== false,
      synthetic: false,
    })));
    return {
      products: products.filter((product) => product.active),
      ambiguousSkus: [...groups].filter(([, matches]) => matches.length > 1).map(([sku]) => sku),
    };
  }
}

function escapeLikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function quotePostgrestValue(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function batchesOf<T>(values: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < values.length; index += size) batches.push(values.slice(index, index + size));
  return batches;
}
