import type { Geometry } from "../../domain/types";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Pointer deltas are normalized against the zoomed map, not the viewport. */
export function changeFloorplanGeometry(geometry: Geometry, dx: number, dy: number, resize: boolean): Geometry {
  if (![dx, dy].every(Number.isFinite)) return geometry;
  if (resize) return { ...geometry, width: clamp(geometry.width + dx, 0.01, 1 - geometry.x), height: clamp(geometry.height + dy, 0.01, 1 - geometry.y) };
  return { ...geometry, x: clamp(geometry.x + dx, 0, 1 - geometry.width), y: clamp(geometry.y + dy, 0, 1 - geometry.height) };
}

export function constrainPan(x: number, y: number, zoom: number, width: number, height: number) {
  if (zoom <= 1) return { x: 0, y: 0 };
  return { x: clamp(x, -width * (zoom - 1), 0), y: clamp(y, -height * (zoom - 1), 0) };
}

/** Optional normalized half-percent grid; always clamp again after rounding. */
export function snapFloorplanGeometry(geometry: Geometry, resize: boolean): Geometry {
  const rounded = (value: number) => Math.round(value / 0.005) * 0.005;
  return resize
    ? changeFloorplanGeometry(geometry, rounded(geometry.width) - geometry.width, rounded(geometry.height) - geometry.height, true)
    : changeFloorplanGeometry(geometry, rounded(geometry.x) - geometry.x, rounded(geometry.y) - geometry.y, false);
}

/** Advisory only: map rectangles may legitimately overlap; this is not a safety/aisle-clearance check. */
export function rectanglesOverlap(a: Geometry, b: Geometry): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
