import type {
  Campaign,
  Compatibility,
  ComplianceCheck,
  DisplayArea,
  Geometry,
  NewCampaignInput,
  PerformanceRecord,
  Recommendation,
} from "./types";

export function validateGeometry(geometry: Geometry): string[] {
  const errors: string[] = [];
  const values = [geometry.x, geometry.y, geometry.width, geometry.height];
  if (values.some((value) => !Number.isFinite(value))) errors.push("Geometry values must be finite numbers.");
  if (geometry.x < 0 || geometry.y < 0 || geometry.width <= 0 || geometry.height <= 0) {
    errors.push("Geometry must use positive normalized dimensions.");
  }
  if (geometry.x + geometry.width > 1 || geometry.y + geometry.height > 1) {
    errors.push("Geometry must remain inside the normalized floorplan.");
  }
  return errors;
}

export function validateCampaign(input: NewCampaignInput): string[] {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push("Campaign name is required.");
  if (!input.owner.trim()) errors.push("Campaign owner is required.");
  if (!input.startDate || !input.endDate) errors.push("Start and end dates are required.");
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    errors.push("End date must be on or after start date.");
  }
  if (input.products.length === 0) errors.push("Add at least one campaign product.");
  if (input.products.some((product) => product.required && product.minimumQuantity < 1)) {
    errors.push("Required products need a minimum quantity of at least one.");
  }
  return errors;
}

export function getAssignmentCompatibility(campaign: Campaign, area: DisplayArea): Compatibility {
  if (campaign.requirement.displayType === area.type) return "compatible";
  const flexiblePairs = new Set([
    "endcap:floor_display",
    "floor_display:endcap",
    "feature_table:seasonal_area",
    "seasonal_area:feature_table",
  ]);
  if (flexiblePairs.has(`${campaign.requirement.displayType}:${area.type}`)) return "requires_review";
  return "incompatible";
}

export function calculateComplianceScore(checks: ComplianceCheck[]): number {
  const required = checks.filter((check) => check.required);
  if (required.length === 0) return 100;
  return Math.round((required.filter((check) => check.passed).length / required.length) * 100);
}

export function generateRecommendations(records: PerformanceRecord[]): Recommendation[] {
  return records.flatMap((record) => {
    const recommendations: Recommendation[] = [];
    if (record.unitLiftPercent >= 10 && record.outOfStockRate >= 0.08) {
      recommendations.push({
        id: `${record.id}-space`, displayAreaId: record.displayAreaId, campaignId: record.campaignId,
        title: "Increase space or replenishment frequency",
        rationale: "High unit lift coincided with repeated stockouts during this measured period.",
        rule: "increase_space", status: "open",
      });
    }
    if (record.unitLiftPercent <= 1 && record.weeksOfSupply >= 8) {
      recommendations.push({
        id: `${record.id}-allocation`, displayAreaId: record.displayAreaId, campaignId: record.campaignId,
        title: "Review display allocation",
        rationale: "Low measured unit lift and high weeks of supply suggest the allocated space may be excessive.",
        rule: "review_allocation", status: "open",
      });
    }
    if (record.weeksOfSupply >= 10 && record.agedInventoryPercent >= 0.2) {
      recommendations.push({
        id: `${record.id}-aging`, displayAreaId: record.displayAreaId, campaignId: record.campaignId,
        title: "Review aging inventory",
        rationale: "High weeks of supply and a meaningful share of aged inventory were observed together.",
        rule: "aging_inventory", status: "open",
      });
    }
    return recommendations;
  });
}

