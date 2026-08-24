import { describe, expect, it } from "vitest";
import { IDS, seedSnapshot } from "../../adapters/mock/seed";
import { buildAssignmentComplianceChecks, getExecutionContext } from "./executionContext";

describe("OND execution context", () => {
  it("uses display-assignment products and case quantities", () => {
    const context = getExecutionContext(seedSnapshot, IDS.seasonalExecution);
    expect(context.program?.name).toBe("OND 2026");
    expect(context.area?.displayNumber).toBe("4");
    expect(context.products).toHaveLength(2);
    expect(context.products[0]).toEqual(expect.objectContaining({ sku: "MOCK-OND-1001", plannedQuantity: "10 cases", onHandCases: 5 }));
  });

  it("flags required stock gaps and substitution requests for review", () => {
    const checks = buildAssignmentComplianceChecks(["REQUIRED"], ["REQUIRED"], true);
    expect(checks.find((item) => item.key === "products")?.passed).toBe(false);
    expect(checks.find((item) => item.key === "stock_gaps")?.passed).toBe(false);
    expect(checks.find((item) => item.key === "substitutions")?.passed).toBe(false);
  });
});
