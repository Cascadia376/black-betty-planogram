import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./seed";

describe("published floorplans", () => {
  it("combines the approved exports into one current layout per store", () => {
    expect(seedSnapshot.stores).toHaveLength(12);
    expect(seedSnapshot.categorySpaces).toHaveLength(931);
    expect(seedSnapshot.displayAreas).toHaveLength(270);

    for (const store of seedSnapshot.stores) {
      expect(seedSnapshot.storeLayouts.filter((layout) => layout.storeId === store.id && layout.status === "current")).toHaveLength(1);
    }
  });
});
