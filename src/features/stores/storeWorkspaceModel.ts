import type { PlatformSnapshot } from "../../domain/types";
import { ondDemandPhaseForDate } from "../../services/demand/RuleBasedOndDemandService";
import { mockBusinessClock } from "../../services/clock";
import { buildOrderWorkspaceItems } from "../orders/orderingWorkspace";

function firstChristmasAccelerationDate(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return undefined;
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    if (ondDemandPhaseForDate(date) === "christmas_acceleration") return date;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return undefined;
}

export function buildStoreWorkspaceModel(data: PlatformSnapshot, storeId: string, asOfDate = mockBusinessClock.today()) {
  const program = data.programs.find((item) =>
    data.displayAssignments.some((assignment) => assignment.programId === item.id && assignment.storeId === storeId),
  );
  const assignments = data.displayAssignments.filter((item) => item.storeId === storeId && item.programId === program?.id);
  const executions = data.executions.filter((execution) =>
    data.displayAssignments.some((assignment) => assignment.id === execution.displayAssignmentId && assignment.storeId === storeId)
    || data.assignments.some((assignment) => assignment.id === execution.assignmentId && assignment.storeId === storeId),
  );
  const orders = buildOrderWorkspaceItems(data, storeId, program?.id);
  const activeOrders = orders.filter((item) => !["dismissed", "ordered"].includes(item.recommendation.status));
  const openingFills = activeOrders.filter((item) =>
    item.recommendation.recommendationType === "opening_fill"
    && item.recommendation.requiredByDate > asOfDate,
  );

  return {
    program,
    assignments,
    executions,
    orders,
    majorDemandPhaseStart: firstChristmasAccelerationDate(program?.startDate, program?.endDate),
    attention: {
      displaysToSet: new Set(assignments.map((item) => item.displayAreaId)).size,
      resetsDue: assignments.filter((item) => item.resetRequired).length,
      overdueTasks: executions.filter((item) => item.status !== "completed" && item.dueDate < asOfDate).length,
      issues: executions.filter((item) => item.status === "issue").length,
      ordersRequiredToday: activeOrders.filter((item) => item.group === "order_today").length,
      productsAtRisk: activeOrders.filter((item) => item.group === "at_risk").length,
      upcomingOpeningFills: openingFills.length,
      bridgeActions: activeOrders.filter((item) => item.group === "intentional_bridge").length,
      exitRiskProducts: activeOrders.filter((item) => item.group === "potential_residual").length,
    },
  };
}
