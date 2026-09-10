import type { Product } from "../../domain/types";
import type { ProductMasterLookup, ProductMasterLookupResult } from "../../services/products/ProductMasterLookup";
import { normalizeProductSku } from "../../services/products/ProductMasterLookup";

/** Product Master lookup used only by tests and the explicitly mock-backed demo. */
export class MockProductMasterLookup implements ProductMasterLookup {
  constructor(private readonly products: Product[]) {}

  async findByExactSkus(skus: string[]): Promise<ProductMasterLookupResult> {
    const requested = new Set(skus.map(normalizeProductSku).filter(Boolean));
    const grouped = new Map<string, Product[]>();
    this.products.filter((product) => product.active).forEach((product) => {
      const sku = normalizeProductSku(product.sku);
      if (requested.has(sku)) grouped.set(sku, [...(grouped.get(sku) ?? []), product]);
    });
    return {
      products: [...grouped.values()].filter((matches) => matches.length === 1).map(([product]) => product),
      ambiguousSkus: [...grouped].filter(([, matches]) => matches.length > 1).map(([sku]) => sku),
    };
  }
}
