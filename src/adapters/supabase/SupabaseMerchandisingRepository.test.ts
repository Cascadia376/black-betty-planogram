import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { IDS, seedSnapshot } from "../mock/seed";
import {
  createSupabaseMerchandisingRepository,
  physicalReferenceFromSnapshot,
  sharedPlanningFromSnapshot,
  SharedPlanningConflictError,
  type PhysicalReferenceSnapshot,
  type SharedPlanningSnapshot,
} from "./SupabaseMerchandisingRepository";

type SnapshotTable = "black_betty_planning_snapshot" | "black_betty_physical_snapshot";

class FakeSharedStore {
  planningUpdates = 0;
  physicalUpdates = 0;
  reads = 0;
  malformedPlanning = false;
  failReads = false;
  beforeWrite?: () => Promise<void>;
  private planningRow = {
    singleton: true,
    planning: sharedPlanningFromSnapshot(seedSnapshot),
    version: 1,
    updated_at: "2026-09-17T00:00:00.000Z",
    updated_by: undefined as string | undefined,
  };
  private physicalRow = {
    singleton: true,
    physical: physicalReferenceFromSnapshot(seedSnapshot),
    version: 1,
    updated_at: "2026-09-17T00:00:00.000Z",
    updated_by: undefined as string | undefined,
  };

  physicalSnapshot(): PhysicalReferenceSnapshot {
    return structuredClone(this.physicalRow.physical);
  }

  client(): SupabaseClient {
    const recordRead = () => { this.reads += 1; };
    const beforeWrite = () => this.beforeWrite?.();
    const readRow = (table: SnapshotTable) => {
      if (this.failReads) throw new Error("Network unavailable");
      const row = structuredClone(table === "black_betty_planning_snapshot" ? this.planningRow : this.physicalRow);
      if (this.malformedPlanning && "planning" in row) (row.planning as unknown as Record<string, unknown>).campaigns = null;
      return row;
    };
    const updateRow = (table: SnapshotTable, values: { planning?: SharedPlanningSnapshot; physical?: PhysicalReferenceSnapshot }, expectedVersion: unknown) => {
      if (table === "black_betty_planning_snapshot") {
        if (expectedVersion !== this.planningRow.version || !values.planning) return null;
        this.planningRow = { ...this.planningRow, planning: structuredClone(values.planning), version: this.planningRow.version + 1, updated_at: new Date().toISOString() };
        this.planningUpdates += 1;
      } else {
        if (expectedVersion !== this.physicalRow.version || !values.physical) return null;
        this.physicalRow = { ...this.physicalRow, physical: structuredClone(values.physical), version: this.physicalRow.version + 1, updated_at: new Date().toISOString() };
        this.physicalUpdates += 1;
      }
      return readRow(table);
    };
    return {
      from(tableName: string) {
        if (tableName !== "black_betty_planning_snapshot" && tableName !== "black_betty_physical_snapshot") throw new Error(`Unexpected table ${tableName}`);
        const table = tableName as SnapshotTable;
        return {
          select() {
            return { eq() { return { single: async () => { recordRead(); return { data: readRow(table), error: null }; } }; } };
          },
          update(values: { planning?: SharedPlanningSnapshot; physical?: PhysicalReferenceSnapshot }) {
            const filters = new Map<string, unknown>();
            const builder = {
              eq(column: string, value: unknown) { filters.set(column, value); return builder; },
              select() { return builder; },
              async maybeSingle() {
                await beforeWrite();
                if (filters.get("singleton") !== true) return { data: null, error: null };
                return { data: updateRow(table, values, filters.get("version")), error: null };
              },
            };
            return builder;
          },
        };
      },
    } as unknown as SupabaseClient;
  }
}

describe("Supabase merchandising repository", () => {
  it("serializes campaign and physical collections into disjoint documents", () => {
    const planning = sharedPlanningFromSnapshot(seedSnapshot) as unknown as Record<string, unknown>;
    const physical = physicalReferenceFromSnapshot(seedSnapshot) as unknown as Record<string, unknown>;

    for (const key of Object.keys(physical)) expect(planning).not.toHaveProperty(key);
    expect(Object.keys(physical)).toEqual(expect.arrayContaining([
      "storeLayouts", "categorySpaces", "displayAreas", "displayAreaSections",
    ]));
  });

  it("shares campaign changes, preserves physical reference data and rejects a stale overwrite", async () => {
    const shared = new FakeSharedStore();
    const originalPhysical = shared.physicalSnapshot();
    const userA = createSupabaseMerchandisingRepository(shared.client());
    const userB = createSupabaseMerchandisingRepository(shared.client());

    await userA.load();
    const campaignId = await userA.createCampaign({
      name: "OND 2027", type: "OND", description: "Shared campaign", startDate: "2027-10-01", endDate: "2027-12-31",
      owner: "Jeremy", supplier: "Multiple vendors", products: [],
    });
    await userA.setCampaignStores({ campaignId, storeIds: [IDS.store] });
    const area = seedSnapshot.displayAreas.find((candidate) => candidate.storeId === IDS.store && candidate.active)!;
    const display = await userA.createCampaignDisplay({
      campaignId, displayAreaId: area.id,
      display: { name: "OND feature", displayType: area.type, placementMode: "STORE_SPECIFIC", prescriptive: true },
    });

    const loadedByB = await userB.load();
    expect(loadedByB.campaigns).toContainEqual(expect.objectContaining({ id: campaignId, name: "OND 2027" }));
    const assignment = loadedByB.campaignDisplayAssignments.find((item) => item.campaignDisplayId === display.id)!;
    await userB.updateCampaignDisplayAssignment({ campaignDisplayAssignmentId: assignment.id, executionNotes: "Cherie confirmed the display build." });

    expect(shared.physicalUpdates).toBe(0);
    expect(shared.physicalSnapshot()).toEqual(originalPhysical);
    const reloadedByA = await userA.load();
    expect(reloadedByA.campaignDisplayAssignments.find((item) => item.id === assignment.id)?.executionNotes).toBe("Cherie confirmed the display build.");

    await userB.load();
    await userA.load();
    await userB.updateCampaignDisplayAssignment({ campaignDisplayAssignmentId: assignment.id, executionNotes: "Cherie's newer display note" });
    await expect(userA.updateCampaignDisplayAssignment({ campaignDisplayAssignmentId: assignment.id, executionNotes: "Jeremy's stale display note" }))
      .rejects.toBeInstanceOf(SharedPlanningConflictError);
    expect((await userA.load()).campaignDisplayAssignments.find((item) => item.id === assignment.id)?.executionNotes).toBe("Cherie's newer display note");
  });

  it("writes an explicit physical layout edit only to the physical document", async () => {
    const shared = new FakeSharedStore();
    const repository = createSupabaseMerchandisingRepository(shared.client());
    const before = await repository.load();
    const area = before.displayAreas.find((candidate) => candidate.storeId === IDS.store && candidate.active)!;
    const geometry = { x: 0.1, y: 0.12, width: 0.06, height: 0.07 };

    await repository.updateDisplayArea({ displayAreaId: area.id, patch: { geometry } });

    expect(shared.physicalUpdates).toBe(1);
    expect(shared.planningUpdates).toBe(0);
    expect(shared.physicalSnapshot().displayAreas.find((candidate) => candidate.id === area.id)?.geometry).toEqual(geometry);
    expect((await repository.load()).campaigns).toEqual(before.campaigns);
  });
  it("queues refresh behind an in-flight save instead of replacing its local state or version", async () => {
    const shared = new FakeSharedStore();
    const repository = createSupabaseMerchandisingRepository(shared.client());
    await repository.load();
    let release!: () => void;
    let entered!: () => void;
    const writing = new Promise<void>((resolve) => { entered = resolve; });
    const paused = new Promise<void>((resolve) => { release = resolve; });
    shared.beforeWrite = async () => { entered(); await paused; };
    const saving = repository.createCampaign({ name: "Concurrent refresh", type: "Monthly flyer", description: "", startDate: "2027-10-01", endDate: "2027-10-31", owner: "Test buyer", supplier: "", products: [] });
    await writing;
    const refreshing = repository.load();
    await Promise.resolve();
    expect(shared.reads).toBe(2);
    release();
    const campaignId = await saving;
    expect((await refreshing).campaigns.some((campaign) => campaign.id === campaignId)).toBe(true);
    expect(shared.reads).toBe(4);
    expect(shared.planningUpdates).toBe(1);
  });

  it("rejects a stale physical save and allows a deliberate reload/retry", async () => {
    const shared = new FakeSharedStore();
    const buyerA = createSupabaseMerchandisingRepository(shared.client());
    const buyerB = createSupabaseMerchandisingRepository(shared.client());
    const before = await buyerA.load(); await buyerB.load();
    const area = before.displayAreas.find((item) => item.active)!;
    const geometry = { x: 0.1, y: 0.2, width: 0.06, height: 0.07 };
    await buyerB.updateDisplayArea({ displayAreaId: area.id, patch: { geometry } });
    await expect(buyerA.updateDisplayArea({ displayAreaId: area.id, patch: { geometry: { ...geometry, x: 0.4 } } })).rejects.toThrow("physical store layout changed");
    expect(shared.physicalUpdates).toBe(1);
    const latest = await buyerA.load();
    await buyerA.updateDisplayArea({ displayAreaId: area.id, expectedGeometry: latest.displayAreas.find((item) => item.id === area.id)!.geometry, patch: { geometry: { ...geometry, x: 0.3 } } });
    expect(shared.physicalUpdates).toBe(2);
    expect(shared.planningUpdates).toBe(0);
  });

  it("refuses incomplete server data and recovers without inserting demo campaigns", async () => {
    const shared = new FakeSharedStore();
    shared.malformedPlanning = true;
    const repository = createSupabaseMerchandisingRepository(shared.client());
    await expect(repository.load()).rejects.toThrow("incomplete or damaged");
    await expect(repository.createCampaign({ name: "Do not save", type: "OND", owner: "Test buyer", description: "", supplier: "", startDate: "2027-10-01", endDate: "2027-12-31", products: [] })).rejects.toThrow("incomplete or damaged");
    expect(shared.planningUpdates).toBe(0);
    shared.malformedPlanning = false;
    expect((await repository.load()).campaigns).toEqual(seedSnapshot.campaigns);
  });

  it("does not report a successful prototype operation that cannot be persisted", async () => {
    const shared = new FakeSharedStore();
    const repository = createSupabaseMerchandisingRepository(shared.client());
    const before = await repository.load();
    await expect(repository.updateRecommendation(before.recommendations[0].id, "accepted")).rejects.toThrow("not available in shared planning");
    expect(shared.planningUpdates).toBe(0);
    expect(await repository.getCommittedSnapshot!()).toEqual(before);
  });

  it("returns the acknowledged snapshot even when a subsequent network refresh fails", async () => {
    const shared = new FakeSharedStore();
    const repository = createSupabaseMerchandisingRepository(shared.client());
    await repository.load();
    const id = await repository.createCampaign({ name: "Acknowledged", type: "OND", owner: "Test buyer", description: "", supplier: "", startDate: "2027-10-01", endDate: "2027-12-31", products: [] });
    shared.failReads = true;
    expect((await repository.getCommittedSnapshot!()).campaigns.some((item) => item.id === id)).toBe(true);
    await expect(repository.load()).rejects.toThrow("Network unavailable");
    expect((await repository.getCommittedSnapshot!()).campaigns.some((item) => item.id === id)).toBe(true);
  });

  it("refuses to publish synthetic catalog records through shared production planning", async () => {
    const shared = new FakeSharedStore();
    const repository = createSupabaseMerchandisingRepository(shared.client());
    const before = await repository.load();
    const campaign = before.campaigns.find((item) => item.products.some((member) => before.products.some((product) => product.id === member.productId && product.synthetic)))!;
    expect(campaign).toBeDefined();
    await expect(repository.publishCampaign({ campaignId: campaign.id, publishedBy: "Test buyer" })).rejects.toThrow("demo products");
    expect(shared.planningUpdates).toBe(0);
    expect(await repository.getCommittedSnapshot!()).toEqual(before);
  });

});
