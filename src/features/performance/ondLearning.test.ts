import { describe, expect, it } from "vitest";
import { IDS, seedSnapshot } from "../../adapters/mock/seed";
import { buildOndLearningInsights, filterOndPerformance } from "./ondLearning";

describe("OND performance learning", () => {
  it("answers the seven operating questions with explainable rules", () => {
    const insights = buildOndLearningInsights(seedSnapshot.ondPerformance, seedSnapshot);
    expect(new Set(insights.map((item) => item.category))).toEqual(new Set(["best_display", "repeated_stockout", "allocation_high", "allocation_low", "bridge_value", "bridge_excess", "reset_issue"]));
    expect(insights.every((item) => item.explanation && item.rule)).toBe(true);
  });

  it("filters at program, store, display, assignment, product, and period grain", () => {
    const records = filterOndPerformance(seedSnapshot.ondPerformance, { programId: IDS.ondProgram, storeId: IDS.store, displayAreaId: IDS.endcapA, displayAssignmentId: IDS.ondEndcapAEarlyAssignment, productId: IDS.ondHarvestProduct, periodId: IDS.ondEarlyPeriod });
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe("e0000000-0000-4000-8000-000000000001");
  });
});
