import type { BridgeStrategy, ResidualDemandInput } from "../../domain/types";

export interface ResidualInventoryProjection {
  strategy: BridgeStrategy["strategy"];
  projectedInventoryAtProgramEnd: number;
  projectedPostProgramDemand: number;
  expectedSellThroughDate?: string;
  unwantedResidual: number;
  intentionalBridgeInventory: number;
  safeBridgeQuantity: number;
  incrementalMarginOpportunity?: number;
  explanation: string;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function validateInputs(strategy: BridgeStrategy, demand: ResidualDemandInput) {
  const values = [demand.projectedQ1Volume, demand.currentStock, demand.inboundStock, demand.ondForecastConsumption];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Residual inventory inputs must be non-negative numbers.");
  if (strategy.maxWeeksOfSupply !== undefined && strategy.maxWeeksOfSupply < 0) throw new Error("Maximum weeks of supply must be non-negative.");
  if (strategy.maxCases !== undefined && strategy.maxCases < 0) throw new Error("Maximum bridge cases must be non-negative.");
}

export function calculateResidualInventory(strategy: BridgeStrategy, demand: ResidualDemandInput): ResidualInventoryProjection {
  validateInputs(strategy, demand);
  const projectedInventoryAtProgramEnd = Math.max(0, demand.currentStock + demand.inboundStock - demand.ondForecastConsumption);
  const projectedPostProgramDemand = demand.projectedQ1Volume;
  const dailyDemand = demand.projectedQ1Volume / 90;
  const weeklyDemand = demand.projectedQ1Volume / 13;
  const ltoEndDate = strategy.ltoEndDate ?? "2026-12-31";
  let unwantedResidual = projectedInventoryAtProgramEnd;
  let intentionalBridgeInventory = 0;
  let safeBridgeQuantity = 0;
  let incrementalMarginOpportunity: number | undefined;
  let explanation: string;

  if (strategy.strategy === "EXIT") {
    explanation = "Exit strategy. Post-holiday inventory is not treated as intentional bridge stock; minimize residual after the program.";
  } else if (strategy.strategy === "NORMAL_CARRY") {
    const normalCarryCases = Math.floor(weeklyDemand * (demand.normalWeeksOfSupply ?? 2));
    unwantedResidual = Math.max(0, projectedInventoryAtProgramEnd - normalCarryCases);
    explanation = `Normal carry strategy. Return toward ${demand.normalWeeksOfSupply ?? 2} standard weeks of supply; ${unwantedResidual} cases exceed that level.`;
  } else if (strategy.eligibility !== "yes") {
    explanation = "Bridge buy is not approved by Buying. No additional bridge quantity is recommended.";
  } else {
    const horizonDemand = Math.floor(dailyDemand * (strategy.bridgeHorizonDays ?? 0));
    const weeksOfSupplyLimit = Math.floor(weeklyDemand * (strategy.maxWeeksOfSupply ?? 0));
    const supportedInventory = Math.min(projectedPostProgramDemand, horizonDemand, weeksOfSupplyLimit);
    const costAdvantage = strategy.promotionalCost !== undefined && strategy.expectedPostLtoCost !== undefined
      ? strategy.expectedPostLtoCost - strategy.promotionalCost
      : undefined;
    const hasCostDisadvantage = costAdvantage !== undefined && costAdvantage <= 0;
    const intentionalExisting = Math.min(projectedInventoryAtProgramEnd, supportedInventory);
    unwantedResidual = Math.max(0, projectedInventoryAtProgramEnd - supportedInventory);
    safeBridgeQuantity = hasCostDisadvantage ? 0 : Math.floor(Math.min(
      Math.max(0, supportedInventory - projectedInventoryAtProgramEnd),
      strategy.maxCases ?? 0,
    ));
    intentionalBridgeInventory = intentionalExisting + safeBridgeQuantity;
    if (costAdvantage !== undefined && costAdvantage > 0) incrementalMarginOpportunity = Math.round(safeBridgeQuantity * costAdvantage * 100) / 100;
    explanation = safeBridgeQuantity > 0
      ? `Bridge eligible. Expected Q1 velocity supports ${safeBridgeQuantity} additional cases within the configured horizon, weeks-of-supply, and case limits.`
      : hasCostDisadvantage
        ? "Bridge eligible, but the supplied costs do not provide an incremental buying advantage. No bridge quantity is recommended."
        : "Bridge eligible, but expected post-program demand does not support additional inventory within configured limits.";
  }

  const inventoryToSell = projectedInventoryAtProgramEnd + safeBridgeQuantity;
  const expectedSellThroughDate = dailyDemand > 0 && inventoryToSell > 0 ? addDays(ltoEndDate, Math.ceil(inventoryToSell / dailyDemand)) : undefined;
  if (expectedSellThroughDate && strategy.strategy === "BRIDGE_BUY") explanation += ` Estimated sell-through by ${expectedSellThroughDate}.`;
  return { strategy: strategy.strategy, projectedInventoryAtProgramEnd, projectedPostProgramDemand, expectedSellThroughDate, unwantedResidual, intentionalBridgeInventory, safeBridgeQuantity, incrementalMarginOpportunity, explanation };
}
