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

  it("covers expected sell-through before the display set and rounds to supplier multiples", async () => {
    const data = structuredClone(seedSnapshot);
    const assignmentProduct = data.displayAssignmentProducts.find((item) => item.assignmentId === IDS.ondEndcapAEarlyAssignment && item.productId === IDS.ondHarvestProduct)!;
    assignmentProduct.caseQuantity = 8;
    const inventory = data.inventoryPositions.find((item) => item.storeId === IDS.store && item.productId === IDS.ondHarvestProduct)!;
    inventory.onHandCases = 2;
    inventory.reservedCases = 0;
    data.inboundOrders = [];
    data.historicalDemand = [
      { id: "forecast-multiple-history", storeId: IDS.store, productId: IDS.ondHarvestProduct, category: "Wine", date: "2025-10-15", cases: 0.5 },
    ];
    const preferred = data.supplierProductOptions.find((item) => item.productId === IDS.ondHarvestProduct && item.preferred)!;
    preferred.orderMultipleCases = 4;

    const result = await generator.generate(input, data);

    expect(result.forecast.dailyDemand).toHaveLength(7);
    expect(result.forecast.dailyDemand[0].date).toBe("2026-09-24");
    expect(result.forecast.dailyDemand.at(-1)?.date).toBe("2026-09-30");
    expect(result.recommendation.forecastCases).toBeUndefined();
    expect(result.coverage.requiredCases).toBe(12);
    expect(result.coverage.uncoveredCases).toBe(10);
    expect(result.recommendation.recommendedCases).toBe(12);
    expect(result.recommendation.rationale).toContain("Rounded from 10 to 12 cases");
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
