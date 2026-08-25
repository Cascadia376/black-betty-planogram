import type { ComplianceCheck, PlatformSnapshot } from "../../domain/types";
import { productDetails } from "../programs/allocationPlanner";

export function getExecutionContext(data: PlatformSnapshot, executionId: string) {
  const execution = data.executions.find((item) => item.id === executionId);
  const campaignAssignment = data.assignments.find((item) => item.id === execution?.assignmentId);
  const campaign = data.campaigns.find((item) => item.id === campaignAssignment?.campaignId);
  const displayAssignment = data.displayAssignments.find((item) => item.id === execution?.displayAssignmentId);
  const area = data.displayAreas.find((item) => item.id === (displayAssignment?.displayAreaId ?? campaignAssignment?.displayAreaId));
  const program = data.programs.find((item) => item.id === displayAssignment?.programId);
  const period = data.programPeriods.find((item) => item.id === displayAssignment?.periodId);
  const assignmentProducts = data.displayAssignmentProducts.filter((item) => item.assignmentId === displayAssignment?.id);
  const title = campaign?.name ?? (program && area ? `${program.name} · Display ${area.displayNumber} ${execution?.taskType === "reset" ? "reset" : "set"}` : "Display execution");
  const requirement = campaign?.requirement ?? {
    signage: "Use the approved program signage recorded for this assignment.",
    minimumSpace: area?.capacity ?? "Use the assigned persistent display area.",
    executionNotes: displayAssignment?.notes ?? "Follow the published display assignment.",
  };

  const products = assignmentProducts.length ? assignmentProducts.map((product) => {
    const details = productDetails(product, data);
    const inventory = data.inventoryPositions.find((item) => item.storeId === displayAssignment?.storeId && item.productId === product.productId);
    const inbound = data.inboundOrders.filter((item) => item.storeId === displayAssignment?.storeId && item.productId === product.productId && ["submitted", "confirmed"].includes(item.status));
    const supplier = data.supplierProductOptions.find((item) => item.productId === product.productId && item.supplierId === product.preferredSupplierId)
      ?? data.supplierProductOptions.find((item) => item.productId === product.productId && item.preferred);
    return {
      id: product.id,
      sku: product.sku,
      name: details.name,
      required: product.required,
      plannedQuantity: `${product.caseQuantity} cases`,
      placement: product.minimumFacings ? `Minimum ${product.minimumFacings} facings` : product.required ? "Required in display" : "Recommended placement",
      note: product.note,
      onHandCases: inventory?.onHandCases,
      inboundCases: inbound.reduce((sum, item) => sum + item.cases, 0),
      nextArrival: inbound.map((item) => item.expectedArrivalDate).sort()[0],
      supplierName: supplier?.supplierName ?? details.supplierName,
    };
  }) : (campaign?.products ?? []).map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    required: product.required,
    plannedQuantity: `${product.minimumQuantity} units`,
    placement: `${product.minimumFacings} facings · ${product.role}`,
    note: undefined,
    onHandCases: undefined,
    inboundCases: 0,
    nextArrival: undefined,
    supplierName: campaign?.supplier ?? "Not specified",
  }));

  return { execution, campaignAssignment, campaign, displayAssignment, area, program, period, products, title, requirement };
}

export function buildAssignmentComplianceChecks(requiredSkus: string[], unavailableSkus: string[], substitutionRequested: boolean): ComplianceCheck[] {
  const requiredUnavailable = requiredSkus.some((sku) => unavailableSkus.includes(sku));
  return [
    { key: "display", label: "Correct persistent display used", passed: true, required: true },
    { key: "products", label: "Required assignment products present", passed: !requiredUnavailable, required: true },
    { key: "signage", label: "Required signage present", passed: true, required: true },
    { key: "merchandising", label: "Minimum merchandising requirement met", passed: true, required: true },
    { key: "substitutions", label: "Only approved substitutions used", passed: !substitutionRequested, required: true },
    { key: "stock_gaps", label: "No major execution-time stock gaps", passed: !requiredUnavailable, required: true },
  ];
}
