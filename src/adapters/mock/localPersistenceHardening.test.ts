import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { LocalPlanningConflictError, MockMerchandisingRepository } from "./MockMerchandisingRepository";
import { seedSnapshot } from "./seed";
import { deserializeSnapshot } from "./snapshotStorage";

const key = "cascadia-merchandising-platform-v1";
const moved = { x: 0.21, y: 0.22, width: 0.05, height: 0.06 };

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("local persistence failure boundaries", () => {
  it("rolls back a failed display save in memory and does not commit it during an unrelated later save", async () => {
    const repository = new MockMerchandisingRepository();
    const before = await repository.load();
    const area = before.displayAreas.find((item) => item.active)!;
    const write = vi.spyOn(localStorage, "setItem").mockImplementationOnce(() => { throw new DOMException("Full", "QuotaExceededError"); });
    await expect(repository.updateDisplayArea({ displayAreaId: area.id, patch: { geometry: moved } })).rejects.toThrow("previous saved work is safe");
    expect(await repository.load()).toEqual(before);
    write.mockRestore();
    await repository.createPendingProduct({ sku: "ROLLBACK-TEST", name: "Test only", category: "Wine" });
    const reopened = await new MockMerchandisingRepository().load();
    expect(reopened.displayAreas.find((item) => item.id === area.id)?.geometry).toEqual(area.geometry);
  });

  it("refuses stale-tab writes without overwriting the other tab", async () => {
    const first = new MockMerchandisingRepository();
    const second = new MockMerchandisingRepository();
    const area = (await first.load()).displayAreas.find((item) => item.active)!;
    await first.updateDisplayArea({ displayAreaId: area.id, patch: { geometry: moved } });
    const saved = localStorage.getItem(key);
    await expect(second.updateDisplayArea({ displayAreaId: area.id, patch: { geometry: { ...moved, x: 0.4 } } })).rejects.toBeInstanceOf(LocalPlanningConflictError);
    expect(localStorage.getItem(key)).toBe(saved);
    await expect(second.reset()).rejects.toBeInstanceOf(LocalPlanningConflictError);
    expect(localStorage.getItem(key)).toBe(saved);
  });

  it.each(["not-json", '{"campaigns":null}', 'zlib-utf16:42:truncated'])("keeps unreadable source bytes and fails closed (%s)", async (value) => {
    localStorage.setItem(key, value);
    const repository = new MockMerchandisingRepository();
    await expect(repository.load()).rejects.toThrow("original browser data has not been changed");
    await expect(repository.createPendingProduct({ sku: "DO-NOT-SAVE", name: "Must not replace original", category: "Wine" })).rejects.toThrow("could not be opened");
    expect(localStorage.getItem(key)).toBe(value);
  });

  it("does not overwrite legacy saved geometry or campaign placements when a published baseline changes", async () => {
    const legacy = structuredClone(seedSnapshot);
    const area = legacy.displayAreas.find((item) => item.active)!;
    area.geometry = moved;
    legacy.campaignDisplayAssignments = [];
    legacy.displayAssignments = [];
    localStorage.setItem(key, JSON.stringify(legacy));
    const repository = new MockMerchandisingRepository();
    const after = await repository.load();
    expect(after.displayAreas.find((item) => item.id === area.id)?.geometry).toEqual(moved);
    expect(after.campaignDisplayAssignments).toEqual([]);
    expect(after.displayAssignments).toEqual([]);
    expect(localStorage.getItem(key)).toBe(JSON.stringify(legacy));
  });

  it("writes format metadata atomically with data and does not resurrect a deleted area on reopen", async () => {
    const repository = new MockMerchandisingRepository();
    const before = await repository.load();
    const area = before.displayAreas.find((candidate) => candidate.active)!;
    const write = vi.spyOn(localStorage, "setItem");
    await repository.updateDisplayArea({ displayAreaId: area.id, patch: { geometry: moved } });
    expect(write).toHaveBeenCalledTimes(1);
    expect(deserializeSnapshot(localStorage.getItem(key)!)).toHaveProperty("__blackBettyStorage.schemaVersion", 1);
    const unreferenced = (await repository.load()).displayAreas.find((candidate) =>
      !before.assignments.some((item) => item.displayAreaId === candidate.id) &&
      !before.displayAssignments.some((item) => item.displayAreaId === candidate.id) &&
      !before.campaignDisplayAssignments.some((item) => item.displayAreaId === candidate.id || item.suggestionDisplayAreaId === candidate.id) &&
      !before.displayAreaSections.some((item) => item.displayAreaId === candidate.id) &&
      !before.performance.some((item) => item.displayAreaId === candidate.id) &&
      !before.history.some((item) => item.displayAreaId === candidate.id) &&
      !before.recommendations.some((item) => item.displayAreaId === candidate.id));
    expect(unreferenced).toBeDefined();
    await repository.deleteDisplayArea(unreferenced!.id);
    expect((await new MockMerchandisingRepository().load()).displayAreas.some((item) => item.id === unreferenced!.id)).toBe(false);
  });

  it("rejects a stale edit base after a refresh without changing the newer geometry", async () => {
    const repository = new MockMerchandisingRepository(undefined, structuredClone(seedSnapshot), false);
    const area = (await repository.load()).displayAreas.find((item) => item.active)!;
    await repository.updateDisplayArea({ displayAreaId: area.id, patch: { geometry: moved }, expectedGeometry: area.geometry });
    await expect(repository.updateDisplayArea({ displayAreaId: area.id, patch: { geometry: { ...moved, x: 0.5 } }, expectedGeometry: area.geometry })).rejects.toThrow("changed after you began editing");
    expect((await repository.load()).displayAreas.find((item) => item.id === area.id)?.geometry).toEqual(moved);
  });
});
