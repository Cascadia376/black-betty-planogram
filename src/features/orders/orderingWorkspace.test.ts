import { describe, expect, it } from "vitest";
import { IDS, seedSnapshot } from "../../adapters/mock/seed";
import { buildOrderWorkspaceItems } from "./orderingWorkspace";

describe("store ordering workspace", () => {
  const items = buildOrderWorkspaceItems(seedSnapshot, IDS.store, IDS.ondProgram);

  it("groups daily operational recommendations", () => {
    expect(items.find((item) => item.recommendation.id === IDS.ondOpeningRecommendation)?.group).toBe("order_today");
    expect(items.find((item) => item.recommendation.id === IDS.ondAtRiskRecommendation)?.group).toBe("at_risk");
    expect(items.find((item) => item.recommendation.id === IDS.ondCoveredRecommendation)?.group).toBe("covered");
  });

  it("preserves central bridge and exit strategy groups", () => {
    expect(items.find((item) => item.recommendation.id === IDS.ondBridgeRecommendation)?.group).toBe("intentional_bridge");
    expect(items.find((item) => item.recommendation.id === IDS.ondExitRecommendation)?.group).toBe("potential_residual");
  });
});
