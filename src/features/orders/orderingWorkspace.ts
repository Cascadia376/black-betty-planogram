import { selectSupplierForRequiredDate } from "../../domain/ordering";
import type { OrderRecommendation, PlatformSnapshot } from "../../domain/types";
import { calculateResidualInventory, type ResidualInventoryProjection } from "../../services/orders/ResidualInventoryService";

export type OrderWorkspaceGroup = "order_today" | "at_risk" | "covered" | "arriving_soon" | "potential_residual" | "intentional_bridge";

export interface OrderWorkspaceItem {
  recommendation: OrderRecommendation;
  group: OrderWorkspaceGroup;
  assignment: PlatformSnapshot["displayAssignments"][number] | undefined;
  assignmentProduct: PlatformSnapshot["displayAssignmentProducts"][number] | undefined;
  area: PlatformSnapshot["displayAreas"][number] | undefined;
  onHandCases: number;
  reservedCases: number;
  onOrderCases: number;
  supplierName: string;
  residualProjection?: ResidualInventoryProjection;
}

function groupFor(recommendation: OrderRecommendation, supplierAvailable: boolean, onOrderCases: number): OrderWorkspaceGroup {
  if (recommendation.recommendationType === "bridge_buy") return "intentional_bridge";
  if (recommendation.recommendationType === "exit_control") return "potential_residual";
  if (recommendation.status === "ordered" || (onOrderCases > 0 && recommendation.recommendedCases === 0)) return "arriving_soon";
  if (recommendation.recommendedCases === 0) return "covered";
  if (!supplierAvailable) return "at_risk";
  return "order_today";
}

export function buildOrderWorkspaceItems(data: PlatformSnapshot, storeId: string, programId?: string): OrderWorkspaceItem[] {
  return data.orderRecommendations.filter((recommendation) => recommendation.storeId === storeId).flatMap((recommendation) => {
    const assignment = data.displayAssignments.find((item) => item.id === recommendation.displayAssignmentId);
    if (programId && assignment?.programId !== programId) return [];
    const assignmentProduct = data.displayAssignmentProducts.find((product) => product.assignmentId === assignment?.id && product.productId === recommendation.productId);
    const area = data.displayAreas.find((item) => item.id === assignment?.displayAreaId);
    const inventory = data.inventoryPositions.find((position) => position.storeId === storeId && position.productId === recommendation.productId);
    const inbound = data.inboundOrders.filter((order) => order.storeId === storeId && order.productId === recommendation.productId && ["submitted", "confirmed"].includes(order.status));
    const onOrderCases = inbound.reduce((total, order) => total + order.cases, 0);
    const selection = selectSupplierForRequiredDate(recommendation.productId, data.supplierProductOptions, recommendation.recommendationDate, recommendation.requiredByDate);
    const supplier = data.suppliers.find((item) => item.id === recommendation.supplierId);
    const strategy = data.bridgeStrategies.find((item) => item.productId === recommendation.productId);
    const residualInput = data.residualDemandInputs.find((item) => item.storeId === storeId && item.productId === recommendation.productId);
    const residualProjection = strategy && residualInput ? calculateResidualInventory(strategy, residualInput) : undefined;
    return [{ recommendation, assignment, assignmentProduct, area, onHandCases: inventory?.onHandCases ?? 0, reservedCases: inventory?.reservedCases ?? 0, onOrderCases, supplierName: selection?.option.supplierName ?? supplier?.name ?? "Supplier review required", residualProjection, group: groupFor(recommendation, selection?.canMeetRequiredDate === true, onOrderCases) }];
  });
}
