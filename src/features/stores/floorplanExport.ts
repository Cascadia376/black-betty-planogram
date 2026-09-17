import type { PlatformSnapshot } from "../../domain/types";

export interface FloorplanExport {
  format: "black-betty-floorplans";
  version: 1;
  exportedAt: string;
  floorplans: Pick<PlatformSnapshot,
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
}

/**
 * Produces a portable recovery file for locally stored floorplan work.
 * The format intentionally excludes unrelated product, order, and campaign data.
 */
export function createFloorplanExport(snapshot: PlatformSnapshot, exportedAt = new Date().toISOString()): FloorplanExport {
  return {
    format: "black-betty-floorplans",
    version: 1,
    exportedAt,
    floorplans: {
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
    },
  };
}

function exportFileName(exportedAt: string): string {
  const date = exportedAt.slice(0, 10);
  return `black-betty-floorplans-${date}.json`;
}

/** Downloads the current browser's floorplan work as a JSON recovery package. */
export function downloadFloorplanExport(snapshot: PlatformSnapshot): void {
  const payload = createFloorplanExport(snapshot);
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
