import type { OndPerformanceRecord, PlatformSnapshot } from "../../domain/types";
import { productDetails } from "../programs/allocationPlanner";

export type OndLearningCategory = "best_display" | "repeated_stockout" | "allocation_high" | "allocation_low" | "bridge_value" | "bridge_excess" | "reset_issue";

export interface OndLearningInsight {
  category: OndLearningCategory;
  title: string;
  subject: string;
  explanation: string;
  rule: string;
  tone: "success" | "warning" | "error" | "info";
}

export interface OndPerformanceFilters {
  programId: string;
  storeId: string;
  displayAreaId: string;
  displayAssignmentId: string;
  productId: string;
  periodId: string;
}

export function filterOndPerformance(records: OndPerformanceRecord[], filters: OndPerformanceFilters) {
  return records.filter((record) =>
    (!filters.programId || record.programId === filters.programId)
    && (!filters.storeId || record.storeId === filters.storeId)
    && (!filters.displayAreaId || record.displayAreaId === filters.displayAreaId)
    && (!filters.displayAssignmentId || record.displayAssignmentId === filters.displayAssignmentId)
    && (!filters.productId || record.productId === filters.productId)
    && (!filters.periodId || record.periodId === filters.periodId),
  );
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const value = key(item);
    groups[value] = [...(groups[value] ?? []), item];
    return groups;
  }, {});
}

function productName(productId: string, data: PlatformSnapshot) {
  const assignmentProduct = data.displayAssignmentProducts.find((item) => item.productId === productId);
  return assignmentProduct ? productDetails(assignmentProduct, data).name : productId;
}

export function buildOndLearningInsights(records: OndPerformanceRecord[], data: PlatformSnapshot): OndLearningInsight[] {
  if (!records.length) return [];
  const insights: OndLearningInsight[] = [];
  const byArea = groupBy(records, (record) => record.displayAreaId);
  const rankedAreas = Object.entries(byArea).map(([areaId, items]) => ({ areaId, items, lift: average(items.flatMap((item) => item.salesLiftPercent === undefined ? [] : [item.salesLiftPercent])) })).sort((a, b) => b.lift - a.lift);
  const best = rankedAreas[0];
  if (best) {
    const area = data.displayAreas.find((item) => item.id === best.areaId);
    insights.push({ category: "best_display", title: "Best measured display area", subject: area?.name ?? best.areaId, explanation: `${best.lift.toFixed(1)}% average sales lift across ${best.items.length} measured product result${best.items.length === 1 ? "" : "s"}; $${best.items.reduce((sum, item) => sum + item.grossMarginDollars, 0).toLocaleString()} gross margin.`, rule: "Rank display areas by average sales lift where a baseline exists; report gross margin as supporting context.", tone: "success" });
  }

  for (const [productId, items] of Object.entries(groupBy(records, (record) => record.productId))) {
    const stockoutPeriods = items.filter((item) => item.stockoutRate >= 0.1);
    if (stockoutPeriods.length >= 2) insights.push({ category: "repeated_stockout", title: "Repeated stockout signal", subject: productName(productId, data), explanation: `${stockoutPeriods.length} measured assignments reached at least a 10% stockout rate; average ${(average(stockoutPeriods.map((item) => item.stockoutRate)) * 100).toFixed(1)}%.`, rule: "Flag a product when stockout rate is at least 10% in two or more measured assignments.", tone: "error" });
    if (average(items.map((item) => item.stockoutRate)) >= 0.1 && average(items.flatMap((item) => item.salesLiftPercent === undefined ? [] : [item.salesLiftPercent])) >= 5) insights.push({ category: "allocation_low", title: "Allocation may be too low", subject: productName(productId, data), explanation: `${(average(items.map((item) => item.stockoutRate)) * 100).toFixed(1)}% average stockout rate alongside ${average(items.flatMap((item) => item.salesLiftPercent === undefined ? [] : [item.salesLiftPercent])).toFixed(1)}% average sales lift.`, rule: "Flag low allocation when average stockout rate is at least 10% and measured sales lift is at least 5%.", tone: "warning" });
  }

  records.filter((record) => record.actualResidualCases - record.projectedResidualCases >= 4 && record.stockoutRate <= 0.05).forEach((record) => {
    const area = data.displayAreas.find((item) => item.id === record.displayAreaId);
    insights.push({ category: "allocation_high", title: "Allocation may be too high", subject: `${area?.name ?? record.displayAreaId} · ${productName(record.productId, data)}`, explanation: `${record.actualResidualCases} actual residual cases versus ${record.projectedResidualCases} projected, with a ${(record.stockoutRate * 100).toFixed(0)}% stockout rate.`, rule: "Flag when actual residual exceeds projection by at least 4 cases and stockout rate is no more than 5%.", tone: "warning" });
  });

  records.filter((record) => record.bridgeInventoryCases > 0 && record.bridgeSoldThroughCases / record.bridgeInventoryCases >= 0.75 && (record.incrementalBridgeMargin ?? 0) > 0).forEach((record) => {
    insights.push({ category: "bridge_value", title: "Bridge buy created measured value", subject: productName(record.productId, data), explanation: `${record.bridgeSoldThroughCases} of ${record.bridgeInventoryCases} bridge cases sold through; $${record.incrementalBridgeMargin?.toLocaleString()} incremental margin captured.`, rule: "Flag value when at least 75% of bridge inventory sells through and incremental margin is positive.", tone: "success" });
  });

  records.filter((record) => record.bridgeInventoryCases - record.bridgeSoldThroughCases >= 4).forEach((record) => {
    const area = data.displayAreas.find((item) => item.id === record.displayAreaId);
    insights.push({ category: "bridge_excess", title: "Bridge buy left excess inventory", subject: `${area?.name ?? record.displayAreaId} · ${productName(record.productId, data)}`, explanation: `${record.bridgeInventoryCases - record.bridgeSoldThroughCases} bridge cases remained after the measured sell-through window.`, rule: "Flag excess when at least 4 bridge cases remain unsold after the measured window.", tone: "error" });
  });

  for (const [periodId, items] of Object.entries(groupBy(records.filter((item) => item.periodId), (record) => record.periodId!))) {
    const issueCount = items.filter((item) => item.compliancePercent < 80 || item.openingFillReadinessPercent < 75).length;
    if (issueCount) {
      const period = data.programPeriods.find((item) => item.id === periodId);
      insights.push({ category: "reset_issue", title: "Reset period caused execution issues", subject: period?.name ?? periodId, explanation: `${issueCount} of ${items.length} measured product results fell below the execution threshold; ${average(items.map((item) => item.openingFillReadinessPercent)).toFixed(0)}% average opening-fill readiness.`, rule: "Flag a reset period when any result is below 80% compliance or 75% opening-fill readiness.", tone: "error" });
    }
  }
  return insights;
}
