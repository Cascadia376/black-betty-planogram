import type { DisplayAssignment, PlatformSnapshot } from "../../domain/types";

export type DisplayOrderStatus = "covered" | "order_required" | "at_risk" | "bridge_planned" | "exit_planned";

export const displayOrderStatusLabels: Record<DisplayOrderStatus, string> = {
  covered: "Covered",
  order_required: "Order required",
  at_risk: "At risk",
  bridge_planned: "Bridge planned",
  exit_planned: "Exit planned",
};

export function orderStatusForAssignment(assignment: DisplayAssignment, data: PlatformSnapshot): DisplayOrderStatus {
  const products = data.displayAssignmentProducts.filter((product) => product.assignmentId === assignment.id);
  if (products.length === 0 || products.some((product) => product.required && product.caseQuantity <= 0)) return "order_required";

  const productStatuses = products.map((product) => {
    const strategy = data.bridgeStrategies.find((item) => item.productId === product.productId);
    if (strategy?.eligibility === "no") return "exit_planned";
    const supplierCovered = Boolean(product.preferredSupplierId)
      || data.supplierProductOptions.some((option) => option.productId === product.productId && option.preferred);
    if (!supplierCovered) return "at_risk";
    if (strategy?.eligibility === "yes") return "bridge_planned";
    return "covered";
  });

  if (productStatuses.includes("exit_planned")) return "exit_planned";
  if (productStatuses.includes("at_risk")) return "at_risk";
  if (productStatuses.includes("bridge_planned")) return "bridge_planned";
  return "covered";
}
