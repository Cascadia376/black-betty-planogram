import type { Campaign, PlatformSnapshot, UUID } from "./types";
import { displayAssignmentsOverlap, isBusinessDate, validateCampaignDetails } from "./rules";

export type PublishReadinessSection = "CAMPAIGN" | "PRODUCTS" | "DISPLAYS" | "STORES" | "ORDERING";
export interface PublishReadinessIssue {
  severity: "BLOCKING" | "WARNING";
  section: PublishReadinessSection;
  code: string;
  message: string;
  storeId?: UUID;
  campaignDisplayId?: UUID;
  campaignDisplayAssignmentId?: UUID;
  displayAreaId?: UUID;
  productId?: UUID;
}
export interface CampaignPublishReadiness { state: "READY" | "WARNING" | "BLOCKED"; issues: PublishReadinessIssue[]; }

/** The release boundary is stricter than saving a draft. Never invent products or quantities. */
export function evaluateCampaignPublishReadiness(campaign: Campaign | undefined, data: PlatformSnapshot | undefined): CampaignPublishReadiness {
  const issues: PublishReadinessIssue[] = [];
  const add = (severity: PublishReadinessIssue["severity"], section: PublishReadinessSection, code: string, message: string, extra: Partial<PublishReadinessIssue> = {}) => issues.push({ severity, section, code, message, ...extra });
  if (!campaign || !data) return { state: "BLOCKED", issues: [{ severity: "BLOCKING", section: "CAMPAIGN", code: "CAMPAIGN_MISSING", message: "Campaign data is unavailable." }] };
  for (const message of validateCampaignDetails(campaign)) add("BLOCKING", "CAMPAIGN", "CAMPAIGN_METADATA", message);
  if (!campaign.supplier.trim()) add("WARNING", "CAMPAIGN", "SUPPLIER_MISSING", "Supplier / partner is not specified.");
  const scopes = data.campaignStores.filter((item) => item.campaignId === campaign.id && item.included);
  const includedStoreIds = new Set(scopes.map((scope) => scope.storeId));
  if (!scopes.length) add("BLOCKING", "STORES", "NO_STORES", "Include at least one participating store.");
  if (!campaign.products.length) add("BLOCKING", "PRODUCTS", "NO_PRODUCTS", "Add campaign products before release.");

  for (const item of campaign.products) {
    const product = data.products.find((candidate) => candidate.id === item.productId);
    if (!product || !product.sku.trim() || product.masterStatus === "unresolved" || item.productResolution === "INVALID") {
      add("BLOCKING", "PRODUCTS", "PRODUCT_INVALID", "A campaign product has no valid Product Master identity.", { productId: item.productId });
    } else if (product.masterStatus === "pending" || !product.active || item.productResolution === "PENDING" || item.productResolution === "MATCHED_INACTIVE") {
      add("BLOCKING", "PRODUCTS", "PRODUCT_REVIEW", `${product.name} needs an active, confirmed Product Master record before release. Draft planning is still saved.`, { productId: item.productId });
    }
    if (item.required && (item.merchandisingState ?? "UNASSIGNED") === "UNASSIGNED") {
      add("BLOCKING", "DISPLAYS", "REQUIRED_UNASSIGNED", "A required product has no merchandising decision.", { productId: item.productId });
    }
  }

  const displays = data.campaignDisplays.filter((item) => item.campaignId === campaign.id);
  const assignments = data.campaignDisplayAssignments.filter((item) => item.campaignId === campaign.id && includedStoreIds.has(item.storeId));
  for (const display of displays) {
    const members = data.campaignDisplayProducts.filter((item) => item.campaignDisplayId === display.id);
    if (!members.length) add("WARNING", "DISPLAYS", "EMPTY_DISPLAY", `${display.name} has no products.`, { campaignDisplayId: display.id });
    for (const member of members) {
      if (!campaign.products.some((product) => product.id === member.campaignProductId && product.productId === member.productId)) {
        add("BLOCKING", "DISPLAYS", "DISPLAY_PRODUCT_INVALID", "A display product relationship is invalid.", { campaignDisplayId: display.id, productId: member.productId });
      }
    }
    for (const scope of scopes) {
      const store = data.stores.find((item) => item.id === scope.storeId);
      const matches = assignments.filter((item) => item.storeId === scope.storeId && item.campaignDisplayId === display.id);
      const assignment = matches[0];
      const extra = { storeId: scope.storeId, campaignDisplayId: display.id, campaignDisplayAssignmentId: assignment?.id };
      const context = `${store?.name ?? "Unknown store"} / ${display.name}`;
      if (!store) add("BLOCKING", "STORES", "STORE_MISSING", "A participating store no longer exists.", extra);
      if (matches.length > 1) add("BLOCKING", "STORES", "DUPLICATE_PLACEMENT", `${context}: duplicate assignments must be reconciled.`, extra);
      if (!assignment || !["ASSIGNED", "EXCLUDED"].includes(assignment.status)) {
        add("BLOCKING", "STORES", "PLACEMENT_UNRESOLVED", `${context}: approve a placement or explicitly exclude this display.`, extra);
        continue;
      }
      if (assignment.status === "EXCLUDED") {
        add("WARNING", "STORES", "DISPLAY_EXCLUDED", `${context}: display excluded; confirm shelf-support instructions.`, extra);
        continue;
      }
      const area = data.displayAreas.find((item) => item.id === assignment.displayAreaId);
      if (!area || !area.active || area.storeId !== scope.storeId) add("BLOCKING", "STORES", "AREA_INVALID", `${context}: choose an active display area belonging to this store.`, extra);
      else if (area.verificationStatus !== "verified") add("WARNING", "STORES", "AREA_UNVERIFIED", `${context}: the physical location has not been verified.`, extra);
      if (!isBusinessDate(assignment.startDate) || !isBusinessDate(assignment.endDate) || assignment.endDate < assignment.startDate || assignment.startDate < campaign.startDate || assignment.endDate > campaign.endDate) {
        add("BLOCKING", "STORES", "ASSIGNMENT_DATES", `${context}: display dates must be valid and within the campaign period.`, extra);
      }
      if (assignment.hasConflictingExecutionNotes) add("BLOCKING", "STORES", "NOTES_CONFLICT", `${context}: resolve conflicting store instructions.`, extra);
      if (assignment.compatibility === "incompatible") add("BLOCKING", "STORES", "INCOMPATIBLE", `${context}: the selected area is incompatible with this display.`, extra);
      else if (assignment.compatibility === "review") add("WARNING", "STORES", "COMPATIBILITY_REVIEW", `${context}: confirm area compatibility.`, extra);
      if (!display.signage?.trim()) add("WARNING", "DISPLAYS", "SIGNAGE_MISSING", `${context}: confirm signage before setup.`, extra);
      if (!members.length) add("BLOCKING", "DISPLAYS", "BUILD_PRODUCTS_MISSING", `${context}: confirm the product list before releasing this build.`, extra);

      const quantities = data.campaignDisplayAssignmentProducts.filter((item) => item.campaignDisplayAssignmentId === assignment.id);
      for (const member of members) {
        const rows = quantities.filter((item) => item.campaignDisplayProductId === member.id && item.productId === member.productId);
        const cases = rows[0]?.caseQuantity;
        if (rows.length > 1) add("BLOCKING", "ORDERING", "DUPLICATE_QUANTITY", `${context}: duplicate product quantities must be reconciled.`, { ...extra, productId: member.productId });
        if (member.required && (cases === undefined || cases < 1)) add("BLOCKING", "ORDERING", "QUANTITY_MISSING", `${context}: a required product needs a final store case quantity of at least one.`, { ...extra, productId: member.productId });
        if (cases !== undefined && (!Number.isSafeInteger(cases) || cases < 0)) add("BLOCKING", "ORDERING", "QUANTITY_INVALID", `${context}: case quantities must be non-negative whole numbers.`, { ...extra, productId: member.productId });
        if (member.minimumFacings !== undefined && (!Number.isSafeInteger(member.minimumFacings) || member.minimumFacings < 0)) add("BLOCKING", "DISPLAYS", "FACINGS_INVALID", `${context}: minimum facings must be a non-negative whole number.`, extra);
      }
      for (const quantity of quantities) {
        if (!members.some((member) => member.id === quantity.campaignDisplayProductId && member.productId === quantity.productId)) add("BLOCKING", "ORDERING", "ORPHAN_QUANTITY", `${context}: a quantity references a product outside this display.`, extra);
      }
      if (assignment.displayAreaId) {
        const candidate = { displayAreaId: assignment.displayAreaId, startDate: assignment.startDate, endDate: assignment.endDate, status: "ready" as const };
        if (assignments.some((other) => other.id !== assignment.id && other.status === "ASSIGNED" && other.displayAreaId && displayAssignmentsOverlap(candidate, { ...other, displayAreaId: other.displayAreaId, status: "ready" })) || data.displayAssignments.some((other) => other.campaignDisplayAssignmentId !== assignment.id && displayAssignmentsOverlap(candidate, other))) {
          add("BLOCKING", "STORES", "AREA_OVERLAP", `${context}: this physical area is already planned for an overlapping display period.`, extra);
        }
      }
    }
  }
  return { state: issues.some((item) => item.severity === "BLOCKING") ? "BLOCKED" : issues.length ? "WARNING" : "READY", issues };
}
