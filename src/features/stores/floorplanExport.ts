import type { Geometry, PlatformSnapshot } from "../../domain/types";
import { deserializeSnapshot } from "../../adapters/mock/snapshotStorage";

export const LEGACY_FLOORPLAN_STORAGE_KEY = "cascadia-merchandising-platform-v1";

type FloorplanCollections = Pick<PlatformSnapshot,
  | "stores"
  | "storeLayouts"
  | "categorySpaces"
  | "categorySpaceSections"
  | "zones"
  | "fixtures"
  | "displayClassDefinitions"
  | "displayAreas"
  | "displayAreaSections"
  | "displayAssignments"
  | "campaignDisplayAssignments"
>;

export interface FloorplanExportV1 {
  format: "black-betty-floorplans";
  version: 1;
  exportedAt: string;
  floorplans: FloorplanCollections;
}

export interface FloorplanExportV2 {
  format: "black-betty-floorplans";
  version: 2;
  exportedAt: string;
  source: "shared" | "browser-local" | "uploaded-recovery";
  exportedBy?: string;
  note?: string;
  floorplans: FloorplanCollections;
}

export type FloorplanExport = FloorplanExportV1 | FloorplanExportV2;
export type FloorplanRecoveryKind = "display_area" | "missing_display_area" | "display_area_section" | "category_space";

export interface FloorplanRecoveryChange {
  key: string;
  kind: FloorplanRecoveryKind;
  storeId: string;
  itemId: string;
  parentId?: string;
  label: string;
  currentGeometry?: Geometry;
  recoveredGeometry: Geometry;
  recoveredDisplayArea?: PlatformSnapshot["displayAreas"][number];
  /** Present only when the historical record itself carried an edit timestamp. */
  lastEditedAt?: string;
}

function floorplansFromSnapshot(snapshot: PlatformSnapshot): FloorplanCollections {
  return {
    stores: snapshot.stores,
    storeLayouts: snapshot.storeLayouts,
    categorySpaces: snapshot.categorySpaces,
    categorySpaceSections: snapshot.categorySpaceSections,
    zones: snapshot.zones,
    fixtures: snapshot.fixtures,
    displayClassDefinitions: snapshot.displayClassDefinitions,
    displayAreas: snapshot.displayAreas,
    displayAreaSections: snapshot.displayAreaSections,
    displayAssignments: snapshot.displayAssignments,
    campaignDisplayAssignments: snapshot.campaignDisplayAssignments,
  };
}

/**
 * Produces a portable recovery file for floorplan work. Version 2 keeps the
 * version 1 floorplan collections intact while adding source metadata so a
 * recovery can distinguish shared state from legacy browser-local work.
 */
export function createFloorplanExport(
  snapshot: PlatformSnapshot,
  exportedAt = new Date().toISOString(),
  options: { source?: FloorplanExportV2["source"]; exportedBy?: string; note?: string } = {},
): FloorplanExportV2 {
  return {
    format: "black-betty-floorplans",
    version: 2,
    exportedAt,
    source: options.source ?? "shared",
    exportedBy: options.exportedBy,
    note: options.note,
    floorplans: floorplansFromSnapshot(snapshot),
  };
}

function isFloorplanExport(value: unknown): value is FloorplanExport {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FloorplanExport>;
  if (candidate.format !== "black-betty-floorplans" || (candidate.version !== 1 && candidate.version !== 2)) return false;
  const floorplans = candidate.floorplans as Partial<FloorplanCollections> | undefined;
  return Boolean(
    floorplans
    && Array.isArray(floorplans.stores)
    && Array.isArray(floorplans.storeLayouts)
    && Array.isArray(floorplans.categorySpaces)
    && Array.isArray(floorplans.displayAreas)
    && Array.isArray(floorplans.displayAreaSections),
  );
}

/** Accepts version 1 and version 2 exported recovery JSON. */
export function parseFloorplanExport(value: string): FloorplanExport {
  const parsed = JSON.parse(value) as unknown;
  if (!isFloorplanExport(parsed)) throw new Error("This file is not a valid Black Betty floorplan recovery package.");
  return parsed;
}

/**
 * Converts the historical browser snapshot into the same recovery envelope.
 * deserializeSnapshot supports the current packed value plus prior compressed
 * and plain-JSON browser formats.
 */
export function createFloorplanRecoveryFromLegacyStorage(
  storedValue: string,
  exportedAt = new Date().toISOString(),
): FloorplanExportV2 {
  const snapshot = deserializeSnapshot(storedValue);
  return createFloorplanExport(snapshot, exportedAt, {
    source: "browser-local",
    note: "Recovered from legacy Black Betty browser storage.",
  });
}

/** Accepts either an exported recovery JSON file or a raw legacy localStorage value. */
export function parseFloorplanRecoveryInput(value: string): FloorplanExport {
  try {
    return parseFloorplanExport(value);
  } catch (exportError) {
    try {
      return createFloorplanRecoveryFromLegacyStorage(value);
    } catch {
      throw exportError;
    }
  }
}

function recoveredEditTimestamp(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  for (const key of ["lastEditedAt", "updatedAt", "modifiedAt"]) {
    const timestamp = candidate[key];
    if (typeof timestamp === "string" && timestamp.trim()) return timestamp;
  }
  return undefined;
}

function geometryEquals(left?: Geometry, right?: Geometry): boolean {
  if (!left || !right) return left === right;
  return left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height
    && (left.rotation ?? 0) === (right.rotation ?? 0);
}

/**
 * Recovery compares legacy physical work with the current shared snapshot.
 * Existing records are reported as geometry changes. Display areas that exist
 * only in the recovery package are surfaced separately so lost newly-created
 * displays can be identified without creating them automatically.
 */
export function compareFloorplanRecovery(current: PlatformSnapshot, recovery: FloorplanExport): FloorplanRecoveryChange[] {
  const changes: FloorplanRecoveryChange[] = [];
  const recovered = recovery.floorplans;

  for (const recoveredArea of recovered.displayAreas) {
    const currentArea = current.displayAreas.find((area) => area.id === recoveredArea.id);
    if (!currentArea) {
      changes.push({
        key: `missing-display-area:${recoveredArea.id}`,
        kind: "missing_display_area",
        storeId: recoveredArea.storeId,
        itemId: recoveredArea.id,
        label: `${recoveredArea.localCode ?? recoveredArea.displayNumber} · ${recoveredArea.name}`,
        recoveredGeometry: recoveredArea.geometry,
        recoveredDisplayArea: recoveredArea,
        lastEditedAt: recoveredEditTimestamp(recoveredArea),
      });
      continue;
    }
    if (geometryEquals(currentArea.geometry, recoveredArea.geometry)) continue;
    changes.push({
      key: `display-area:${recoveredArea.id}`,
      kind: "display_area",
      storeId: recoveredArea.storeId,
      itemId: recoveredArea.id,
      label: `${recoveredArea.localCode ?? recoveredArea.displayNumber} · ${recoveredArea.name}`,
      currentGeometry: currentArea.geometry,
      recoveredGeometry: recoveredArea.geometry,
    });
  }

  for (const recoveredSection of recovered.displayAreaSections) {
    const currentSection = current.displayAreaSections.find((section) => section.id === recoveredSection.id);
    if (!currentSection || geometryEquals(currentSection.geometry, recoveredSection.geometry)) continue;
    const recoveredArea = recovered.displayAreas.find((area) => area.id === recoveredSection.displayAreaId);
    const currentArea = current.displayAreas.find((area) => area.id === recoveredSection.displayAreaId);
    const area = currentArea ?? recoveredArea;
    if (!area) continue;
    changes.push({
      key: `display-area-section:${recoveredSection.id}`,
      kind: "display_area_section",
      storeId: area.storeId,
      itemId: recoveredSection.id,
      parentId: recoveredSection.displayAreaId,
      label: `${area.localCode ?? area.displayNumber} · ${recoveredSection.label ?? "section"}`,
      currentGeometry: currentSection.geometry,
      recoveredGeometry: recoveredSection.geometry,
    });
  }

  for (const recoveredSpace of recovered.categorySpaces) {
    if (!recoveredSpace.geometry) continue;
    const currentSpace = current.categorySpaces.find((space) => space.id === recoveredSpace.id);
    if (!currentSpace || geometryEquals(currentSpace.geometry, recoveredSpace.geometry)) continue;
    changes.push({
      key: `category-space:${recoveredSpace.id}`,
      kind: "category_space",
      storeId: recoveredSpace.storeId,
      itemId: recoveredSpace.id,
      label: recoveredSpace.name,
      currentGeometry: currentSpace.geometry,
      recoveredGeometry: recoveredSpace.geometry,
    });
  }

  return changes.sort((left, right) => left.storeId.localeCompare(right.storeId) || left.label.localeCompare(right.label));
}

function exportFileName(exportedAt: string): string {
  const date = exportedAt.slice(0, 10);
  return `black-betty-floorplans-${date}.json`;
}

/** Downloads the currently loaded floorplan state as a JSON recovery package. */
export function downloadFloorplanExport(
  snapshot: PlatformSnapshot,
  options: { source?: FloorplanExportV2["source"]; exportedBy?: string; note?: string } = {},
): void {
  const payload = createFloorplanExport(snapshot, new Date().toISOString(), options);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(payload.exportedAt);
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
