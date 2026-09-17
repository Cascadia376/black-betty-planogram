import { describe, expect, it } from "vitest";
import migration from "../../../supabase/migrations/20260917164730_harden_physical_reference_boundary.sql?raw";
import planningShapeMigration from "../../../supabase/migrations/20260917181555_initialize_black_betty_planning_shape.sql?raw";

describe("physical reference boundary migration", () => {
  it("separates physical JSON and limits physical updates to admins", () => {
    expect(migration).toContain("create table public.black_betty_physical_snapshot");
    expect(migration).toContain("grant update (physical) on public.black_betty_physical_snapshot to authenticated");
    expect(migration).toContain("using ((select private.black_betty_role()) = 'admin')");
    expect(migration).toContain("grant update (planning) on public.black_betty_planning_snapshot to authenticated");
    expect(migration).toContain("planning = planning - array[");
    expect(migration).toContain("black_betty_planning_snapshot_excludes_physical_reference");
    expect(migration).not.toMatch(/buyers? can update canonical physical/i);
  });

  it("initializes every repository-owned planning collection", () => {
    for (const key of [
      "campaigns", "campaignImports", "campaignStoreProductAllocations", "campaignDisplays",
      "campaignDisplayProducts", "campaignStores", "campaignDisplayAssignments",
      "campaignDisplayAssignmentProducts", "campaignReleases", "storeReleaseNotices",
      "displayAssignments", "displayAssignmentProducts", "assignments", "executions",
      "complianceReviews", "history", "campaignProducts",
    ]) {
      expect(planningShapeMigration).toContain(`'${key}'`);
    }
    expect(planningShapeMigration).not.toContain("'storeLayouts'");
    expect(planningShapeMigration).not.toContain("'displayAreas'");
  });
});
