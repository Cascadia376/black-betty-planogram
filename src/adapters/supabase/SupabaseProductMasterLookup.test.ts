import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { PRODUCT_MASTER_BATCH_SIZE, SupabaseProductMasterLookup } from "./SupabaseProductMasterLookup";

interface StubRow { sku: string; product_name: string; category: string | null; subcategory: string | null; size: string | null; units_per_case: number | null; supplier: string | null; is_active: boolean | null; }

function productRow(sku: string, name = `Product ${sku}`): StubRow {
  return { sku, product_name: name, category: "Beer", subcategory: null, size: null, units_per_case: 12, supplier: "Supplier", is_active: true };
}

function stubClient(responses: StubRow[][]) {
  const tables: string[] = [];
  const filters: string[] = [];
  let request = 0;
  const client = {
    from(table: string) {
      tables.push(table);
      return {
        select() {
          return {
            async or(filter: string) {
              filters.push(filter);
              return { data: responses[request++] ?? [], error: null };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, tables, filters };
}

describe("SupabaseProductMasterLookup", () => {
  it("deduplicates multiple SKUs in one product-table batch and leaves unmatched SKUs out", async () => {
    const stub = stubClient([[productRow("mock-1001", "Coastal Lager"), productRow("MOCK-2001", "Harvest Red")]]);
    const result = await new SupabaseProductMasterLookup(stub.client).findByExactSkus([" MOCK-1001 ", "mock-2001", "MOCK-1001", "UNKNOWN"]);

    expect(stub.tables).toEqual(["product"]);
    expect(stub.filters[0].match(/sku\.ilike/g)).toHaveLength(3);
    expect(result.products.map((product) => product.sku)).toEqual(["MOCK-1001", "MOCK-2001"]);
    expect(result.products[0]).toMatchObject({ name: "Coastal Lager", authoritativeProductId: "MOCK-1001", synthetic: false });
    expect(result.ambiguousSkus).toEqual([]);
    expect(await new SupabaseProductMasterLookup(stubClient([[productRow("MOCK-1001")]]).client).findByExactSkus(["mock-1001"])).toMatchObject({ products: [{ id: result.products[0].id }] });
  });

  it("does not choose between duplicate normalized Product Master SKUs", async () => {
    const stub = stubClient([[productRow("ABC", "First"), productRow("abc", "Second")]]);
    await expect(new SupabaseProductMasterLookup(stub.client).findByExactSkus(["abc"])).resolves.toEqual({ products: [], ambiguousSkus: ["ABC"] });
  });

  it("uses sequential bounded batches when the request exceeds the batch size", async () => {
    const skus = Array.from({ length: PRODUCT_MASTER_BATCH_SIZE + 1 }, (_, index) => `SKU-${index + 1}`);
    const stub = stubClient([skus.slice(0, PRODUCT_MASTER_BATCH_SIZE).map((sku) => productRow(sku)), [productRow(skus.at(-1)!)]]);
    const result = await new SupabaseProductMasterLookup(stub.client).findByExactSkus(skus);

    expect(stub.tables).toEqual(["product", "product"]);
    expect(stub.filters[0].match(/sku\.ilike/g)).toHaveLength(PRODUCT_MASTER_BATCH_SIZE);
    expect(stub.filters[1].match(/sku\.ilike/g)).toHaveLength(1);
    expect(result.products).toHaveLength(PRODUCT_MASTER_BATCH_SIZE + 1);
  });
});
