import { describe, expect, it } from "vitest";
import { IDS, seedSnapshot } from "../adapters/mock/seed";
import { isNormalizedGeometry, validateCategorySpace } from "./storeLayouts";

describe("store layout domain", () => {
  it("accepts bounded geometry and rejects rectangles outside normalized bounds", () => {
    expect(isNormalizedGeometry({ x: 0.1, y: 0.2, width: 0.4, height: 0.5 })).toBe(true);
    expect(isNormalizedGeometry({ x: 0.8, y: 0.2, width: 0.3, height: 0.5 })).toBe(false);
  });

  it("requires the category space and layout to belong to the same valid store", () => {
    const space = seedSnapshot.categorySpaces[0];
    expect(() => validateCategorySpace(space, seedSnapshot)).not.toThrow();
    expect(() => validateCategorySpace({ ...space, storeId: IDS.eagleStore }, seedSnapshot)).toThrow("same valid store");
  });

  it("supports fractional cooler doors and optional irregular sections", () => {
    const space = { ...seedSnapshot.categorySpaces[0], coolerDoorEquivalent: 0.5 };
    expect(() => validateCategorySpace(space, seedSnapshot)).not.toThrow();
    expect(seedSnapshot.categorySpaceSections.some((section) => section.categorySpaceId === seedSnapshot.categorySpaces[7].id)).toBe(true);
  });
});
