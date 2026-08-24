import { describe, expect, it } from "vitest";
import { IDS, seedSnapshot } from "../../adapters/mock/seed";
import { orderStatusForAssignment } from "./programSchedule";

describe("OND display order statuses", () => {
  const assignment = (id: string) => seedSnapshot.displayAssignments.find((item) => item.id === id)!;

  it("reports bridge, exit, and supplier risk decisions from synthetic data", () => {
    expect(orderStatusForAssignment(assignment(IDS.ondEndcapAEarlyAssignment), seedSnapshot)).toBe("bridge_planned");
    expect(orderStatusForAssignment(assignment(IDS.ondEndcapAHolidayAssignment), seedSnapshot)).toBe("exit_planned");
    expect(orderStatusForAssignment(assignment(IDS.ondCoolerAssignment), seedSnapshot)).toBe("at_risk");
  });

  it("reports covered and incomplete opening fills without forecasting", () => {
    const early = assignment(IDS.ondEndcapAEarlyAssignment);
    const coveredSnapshot = {
      ...seedSnapshot,
      displayAssignmentProducts: seedSnapshot.displayAssignmentProducts.filter(
        (product) => product.assignmentId !== early.id || product.productId === IDS.ondHarvestProduct,
      ),
    };
    const incompleteSnapshot = {
      ...coveredSnapshot,
      displayAssignmentProducts: coveredSnapshot.displayAssignmentProducts.map(
        (product) => product.assignmentId === early.id ? { ...product, caseQuantity: 0 } : product,
      ),
    };
    expect(orderStatusForAssignment(early, coveredSnapshot)).toBe("covered");
    expect(orderStatusForAssignment(early, incompleteSnapshot)).toBe("order_required");
  });
});
