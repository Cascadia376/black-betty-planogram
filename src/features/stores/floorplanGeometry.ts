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
