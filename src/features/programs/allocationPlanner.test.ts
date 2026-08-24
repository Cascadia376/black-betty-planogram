import { describe, expect, it } from "vitest";
import { IDS, seedSnapshot } from "../../adapters/mock/seed";
import { assignmentMatchesFilters, productDetails, resetDateForAssignment } from "./allocationPlanner";

describe("allocation planner helpers", () => {
  const assignment = seedSnapshot.displayAssignments.find((item) => item.id === IDS.ondEndcapAEarlyAssignment)!;
  const products = seedSnapshot.displayAssignmentProducts.filter((item) => item.assignmentId === assignment.id);
  const empty = { storeId: "", periodId: "", displayType: "", supplierId: "", category: "", status: "" };

  it("filters assignments using display and supplier attributes", () => {
    expect(assignmentMatchesFilters(assignment, products, { ...empty, displayType: "endcap" }, seedSnapshot)).toBe(true);
    expect(assignmentMatchesFilters(assignment, products, { ...empty, displayType: "window" }, seedSnapshot)).toBe(false);
    expect(assignmentMatchesFilters(assignment, products, { ...empty, supplierId: IDS.ondPreferredSupplier }, seedSnapshot)).toBe(true);
  });

  it("provides supplier metadata and period reset dates", () => {
    expect(productDetails(products[0], seedSnapshot).supplierName).toBe("Mock Coastal Distribution");
    expect(productDetails(products[0], seedSnapshot)).toEqual(expect.objectContaining({ name: "Mock Harvest Red Feature", category: "Wine" }));
    expect(resetDateForAssignment(assignment, seedSnapshot)).toBe("2026-11-12");
  });
});
