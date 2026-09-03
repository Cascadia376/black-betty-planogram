import { describe, expect, it } from "vitest";
import { isNormalizedGeometry } from "../../domain/storeLayouts";
import { validateDisplayArea } from "../../domain/displayAreas";
import { seedSnapshot } from "./seed";
import { verifiedDisplayImportDiagnostics } from "./verifiedDisplaySeed.generated";

const expectedStoreCounts: Record<string, number> = {
  "Crown Isle": 31,
  Langford: 31,
  "Eagle Creek": 31,
  Quadra: 22,
  "Royal Bay": 18,
  Uptown: 27,
  "Hatley Park": 16,
  Nanoose: 21,
  Parksville: 15,
  Allandale: 13,
  "Port Alberni": 10,
  "Caddy Bay": 12,
};

describe("verified display map import", () => {
  it("loads every supplied store with the source-backed logical display count", () => {
    for (const [storeName, expected] of Object.entries(expectedStoreCounts)) {
      const store = seedSnapshot.stores.find((item) => item.name === storeName)!;
      const areas = seedSnapshot.displayAreas.filter((item) => item.storeId === store.id && item.active);
      expect(areas, storeName).toHaveLength(expected);
      expect(areas.every((area) => area.verificationStatus === "verified" && Boolean(area.sourceReference))).toBe(true);
    }
    expect(verifiedDisplayImportDiagnostics.verifiedAreaCount).toBe(247);
  });

  it("uses unique UUID identities while allowing documented legacy-code collisions", () => {
    const definitions = seedSnapshot.displayClassDefinitions;
    expect(definitions).toHaveLength(63);
    expect(new Set(definitions.map((item) => item.id)).size).toBe(definitions.length);
    expect(definitions.filter((item) => item.legacyCode === "WMD1")).toHaveLength(2);
    expect(verifiedDisplayImportDiagnostics.legacyCodeCollisions).toEqual({ WMD1: 2, WMD2: 2, BRMD1: 2, BRMD2: 2, MMD1: 2, MMD2: 2 });
  });

  it("preserves local codes per store while global codes stay unique", () => {
    const active = seedSnapshot.displayAreas.filter((area) => area.active);
    expect(new Set(active.map((area) => area.code)).size).toBe(active.length);
    expect(active.filter((area) => area.localCode === "W1").length).toBeGreaterThan(1);
    expect(active.find((area) => area.code === "CI-W1")).toEqual(expect.objectContaining({ localCode: "W1", displayFamily: "WINE" }));
    expect(active.find((area) => area.code === "EC-W6")).toEqual(expect.objectContaining({ name: "Window Display", displayFamily: "WINDOW" }));
  });

  it("validates all imported geometries and represents duplicate source locations as sections", () => {
    expect(seedSnapshot.displayAreas.every((area) => isNormalizedGeometry(area.geometry))).toBe(true);
    expect(seedSnapshot.displayAreaSections).toHaveLength(2);
    expect(seedSnapshot.displayAreaSections.every((section) => isNormalizedGeometry(section.geometry))).toBe(true);
    const sectionCodes = seedSnapshot.displayAreaSections.map((section) => seedSnapshot.displayAreas.find((area) => area.id === section.displayAreaId)?.code);
    expect(sectionCodes).toEqual(expect.arrayContaining(["PV-W5", "RB-M3"]));
  });

  it("requires traceability for verified records but permits optional classification", () => {
    const area = seedSnapshot.displayAreas.find((item) => item.code === "PA-M5")!;
    expect(area.displayClassDefinitionId).toBeUndefined();
    expect(() => validateDisplayArea({ ...area, sourceReference: undefined }, seedSnapshot)).toThrow("source reference");
    expect(() => validateDisplayArea(area, seedSnapshot)).not.toThrow();
  });

  it("retires synthetic records without breaking historical references", () => {
    const legacy = seedSnapshot.displayAreas.filter((area) => !area.active && area.verificationStatus === "unverified");
    expect(legacy).toHaveLength(7);
    expect(seedSnapshot.displayAssignments.every((assignment) => seedSnapshot.displayAreas.some((area) => area.id === assignment.displayAreaId))).toBe(true);
  });
});
