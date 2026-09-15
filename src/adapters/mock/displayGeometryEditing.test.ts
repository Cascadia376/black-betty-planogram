import { beforeEach, expect, it } from "vitest";
import { MockMerchandisingRepository } from "./MockMerchandisingRepository";

beforeEach(() => localStorage.clear());

it("persists independent section geometry without changing assignments or protected seeds", async () => {
  const repository = new MockMerchandisingRepository();
  const before = await repository.load();
  const section = before.displayAreaSections[0];
  expect(section).toBeDefined();
  const area = before.displayAreas.find((item) => item.id === section.displayAreaId)!;
  const geometry = { x: 0.1, y: 0.2, width: 0.1, height: 0.1 };
  await repository.updateDisplayArea({ displayAreaId: area.id, patch: {}, sectionGeometry: { sectionId: section.id, geometry } });
  const after = await new MockMerchandisingRepository().load();
  expect(after.displayAreaSections.find((item) => item.id === section.id)?.geometry).toEqual(geometry);
  expect(after.displayAreas.find((item) => item.id === area.id)).toEqual(area);
  expect(after.campaignDisplayAssignments).toEqual(before.campaignDisplayAssignments);
});

it("rejects invalid section ownership without partially updating the display", async () => {
  const repository = new MockMerchandisingRepository();
  const before = await repository.load();
  const area = before.displayAreas[0];
  await expect(repository.updateDisplayArea({ displayAreaId: area.id, patch: { name: "Should not save" }, sectionGeometry: { sectionId: "not-owned", geometry: area.geometry } })).rejects.toThrow("Display section");
  expect((await repository.load()).displayAreas.find((item) => item.id === area.id)).toEqual(area);
});
