import publishedFloorplanExport from "./publishedFloorplans.generated.json";
import type { PlatformSnapshot } from "../../domain/types";

type PublishedFloorplans = Pick<
  PlatformSnapshot,
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

interface PublishedFloorplanExport {
  exportedAt: string;
  floorplans: PublishedFloorplans;
}

const publishedExport = publishedFloorplanExport as unknown as PublishedFloorplanExport;

/** Version marker used to apply a newly published floorplan baseline once per browser. */
export const PUBLISHED_FLOORPLAN_VERSION = publishedExport.exportedAt;

/** Shared floorplan baseline built from the approved floorplan exports. */
export const publishedFloorplans = publishedExport.floorplans;

export function applyPublishedFloorplans(snapshot: PlatformSnapshot): PlatformSnapshot {
  return {
    ...snapshot,
    ...structuredClone(publishedFloorplans),
    // Store identity and business metadata are not floorplan geometry. The
    // normalization step has already added any newly seeded stores, so retain
    // existing store records while replacing only the published layout data.
    stores: structuredClone(snapshot.stores),
  };
}
