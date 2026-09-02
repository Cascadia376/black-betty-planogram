import { describe, expect, it } from "vitest";
import { isNormalizedGeometry, validateCategorySpace } from "../../domain/storeLayouts";
import { seedSnapshot } from "./seed";

describe("all-store physical layout seed", () => {
  const expectedFloorplanAssets = new Set([
    "/floorplans/allandale.png",
    "/floorplans/caddy-bay.png",
    "/floorplans/crown-isle.png",
    "/floorplans/eagle-creek.png",
    "/floorplans/hatley-park.png",
    "/floorplans/langford.png",
    "/floorplans/nanoose.png",
    "/floorplans/parksville.png",
    "/floorplans/port-alberni.png",
    "/floorplans/quadra.png",
    "/floorplans/royal-bay.png",
    "/floorplans/uptown.png",
  ]);

  it("gives every store one current layout with a declared background asset", () => {
    for (const store of seedSnapshot.stores) {
      const current = seedSnapshot.storeLayouts.filter((layout) => layout.storeId === store.id && layout.status === "current");
      expect(current, store.name).toHaveLength(1);
      expect(current[0].backgroundImageUrl, store.name).toBeTruthy();
      expect(expectedFloorplanAssets.has(current[0].backgroundImageUrl ?? ""), store.name).toBe(true);
    }
  });

  it("uses unique layouts and valid same-store CategorySpace references", () => {
    expect(new Set(seedSnapshot.storeLayouts.map((layout) => layout.id)).size).toBe(seedSnapshot.storeLayouts.length);
    for (const space of seedSnapshot.categorySpaces) {
      const layout = seedSnapshot.storeLayouts.find((item) => item.id === space.layoutId);
      expect(layout, space.name).toBeDefined();
      expect(layout?.storeId, space.name).toBe(space.storeId);
      expect(() => validateCategorySpace(space, seedSnapshot), space.name).not.toThrow();
      if (space.geometry) expect(isNormalizedGeometry(space.geometry), space.name).toBe(true);
    }
  });

  it("keeps every irregular section attached to an existing category space", () => {
    const spaceIds = new Set(seedSnapshot.categorySpaces.map((space) => space.id));
    expect(seedSnapshot.categorySpaceSections.length).toBeGreaterThan(2);
    for (const section of seedSnapshot.categorySpaceSections) expect(spaceIds.has(section.categorySpaceId), section.id).toBe(true);
  });

  it("prevents spaces from one store appearing in another store layout", () => {
    for (const layout of seedSnapshot.storeLayouts) {
      const spaces = seedSnapshot.categorySpaces.filter((space) => space.layoutId === layout.id);
      expect(spaces.length, layout.name).toBeGreaterThan(0);
      expect(spaces.every((space) => space.storeId === layout.storeId), layout.name).toBe(true);
    }
  });

  it("keeps Port Alberni's conservative mapping set free of the rejected polygon", () => {
    const portLayoutId = "11000000-0000-4000-8000-000000000009";
    const spaces = seedSnapshot.categorySpaces.filter((space) => space.layoutId === portLayoutId);
    expect(spaces).toHaveLength(60);
    expect(spaces.filter((space) => space.geometry)).toHaveLength(36);
  });
});
