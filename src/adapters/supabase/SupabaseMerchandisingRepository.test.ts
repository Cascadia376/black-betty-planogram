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
    const readRow = (table: SnapshotTable) => structuredClone(table === "black_betty_planning_snapshot" ? this.planningRow : this.physicalRow);
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
            return { eq() { return { single: async () => ({ data: readRow(table), error: null }) }; } };
          },
          update(values: { planning?: SharedPlanningSnapshot; physical?: PhysicalReferenceSnapshot }) {
            const filters = new Map<string, unknown>();
            const builder = {
              eq(column: string, value: unknown) { filters.set(column, value); return builder; },
              select() { return builder; },
              async maybeSingle() {
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
});
