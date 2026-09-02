import type { CategorySpace, Geometry, PlatformSnapshot, StoreLayout, UUID } from "./types";

export function isNormalizedGeometry(geometry: Geometry): boolean {
  return geometry.x >= 0
    && geometry.y >= 0
    && geometry.width >= 0
    && geometry.height >= 0
    && geometry.x + geometry.width <= 1
    && geometry.y + geometry.height <= 1;
}

export function validateCategorySpace(space: CategorySpace, snapshot: Pick<PlatformSnapshot, "stores" | "storeLayouts">): void {
  const layout = snapshot.storeLayouts.find((item) => item.id === space.layoutId);
  if (!layout) throw new Error("Category space layout was not found.");
  if (layout.storeId !== space.storeId || !snapshot.stores.some((item) => item.id === space.storeId)) {
    throw new Error("Category space must belong to the same valid store as its layout.");
  }
  if (!space.name.trim() || !space.category.trim()) throw new Error("Category space name and category are required.");
  if (space.geometry && !isNormalizedGeometry(space.geometry)) throw new Error("Category space geometry must remain within normalized floorplan bounds.");
  const nonNegative = [space.shelfWidthIn, space.shelfDepthIn, space.shelfCount, space.maxFacings, space.coolerDoorEquivalent];
  if (nonNegative.some((value) => value !== undefined && (!Number.isFinite(value) || value < 0))) {
    throw new Error("Category space capacity values must be non-negative numbers.");
  }
}

export function currentLayoutForStore(layouts: StoreLayout[], storeId: UUID): StoreLayout | undefined {
  return layouts.find((layout) => layout.storeId === storeId && layout.status === "current");
}
