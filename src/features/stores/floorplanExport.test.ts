import { describe, expect, it } from "vitest";
import { seedSnapshot } from "../../adapters/mock/seed";
import { createFloorplanExport } from "./floorplanExport";

describe("createFloorplanExport", () => {
  it("keeps the complete floorplan recovery data but excludes unrelated operational records", () => {
    const exported = createFloorplanExport(seedSnapshot, "2026-09-16T12:00:00.000Z");

    expect(exported).toMatchObject({
      format: "black-betty-floorplans",
      version: 1,
      exportedAt: "2026-09-16T12:00:00.000Z",
    });
    expect(exported.floorplans.storeLayouts).toEqual(seedSnapshot.storeLayouts);
    expect(exported.floorplans.displayAreas).toEqual(seedSnapshot.displayAreas);
    expect(exported.floorplans.categorySpaces).toEqual(seedSnapshot.categorySpaces);
    expect(exported.floorplans).not.toHaveProperty("products");
    expect(exported.floorplans).not.toHaveProperty("purchaseOrders");
  });
});
