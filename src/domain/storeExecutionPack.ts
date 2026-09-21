import type { CampaignDisplayAssignment, CampaignImportRowMetadata, DisplayArea, PlatformSnapshot } from "./types";

export const executionMonths = ["OCT", "NOV", "DEC"] as const;
export type ExecutionMonth = typeof executionMonths[number];
export type ExecutionExceptionKind = "Missing display code" | "Suggested alternative requiring approval" | "Missing store display" | "Unmatched SKU" | "Inactive SKU" | "Source row requires correction" | "Execution details missing";

export interface ExecutionException {
  id: string;
  kind: ExecutionExceptionKind;
  message: string;
  action: string;
  assignment?: CampaignDisplayAssignment;
  campaignProductId?: string;
}

export interface ExecutionProduct {
  id: string;
  name: string;
  sku: string;
  cases?: number;
  notes: string;
  category: string;
  minimumFacings?: number;
  role?: string;
  productResolution?: "MATCHED_ACTIVE" | "MATCHED_INACTIVE" | "PENDING" | "INVALID";
}

export interface MonthlyOrderProduct extends ExecutionProduct {
  displayContext: string;
}

export const executionGroups = ["Beer/RTD", "Wine", "Spirits", "Category requires review"] as const;
export type ExecutionGroup = typeof executionGroups[number];

export function executionGroup(category: string): ExecutionGroup {
  if (/wine/i.test(category)) return "Wine";
  if (/beer|rtd|cider|ready.to.drink|cooler/i.test(category)) return "Beer/RTD";
  if (/spirit|liqueur|whisk|vodka|gin\b|rum\b|tequila|brandy|cognac/i.test(category)) return "Spirits";
  return "Category requires review";
}

/** One physical store display plan for the full campaign period. */
export function buildStoreDisplayPlan(data: PlatformSnapshot, campaignId: string, storeId: string) {
  const campaign = data.campaigns.find((item) => item.id === campaignId);
  const store = data.stores.find((item) => item.id === storeId);
  if (!campaign || !store || !isParticipatingStore(data, campaignId, storeId)) return undefined;

  const imports = data.campaignImports.filter((item) => item.campaignId === campaignId);
  const sourceRows = imports.flatMap((item) => item.rows);
  const allocations = data.campaignStoreProductAllocations.filter((item) => item.campaignId === campaignId && item.storeId === storeId);
  const assignments = data.campaignDisplayAssignments.filter((item) => item.campaignId === campaignId && item.storeId === storeId);
  const exceptions: ExecutionException[] = [];
  const shelf: ExecutionProduct[] = [];
  const sourceForProduct = (productId: string) => findSourceRow(data, sourceRows, productId, storeId, campaignId);
  const productLine = (productId: string, cases?: number, note?: string, displayNote?: string): ExecutionProduct => {
    const product = data.products.find((item) => item.id === productId);
    const campaignProduct = campaign.products.find((item) => item.productId === productId);
    const source = sourceForProduct(productId);
    const reviewedDisplay = source?.reviewedDisplay
      ? source.reviewedDisplay.required ? `Buyer approved display code ${source.reviewedDisplay.code}.` : "Buyer approved shelf support."
      : undefined;
    return {
      id: productId,
      name: product?.name ?? "Unknown product",
      sku: product?.sku?.trim() || "SKU NOT CONFIRMED",
      cases,
      category: product?.category ?? "",
      productResolution: !product || product.masterStatus === "unresolved" ? "INVALID" : product.masterStatus === "pending" ? "PENDING" : !product.active ? "MATCHED_INACTIVE" : campaignProduct?.productResolution ?? "MATCHED_ACTIVE",
      notes: [note, displayNote, source?.additionalNotes, reviewedDisplay].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(" · "),
    };
  };

  const builds: Array<{ id: string; area: DisplayArea; code: string; name: string; displayName: string; startDate: string; endDate: string; rotatingFlyerSlot: boolean; signage: string; notes: string; products: ExecutionProduct[] }> = [];
  for (const display of data.campaignDisplays.filter((item) => item.campaignId === campaignId).sort((a, b) => a.sortOrder - b.sortOrder)) {
    const assignment = assignments.find((item) => item.campaignDisplayId === display.id);
    const area = data.displayAreas.find((item) => item.id === assignment?.displayAreaId && item.storeId === storeId && item.active);
    const members = data.campaignDisplayProducts.filter((item) => item.campaignDisplayId === display.id);
    const memberIds = new Set(members.map((item) => item.id));
    const displayHasStoreProducts = members.some((item) => allocations.some((allocation) => allocation.campaignProductId === item.campaignProductId));
    if (imports.length && !displayHasStoreProducts && !assignment) continue;
    const products = assignment
      ? data.campaignDisplayAssignmentProducts
        .filter((item) => item.campaignDisplayAssignmentId === assignment.id && memberIds.has(item.campaignDisplayProductId) && item.caseQuantity !== 0)
        .map((item) => {
          const member = members.find((candidate) => candidate.id === item.campaignDisplayProductId);
          return { ...productLine(item.productId, item.caseQuantity, item.note, member?.note), minimumFacings: member?.minimumFacings, role: member?.role };
        })
      : [];
    if (assignment?.status === "EXCLUDED") {
      shelf.push(...products.map((item) => ({ ...item, notes: ["No display in this store; shelf support approved.", assignment.note, item.notes].filter(Boolean).join(" ") })));
      continue;
    }
    if (!assignment || assignment.status !== "ASSIGNED" || !area) {
      exceptions.push({
        id: assignment?.id ?? display.id,
        kind: assignment?.status === "SUGGESTED" ? "Suggested alternative requiring approval" : "Missing store display",
        message: `${display.sourceLocalCode ?? display.name}: ${products.map((item) => `${item.sku} ${item.name} (${item.cases ?? "unresolved"} cases)`).join(", ") || "No approved placement"}`,
        action: "Approve a suggested area, choose another permanent area, or explicitly approve shelf support for this store.",
        assignment,
      });
      continue;
    }
    builds.push({
      id: assignment.id,
      area,
      code: area.localCode ?? area.displayNumber,
      name: area.name,
      displayName: display.name,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      rotatingFlyerSlot: Boolean(display.rotatingFlyerSlot),
      signage: display.signage ?? "Not specified — confirm signage before setup",
      notes: [assignment.executionNotes, display.executionNotes, assignment.note].filter(Boolean).join(" · ") || "No additional execution notes supplied.",
      products,
    });
    const missingRequired = members.some((member) => member.required && !data.campaignDisplayAssignmentProducts.some((item) => item.campaignDisplayAssignmentId === assignment.id && item.campaignDisplayProductId === member.id));
    const invalidProducts = products.some((item) => item.productResolution !== "MATCHED_ACTIVE");
    if (missingRequired || invalidProducts || !products.length || products.some((item) => item.cases === undefined || executionGroup(item.category) === "Category requires review") || !display.signage || area.verificationStatus !== "verified" || assignment.hasConflictingExecutionNotes) {
      exceptions.push({
        id: `${assignment.id}-details`,
        kind: "Execution details missing",
        message: `${display.name}: confirm ${[
          display.rotatingFlyerSlot && !products.length ? "the current flyer SKU list for this rotating display" : !products.length ? "products" : "",
          missingRequired ? "missing required product allocation" : "",
          invalidProducts ? "unconfirmed or inactive Product Master records" : "",
          products.some((item) => item.cases === undefined) ? "store cases" : "",
          !display.signage ? "signage" : "",
          area.verificationStatus !== "verified" ? "area verification" : "",
          assignment.hasConflictingExecutionNotes ? "conflicting display notes" : "",
          products.some((item) => executionGroup(item.category) === "Category requires review") ? "product category" : "",
        ].filter(Boolean).join(", ")}.`,
        action: "Review display instructions and store quantities before handing this plan to the store.",
        assignment,
      });
    }
  }

  for (const allocation of allocations) {
    const member = data.campaignDisplayProducts.find((item) => item.campaignProductId === allocation.campaignProductId);
    const campaignProduct = campaign.products.find((item) => item.id === allocation.campaignProductId);
    if (campaignProduct?.merchandisingState === "SHELF_SUPPORTED" || !allocation.displayRequired) {
      shelf.push(productLine(allocation.productId, allocation.caseQuantity));
    } else if (!member) {
      const item = productLine(allocation.productId, allocation.caseQuantity);
      exceptions.push({
        id: allocation.id,
        kind: "Missing display code",
        message: `${item.sku} · ${item.name} · ${item.cases} cases: display required, no campaign display selected.`,
        action: "Choose a campaign display on Products/Displays or explicitly mark this product shelf support.",
        campaignProductId: allocation.campaignProductId,
      });
    }
  }

  for (const item of campaign.products.filter((product) => product.merchandisingState === "SHELF_SUPPORTED")) {
    if (!allocations.some((allocation) => allocation.campaignProductId === item.id)) {
      shelf.push(productLine(item.productId, undefined, item.note));
      exceptions.push({ id: `shelf-${item.id}`, kind: "Execution details missing", message: `${data.products.find((product) => product.id === item.productId)?.name ?? "Shelf product"}: store case guidance is not supplied.`, action: "Confirm store-specific shelf support quantities with the buyer; no quantity has been assumed.", campaignProductId: item.id });
    }
  }

  for (const [index, row] of sourceRows.entries()) {
    if (row.allocations.length && !row.allocations.some((item) => item.storeId === storeId)) continue;
    const kind = row.issues.includes("inactive_sku") ? "Inactive SKU"
      : row.issues.some((item) => ["unmatched_sku", "ambiguous_product_master_sku", "missing_sku", "tbd_sku", "compound_sku"].includes(item)) ? "Unmatched SKU"
        : row.issues.some((item) => ["duplicate_sku", "invalid_case_quantity"].includes(item)) ? "Source row requires correction" : undefined;
    if (kind) exceptions.push({
      id: `source-${index}`,
      kind,
      message: `${row.sourceSheet} row ${row.sourceRow}: ${row.skuRaw || "No SKU"} · ${row.productName} · ${row.allocations.find((item) => item.storeId === storeId)?.quantityCases ?? "unresolved"} cases. Not imported from this row.`,
      action: "Confirm the exact active SKU/quantity with the source owner, correct the consolidated workbook and import a new draft. Do not substitute by name.",
    });
  }

  const layout = data.storeLayouts.find((item) => item.storeId === storeId && item.status === "current");
  if (!layout?.backgroundImageUrl) exceptions.push({ id: "map", kind: "Execution details missing", message: "No current source floor map is available.", action: "Ask the floorplan owner for a verified map before store execution." });
  return {
    campaign,
    store,
    layout,
    builds,
    shelf: [...new Map(shelf.map((item) => [item.id, item])).values()],
    exceptions,
    sources: imports.map((item) => item.sourceFileName),
  };
}

/** Promotional case intent for one LTO month; it never changes display placement. */
export function buildMonthlyOrderPlan(data: PlatformSnapshot, campaignId: string, storeId: string, month: ExecutionMonth) {
  const campaign = data.campaigns.find((item) => item.id === campaignId);
  const store = data.stores.find((item) => item.id === storeId);
  if (!campaign || !store || !isParticipatingStore(data, campaignId, storeId)) return undefined;
  const imports = data.campaignImports.filter((item) => item.campaignId === campaignId);
  const sourceRows = imports.flatMap((item) => item.rows);
  const products: MonthlyOrderProduct[] = [];

  for (const allocation of data.campaignStoreProductAllocations.filter((item) => item.campaignId === campaignId && item.storeId === storeId)) {
    const product = data.products.find((item) => item.id === allocation.productId);
    const source = findSourceRow(data, sourceRows, allocation.productId, storeId, campaignId);
    if (!source?.ltoMonths?.includes(month)) continue;
    const member = data.campaignDisplayProducts.find((item) => item.campaignProductId === allocation.campaignProductId);
    const display = member && data.campaignDisplays.find((item) => item.id === member.campaignDisplayId);
    const assignment = display && data.campaignDisplayAssignments.find((item) => item.campaignDisplayId === display.id && item.storeId === storeId);
    const area = assignment?.displayAreaId ? data.displayAreas.find((item) => item.id === assignment.displayAreaId) : undefined;
    const displayContext = allocation.displayRequired
      ? area ? `${area.localCode ?? area.displayNumber} · ${area.name}` : `${display?.sourceLocalCode ?? display?.name ?? "Display"} · placement unresolved`
      : "Shelf support / no promotional display required";
    products.push({
      id: allocation.id,
      name: product?.name ?? source.productName,
      sku: product?.sku ?? source.skuRaw,
      cases: allocation.caseQuantity,
      category: product?.category ?? source.category ?? "",
      notes: source.additionalNotes ?? "",
      displayContext,
    });
  }
  return { campaign, store, month, products, sources: imports.map((item) => item.sourceFileName) };
}

/** Compatibility projection used by the route: display plan is stable; only orderPlan is monthly. */
export function buildStoreExecutionPack(data: PlatformSnapshot, campaignId: string, storeId: string, month?: ExecutionMonth) {
  const displayPlan = buildStoreDisplayPlan(data, campaignId, storeId);
  if (!displayPlan) return undefined;
  return { ...displayPlan, month, orderPlan: month ? buildMonthlyOrderPlan(data, campaignId, storeId, month) : undefined };
}

function isParticipatingStore(data: PlatformSnapshot, campaignId: string, storeId: string) {
  return data.campaignStores.some((item) => item.campaignId === campaignId && item.storeId === storeId && item.included);
}

function findSourceRow(data: PlatformSnapshot, rows: CampaignImportRowMetadata[], productId: string, storeId: string, campaignId: string) {
  const product = data.products.find((item) => item.id === productId);
  const pending = data.campaigns.find((campaign) => campaign.id === campaignId)?.products.find((item) => item.productId === productId)?.pendingSource;
  const sku = product?.sku.trim().toUpperCase();
  const candidates = sku
    ? rows.filter((row) => (row.reviewedSku ?? row.skuRaw).trim().toUpperCase() === sku)
    : pending ? data.campaignImports.filter((item) => item.campaignId === campaignId && item.sourceFileName === pending.workbook).flatMap((item) => item.rows).filter((row) => row.sourceSheet === pending.sheet && row.sourceRow === pending.row && row.productName === pending.productName) : [];
  // Newer applied workbooks take precedence, but another store's row never does.
  return candidates.slice().reverse().find((row) => row.allocations.some((allocation) => allocation.storeId === storeId))
    ?? candidates.slice().reverse().find((row) => row.allocations.length === 0);
}
