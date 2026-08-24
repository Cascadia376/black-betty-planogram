import { describe, expect, it } from "vitest";
import { calculateComplianceScore, generateRecommendations, getAssignmentCompatibility, validateCampaign, validateGeometry } from "./rules";
import { seedSnapshot } from "../adapters/mock/seed";

describe("campaign validation", () => {
  it("requires core campaign fields and products", () => {
    const campaign = seedSnapshot.campaigns[0];
    expect(validateCampaign({ ...campaign, name: "", products: [] })).toEqual([
      "Campaign name is required.", "Add at least one campaign product.",
    ]);
  });

  it("rejects an inverted date range", () => {
    const campaign = seedSnapshot.campaigns[0];
    expect(validateCampaign({ ...campaign, startDate: "2026-10-01", endDate: "2026-09-01" })).toContain("End date must be on or after start date.");
  });
});

describe("display-area geometry", () => {
  it("accepts normalized geometry inside the floorplan", () => {
    expect(validateGeometry({ x: 0.2, y: 0.3, width: 0.2, height: 0.1 })).toEqual([]);
  });

  it("rejects geometry outside the floorplan", () => {
    expect(validateGeometry({ x: 0.9, y: 0.3, width: 0.2, height: 0.1 })).toContain("Geometry must remain inside the normalized floorplan.");
  });
});

describe("assignment compatibility", () => {
  it("matches campaign and display types", () => {
    expect(getAssignmentCompatibility(seedSnapshot.campaigns[0], seedSnapshot.displayAreas[0])).toBe("compatible");
  });

  it("flags a flexible alternate display for review", () => {
    expect(getAssignmentCompatibility(seedSnapshot.campaigns[0], { ...seedSnapshot.displayAreas[0], type: "floor_display" })).toBe("requires_review");
  });
});

describe("compliance scoring", () => {
  it("scores required checks only", () => {
    expect(calculateComplianceScore([
      { key: "one", label: "One", passed: true, required: true },
      { key: "two", label: "Two", passed: false, required: true },
      { key: "advisory", label: "Advisory", passed: false, required: false },
    ])).toBe(50);
  });
});

describe("recommendation rules", () => {
  it("explains high velocity with stockouts", () => {
    expect(generateRecommendations([seedSnapshot.performance[0]])).toEqual(expect.arrayContaining([expect.objectContaining({ rule: "increase_space" })]));
  });

  it("flags low velocity and aging stock", () => {
    expect(generateRecommendations([seedSnapshot.performance[1]]).map((item) => item.rule)).toEqual(["review_allocation", "aging_inventory"]);
  });
});

