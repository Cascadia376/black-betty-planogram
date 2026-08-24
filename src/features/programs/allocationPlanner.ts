import type { DisplayAssignment, DisplayAssignmentProduct, PlatformSnapshot } from "../../domain/types";

const syntheticProductMetadata: Record<string, { name: string; category: string }> = {
  "MOCK-OND-1001": { name: "Mock Harvest Red Feature", category: "Wine" },
  "MOCK-OND-1002": { name: "Mock Cream Liqueur Gift Pack", category: "Spirits" },
  "MOCK-OND-2001": { name: "Mock Holiday Cream Liqueur", category: "Spirits" },
  "MOCK-OND-EXIT-01": { name: "Mock Seasonal Gift Set", category: "Gifts" },
  "MOCK-OND-3001": { name: "Mock Winter Cider Pack", category: "Cider" },
};

export interface AllocationFilters {
  storeId: string;
  periodId: string;
  displayType: string;
  supplierId: string;
  category: string;
  status: string;
}

export function productDetails(product: DisplayAssignmentProduct, data: PlatformSnapshot) {
  const campaignProduct = data.campaigns.flatMap((campaign) => campaign.products).find((item) => item.sku === product.sku);
  const syntheticProduct = syntheticProductMetadata[product.sku];
  const supplier = data.supplierProductOptions.find((option) =>
    option.productId === product.productId && option.supplierId === product.preferredSupplierId,
  ) ?? data.supplierProductOptions.find((option) => option.productId === product.productId && option.preferred);
  return {
    name: campaignProduct?.name ?? syntheticProduct?.name ?? product.sku,
    category: campaignProduct?.category ?? syntheticProduct?.category ?? "Uncategorized",
    supplierName: supplier?.supplierName ?? "Not specified",
  };
}

export function assignmentMatchesFilters(
  assignment: DisplayAssignment,
  products: DisplayAssignmentProduct[],
  filters: AllocationFilters,
  data: PlatformSnapshot,
) {
  const area = data.displayAreas.find((item) => item.id === assignment.displayAreaId);
  if (filters.storeId && assignment.storeId !== filters.storeId) return false;
  if (filters.periodId && assignment.periodId !== filters.periodId) return false;
  if (filters.displayType && area?.type !== filters.displayType) return false;
  if (filters.status && assignment.status !== filters.status) return false;
  if (filters.supplierId && !products.some((product) => {
    if (product.preferredSupplierId === filters.supplierId) return true;
    return data.supplierProductOptions.some((option) =>
      option.productId === product.productId && option.supplierId === filters.supplierId && option.preferred,
    );
  })) return false;
  if (filters.category && !products.some((product) => productDetails(product, data).category === filters.category)) return false;
  return true;
}

export function resetDateForAssignment(assignment: DisplayAssignment, data: PlatformSnapshot) {
  return data.programPeriods.find((period) => period.id === assignment.periodId)?.resetDate;
}
