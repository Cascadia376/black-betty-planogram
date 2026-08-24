import { describe, expect, it } from "vitest";
import { IDS, seedSnapshot } from "../../adapters/mock/seed";
import { MockHistoricalDemandSource } from "../demand/MockHistoricalDemandSource";
import { RuleBasedOndDemandService } from "../demand/RuleBasedOndDemandService";
import { RuleBasedOrderRecommendationService } from "./OrderRecommendationService";

const demand = new RuleBasedOndDemandService(new MockHistoricalDemandSource(seedSnapshot.historicalDemand));
const generator = new RuleBasedOrderRecommendationService(demand);
const input = { id: "generated-1", storeId: IDS.store, productId: IDS.ondHarvestProduct, category: "Wine", displayAssignmentId: IDS.ondEndcapAEarlyAssignment, recommendationDate: "2026-09-24", recommendationType: "opening_fill" as const };

describe("rule-based order recommendation generation", () => {
  it("derives the required-by date and explains the recommendation", async () => {
    const result = await generator.generate(input, structuredClone(seedSnapshot));
    expect(result.recommendation.requiredByDate).toBe("2026-10-01");
    expect(result.supplierSelection.expectedArrivalDate).toBe("2026-09-29");
    expect(result.recommendation.rationale).toContain("Forecast confidence is high");
  });

  it("reduces the recommendation for an inbound PO arriving by the required date", async () => {
    const withInbound = await generator.generate(input, structuredClone(seedSnapshot));
    const withoutInboundData = structuredClone(seedSnapshot);
    withoutInboundData.inboundOrders = [];
    const withoutInbound = await generator.generate(input, withoutInboundData);
    expect(withInbound.coverage.inboundCases).toBe(2);
    expect(withInbound.recommendation.recommendedCases).toBe(withoutInbound.recommendation.recommendedCases - 2);
  });
});
