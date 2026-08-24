import { describe, expect, it } from "vitest";
import type { BridgeStrategy, ResidualDemandInput } from "../../domain/types";
import { calculateResidualInventory } from "./ResidualInventoryService";

const strategy: BridgeStrategy = { productId: "synthetic-core", strategy: "BRIDGE_BUY", eligibility: "yes", bridgeHorizonDays: 45, maxWeeksOfSupply: 8, maxCases: 28, ltoEndDate: "2026-12-31" };
const demand: ResidualDemandInput = { storeId: "synthetic-store", productId: strategy.productId, projectedQ1Volume: 180, currentStock: 20, inboundStock: 10, ondForecastConsumption: 10 };

describe("residual inventory and bridge buying", () => {
  it("supports a bridge-eligible high-volume synthetic product", () => {
    const result = calculateResidualInventory(strategy, demand);
    expect(result.safeBridgeQuantity).toBe(28);
    expect(result.intentionalBridgeInventory).toBe(48);
    expect(result.unwantedResidual).toBe(0);
    expect(result.expectedSellThroughDate).toBeDefined();
  });

  it("does not bridge a non-eligible product", () => {
    expect(calculateResidualInventory({ ...strategy, eligibility: "no" }, demand).safeBridgeQuantity).toBe(0);
  });

  it("classifies seasonal exit inventory as unwanted residual", () => {
    const result = calculateResidualInventory({ ...strategy, strategy: "EXIT", eligibility: "no" }, demand);
    expect(result.unwantedResidual).toBe(20);
    expect(result.intentionalBridgeInventory).toBe(0);
    expect(result.explanation).toContain("Exit strategy");
  });

  it("returns normal-carry products toward standard weeks of supply", () => {
    const result = calculateResidualInventory({ ...strategy, strategy: "NORMAL_CARRY", eligibility: "no" }, { ...demand, projectedQ1Volume: 26, normalWeeksOfSupply: 2 });
    expect(result.safeBridgeQuantity).toBe(0);
    expect(result.unwantedResidual).toBe(16);
  });

  it("enforces the maximum weeks-of-supply limit", () => {
    const result = calculateResidualInventory({ ...strategy, maxWeeksOfSupply: 2, maxCases: 100 }, { ...demand, projectedQ1Volume: 130, currentStock: 0, inboundStock: 0, ondForecastConsumption: 0 });
    expect(result.safeBridgeQuantity).toBe(20);
  });

  it("enforces the maximum case limit", () => {
    expect(calculateResidualInventory({ ...strategy, maxCases: 7 }, { ...demand, currentStock: 0, inboundStock: 0, ondForecastConsumption: 0 }).safeBridgeQuantity).toBe(7);
  });

  it("does not bridge when Q1 demand is insufficient", () => {
    const result = calculateResidualInventory(strategy, { ...demand, projectedQ1Volume: 10, currentStock: 5, inboundStock: 0, ondForecastConsumption: 0 });
    expect(result.safeBridgeQuantity).toBe(0);
  });

  it("calculates incremental margin from a synthetic cost advantage", () => {
    const result = calculateResidualInventory({ ...strategy, promotionalCost: 10, expectedPostLtoCost: 12 }, demand);
    expect(result.incrementalMarginOpportunity).toBe(56);
  });
});
