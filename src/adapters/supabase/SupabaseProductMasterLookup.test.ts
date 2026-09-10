import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseProductMasterLookup } from "./SupabaseProductMasterLookup";

describe("SupabaseProductMasterLookup", () => {
  it("queries only public.product and maps a unique normalized SKU to a stable identity", async () => {
    const tables: string[] = [];
    const client = {
      from(table: string) {
        tables.push(table);
        return {
          select() {
            return {
              async ilike() {
                return { data: [{ sku: "mock-1001", product_name: "Coastal Lager", category: "Beer", subcategory: null, size: "12x355ml", units_per_case: 12, supplier: "Mock Coast", is_active: true }], error: null };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    const lookup = new SupabaseProductMasterLookup(client);
    const first = await lookup.findByExactSkus([" MOCK-1001 "]);
    const second = await lookup.findByExactSkus(["mock-1001"]);

    expect(tables).toEqual(["product", "product"]);
    expect(first.ambiguousSkus).toEqual([]);
    expect(first.products[0]).toMatchObject({ sku: "MOCK-1001", name: "Coastal Lager", authoritativeProductId: "MOCK-1001", synthetic: false });
    expect(first.products[0].id).toBe(second.products[0].id);
  });

  it("does not choose between duplicate normalized Product Master SKUs", async () => {
    const client = {
      from() {
        return { select: () => ({ ilike: async () => ({ data: [
          { sku: "ABC", product_name: "First", category: null, subcategory: null, size: null, units_per_case: null, supplier: null, is_active: true },
          { sku: "abc", product_name: "Second", category: null, subcategory: null, size: null, units_per_case: null, supplier: null, is_active: true },
        ], error: null }) }) };
      },
    } as unknown as SupabaseClient;

    await expect(new SupabaseProductMasterLookup(client).findByExactSkus(["abc"])).resolves.toEqual({ products: [], ambiguousSkus: ["ABC"] });
  });
});
