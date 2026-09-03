import type { DisplayArea, Geometry, PlatformSnapshot } from "./types";
import { isNormalizedGeometry } from "./storeLayouts";

export function validateDisplayArea(area: DisplayArea, snapshot: Pick<PlatformSnapshot, "stores" | "displayAreas" | "displayClassDefinitions">): void {
  if (!snapshot.stores.some((store) => store.id === area.storeId)) throw new Error("Display area store was not found.");
  if (!area.displayNumber.trim() || !area.code.trim() || !area.name.trim()) throw new Error("Display number, code, and name are required.");
  if (area.verificationStatus === "verified" && !area.sourceReference?.trim()) throw new Error("Verified display areas require a source reference.");
  if (area.displayClassDefinitionId && !snapshot.displayClassDefinitions.some((item) => item.id === area.displayClassDefinitionId)) throw new Error("Display class definition was not found.");
  if (!isNormalizedGeometry(area.geometry)) throw new Error("Display area geometry must remain within normalized floorplan bounds.");
  const duplicate = snapshot.displayAreas.find((candidate) => candidate.id !== area.id && candidate.storeId === area.storeId && candidate.code.toLocaleLowerCase() === area.code.toLocaleLowerCase());
  if (duplicate) throw new Error("Display area code must be unique within a store.");
}

export function displayAreaDependencies(snapshot: PlatformSnapshot, displayAreaId: string): string[] {
  const dependencies: string[] = [];
  if (snapshot.assignments.some((item) => item.displayAreaId === displayAreaId)) dependencies.push("campaign assignments");
  if (snapshot.displayAssignments.some((item) => item.displayAreaId === displayAreaId)) dependencies.push("display assignments");
  if (snapshot.campaignDisplayAssignments.some((item) => item.displayAreaId === displayAreaId || item.suggestionDisplayAreaId === displayAreaId)) dependencies.push("campaign display allocations");
  if (snapshot.performance.some((item) => item.displayAreaId === displayAreaId) || snapshot.ondPerformance.some((item) => item.displayAreaId === displayAreaId)) dependencies.push("performance history");
  if (snapshot.history.some((item) => item.displayAreaId === displayAreaId)) dependencies.push("display history");
  if (snapshot.recommendations.some((item) => item.displayAreaId === displayAreaId)) dependencies.push("recommendations");
  return [...new Set(dependencies)];
}

export function geometryFromNumbers(values: Record<keyof Geometry, number | undefined>): Geometry {
  return { x: values.x ?? 0, y: values.y ?? 0, width: values.width ?? 0, height: values.height ?? 0, ...(values.rotation === undefined ? {} : { rotation: values.rotation }) };
}
