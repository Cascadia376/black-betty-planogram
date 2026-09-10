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

/** Read-only browser adapter for ursus_major.public.product under its reviewed SELECT RLS policy. */
export class SupabaseProductMasterLookup implements ProductMasterLookup {
  constructor(private readonly client: SupabaseClient) {}

  async findByExactSkus(skus: string[]): Promise<ProductMasterLookupResult> {
    const requested = [...new Set(skus.map(normalizeProductSku).filter(Boolean))];
    const groups = new Map<string, ProductMasterRow[]>();
    await Promise.all(requested.map(async (sku) => {
      const { data, error } = await this.client
        .from("product")
        .select("sku,product_name,category,subcategory,size,units_per_case,supplier,is_active")
        .ilike("sku", escapeLikePattern(sku));
      if (error) throw new Error(`Product Master lookup failed for SKU ${sku}: ${error.message}`);
      const matches = ((data ?? []) as ProductMasterRow[]).filter((row) => normalizeProductSku(row.sku) === sku);
      groups.set(sku, matches);
    }));

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
