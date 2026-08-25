import type { CampaignProduct, Product } from "./types";

export function resolveCampaignProduct(campaignProduct: CampaignProduct, products: Product[]): Product | undefined {
  return products.find((product) => product.id === campaignProduct.productId);
}

export function productMasterStatusLabel(product?: Product): string {
  if (!product || product.masterStatus === "unresolved") return "Unresolved";
  if (!product.active) return "Inactive · Review";
  if (product.masterStatus === "pending") return "New · Needs product-master review";
  return "Verified";
}
