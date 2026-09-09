import { describe, expect, it } from "vitest";
import { seedSnapshot } from "../../adapters/mock/seed";
import { storePhysicalCoverage } from "./storeCoverage";

describe("store physical coverage", () => {
  it("lists every current store with a routable layout", () => {
    const coverage = storePhysicalCoverage(seedSnapshot);

    expect(coverage).toHaveLength(seedSnapshot.stores.length);
    expect(coverage).toHaveLength(12);
    expect(coverage.every((item) => item.hasCurrentLayout)).toBe(true);
    expect(coverage.map((item) => `/stores/${item.store.id}/floorplan`)).toHaveLength(12);
  });

  it("keeps category and promotional coverage as separate metrics", () => {
    const coverage = storePhysicalCoverage(seedSnapshot);
    const crownIsle = coverage.find((item) => item.store.name === "Crown Isle");
    const quadra = coverage.find((item) => item.store.name === "Quadra");

    expect(crownIsle).toEqual(expect.objectContaining({
      categorySpaceCount: 21,
      mappedCategorySpaceCount: 21,
      displayAreaCount: 35,
      activeDisplayAreaCount: 31,
      verifiedDisplayAreaCount: 31,
      unverifiedDisplayAreaCount: 4,
    }));
    expect(quadra).toEqual(expect.objectContaining({
      categorySpaceCount: 98,
      mappedCategorySpaceCount: 54,
      displayAreaCount: 22,
      activeDisplayAreaCount: 22,
      verifiedDisplayAreaCount: 22,
      unverifiedDisplayAreaCount: 0,
    }));
  });
});
