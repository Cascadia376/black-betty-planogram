import { describe, expect, it } from "vitest";
import { changeFloorplanGeometry, constrainPan } from "./floorplanGeometry";

describe("floorplan editing geometry", () => {
  const geometry = { x: 0.2, y: 0.3, width: 0.1, height: 0.2, rotation: 15 };
  it("moves without changing size or rotation", () => {
    expect(changeFloorplanGeometry(geometry, 0.1, -0.1, false)).toMatchObject({ x: expect.closeTo(0.3), y: expect.closeTo(0.2), width: 0.1, height: 0.2, rotation: 15 });
    expect(geometry.x).toBe(0.2);
  });
  it("clamps movement and resize to map bounds and a positive minimum", () => {
    expect(changeFloorplanGeometry(geometry, 5, -5, false)).toMatchObject({ x: 0.9, y: 0 });
    expect(changeFloorplanGeometry(geometry, 5, -5, true)).toMatchObject({ width: 0.8, height: 0.01 });
    expect(changeFloorplanGeometry(geometry, NaN, 0, false)).toEqual(geometry);
  });
  it("keeps pan within the zoomed image and resets at fit", () => {
    expect(constrainPan(-1000, 30, 2, 500, 300)).toEqual({ x: -500, y: 0 });
    expect(constrainPan(-40, -40, 1, 500, 300)).toEqual({ x: 0, y: 0 });
  });
});
