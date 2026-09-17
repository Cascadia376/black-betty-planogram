import { describe, expect, it } from "vitest";
import { serializeSnapshot } from "../../adapters/mock/snapshotStorage";
import { seedSnapshot } from "../../adapters/mock/seed";
import {
  compareFloorplanRecovery,
  createFloorplanExport,
  createFloorplanRecoveryFromLegacyStorage,
  parseFloorplanExport,
} from "./floorplanExport";

describe("floorplan recovery", () => {
  it("exports version 2 while keeping the complete floorplan recovery data and excluding unrelated operational records", () => {
    const exported = createFloorplanExport(seedSnapshot, "2026-09-16T12:00:00.000Z", { source: "shared" });

    expect(exported).toMatchObject({
      format: "black-betty-floorplans",
      version: 2,
      source: "shared",
      exportedAt: "2026-09-16T12:00:00.000Z",
    });
    expect(exported.floorplans.storeLayouts).toEqual(seedSnapshot.storeLayouts);
    expect(exported.floorplans.displayAreas).toEqual(seedSnapshot.displayAreas);
    expect(exported.floorplans.categorySpaces).toEqual(seedSnapshot.categorySpaces);
    expect(exported.floorplans).not.toHaveProperty("products");
    expect(exported.floorplans).not.toHaveProperty("purchaseOrders");
  });

  it("still accepts version 1 recovery packages", () => {
    const v2 = createFloorplanExport(seedSnapshot, "2026-09-16T12:00:00.000Z");
    const v1 = { ...v2, version: 1, source: undefined };
    const parsed = parseFloorplanExport(JSON.stringify(v1));
    expect(parsed.version).toBe(1);
    expect(parsed.floorplans.displayAreas).toEqual(seedSnapshot.displayAreas);
  });

  it("recovers the historical browser snapshot format", () => {
    const recovered = createFloorplanRecoveryFromLegacyStorage(serializeSnapshot(seedSnapshot), "2026-09-17T12:00:00.000Z");
    expect(recovered.source).toBe("browser-local");
    expect(recovered.floorplans.displayAreas).toEqual(seedSnapshot.displayAreas);
  });

  it("surfaces recovered display areas that do not exist in shared data", () => {
    const current = structuredClone(seedSnapshot);
    const legacy = structuredClone(seedSnapshot);
    const template = legacy.displayAreas[0];
    const recoveredOnly = {
      ...template,
      id: "recovered-display-only",
      code: "RECOVERED-ONLY",
      localCode: "W99",
      displayNumber: "W99",
      name: "Recovered Only Display",
      geometry: { x: 0.4, y: 0.4, width: 0.08, height: 0.08 },
    };
    legacy.displayAreas.push(recoveredOnly);

    const recovery = createFloorplanExport(legacy, "2026-09-17T12:00:00.000Z", { source: "browser-local" });
    const changes = compareFloorplanRecovery(current, recovery);

    expect(changes).toContainEqual(expect.objectContaining({
      kind: "missing_display_area",
      itemId: recoveredOnly.id,
      storeId: recoveredOnly.storeId,
      label: "W99 · Recovered Only Display",
      recoveredGeometry: recoveredOnly.geometry,
      recoveredDisplayArea: recoveredOnly,
    }));
  });

  it("diffs existing geometry and ignores matching physical records", () => {
    const current = structuredClone(seedSnapshot);
    const legacy = structuredClone(seedSnapshot);
    const area = legacy.displayAreas[0];
    area.geometry = { ...area.geometry, x: Math.min(0.95, area.geometry.x + 0.01) };

    const recovery = createFloorplanExport(legacy, "2026-09-17T12:00:00.000Z", { source: "browser-local" });
    const changes = compareFloorplanRecovery(current, recovery);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "display_area", itemId: area.id, recoveredGeometry: area.geometry });
  });
});
