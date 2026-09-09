import type { PlatformSnapshot, Store } from "../../domain/types";

export interface StorePhysicalCoverage {
  store: Store;
  hasCurrentLayout: boolean;
  categorySpaceCount: number;
  mappedCategorySpaceCount: number;
  displayAreaCount: number;
  activeDisplayAreaCount: number;
  verifiedDisplayAreaCount: number;
  unverifiedDisplayAreaCount: number;
}

/** Derive physical-model coverage without promoting category geometry into display areas. */
export function storePhysicalCoverage(data: PlatformSnapshot): StorePhysicalCoverage[] {
  return data.stores.map((store) => {
    const layout = data.storeLayouts.find((item) => item.storeId === store.id && item.status === "current");
    const categorySpaces = layout
      ? data.categorySpaces.filter((item) => item.layoutId === layout.id && item.active)
      : [];
    const displayAreas = data.displayAreas.filter((item) => item.storeId === store.id);

    return {
      store,
      hasCurrentLayout: Boolean(layout),
      categorySpaceCount: categorySpaces.length,
      mappedCategorySpaceCount: categorySpaces.filter((item) => item.geometry).length,
      displayAreaCount: displayAreas.length,
      activeDisplayAreaCount: displayAreas.filter((item) => item.active).length,
      verifiedDisplayAreaCount: displayAreas.filter((item) => item.verificationStatus === "verified").length,
      unverifiedDisplayAreaCount: displayAreas.filter((item) => item.verificationStatus === "unverified").length,
    };
  });
}
