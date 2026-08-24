import { describe, expect, it } from "vitest";
import { IDS, seedSnapshot } from "../../adapters/mock/seed";
import { buildStoreWorkspaceModel } from "./storeWorkspaceModel";

describe("buildStoreWorkspaceModel", () => {
  it("combines OND execution and ordering attention for a store", () => {
    const model = buildStoreWorkspaceModel(seedSnapshot, IDS.store);

    expect(model.program?.name).toBe("OND 2026");
    expect(model.majorDemandPhaseStart).toBe("2026-12-15");
    expect(model.attention).toEqual({
      displaysToSet: 3,
      resetsDue: 2,
      overdueTasks: 1,
      issues: 0,
      ordersRequiredToday: 1,
      productsAtRisk: 1,
      upcomingOpeningFills: 3,
      bridgeActions: 1,
      exitRiskProducts: 1,
    });
  });
});
