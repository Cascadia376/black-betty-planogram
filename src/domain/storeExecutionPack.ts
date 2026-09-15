import type { CampaignDisplayAssignment, DisplayArea, PlatformSnapshot } from "./types";

export const executionMonths = ["OCT", "NOV", "DEC"] as const;
export type ExecutionMonth = typeof executionMonths[number];
export type ExecutionExceptionKind = "Missing display code" | "Suggested alternative requiring approval" | "Missing store display" | "Unmatched SKU" | "Inactive SKU" | "Source row requires correction" | "Execution details missing";
export interface ExecutionException {
  id: string; kind: ExecutionExceptionKind; message: string; action: string;
  assignment?: CampaignDisplayAssignment; campaignProductId?: string;
}
export interface ExecutionProduct {
  id: string; name: string; sku: string; cases?: number; notes: string; category: string;
}
export const executionGroups = ["Beer/RTD", "Wine", "Spirits", "Category requires review"] as const;
export type ExecutionGroup = typeof executionGroups[number];
export function executionGroup(category: string): ExecutionGroup {
  if (/wine/i.test(category)) return "Wine";
  if (/beer|rtd|cider|ready.to.drink|cooler/i.test(category)) return "Beer/RTD";
  if (/spirit|liqueur|whisk|vodka|gin\b|rum\b|tequila|brandy|cognac/i.test(category)) return "Spirits";
  return "Category requires review";
}

/** A read-only projection: store quantities are never inferred from campaign defaults. */
export function buildStoreExecutionPack(data: PlatformSnapshot, campaignId: string, storeId: string, month?: ExecutionMonth) {
  const campaign = data.campaigns.find((item) => item.id === campaignId);
  const store = data.stores.find((item) => item.id === storeId);
  if (!campaign || !store || !data.campaignStores.some((item) => item.campaignId === campaignId && item.storeId === storeId && item.included)) return undefined;
  const imports = data.campaignImports.filter((item) => item.campaignId === campaignId);
  const sourceRows = imports.flatMap((item) => item.rows);
  const allocations = data.campaignStoreProductAllocations.filter((item) => item.campaignId === campaignId && item.storeId === storeId);
  const assignments = data.campaignDisplayAssignments.filter((item) => item.campaignId === campaignId && item.storeId === storeId);
  const exceptions: ExecutionException[] = [];
  const shelf: ExecutionProduct[] = [];
  const sourceForProduct = (productId: string) => {
    const product = data.products.find((item) => item.id === productId);
    return sourceRows.find((item) => (item.reviewedSku ?? item.skuRaw).trim().toUpperCase() === product?.sku.trim().toUpperCase());
  };
  const productInMonth = (productId: string) => rowInMonth(sourceForProduct(productId), month);
  const productLine = (productId: string, cases?: number, note?: string): ExecutionProduct => {
    const product = data.products.find((item) => item.id === productId);
    const source = sourceForProduct(productId);
    const reviewedDisplay = source?.reviewedDisplay ? source.reviewedDisplay.required ? `Buyer approved display code ${source.reviewedDisplay.code}.` : "Buyer approved shelf support." : undefined;
    return { id: productId, name: product?.name ?? "Unknown product", sku: product?.sku ?? "Unknown SKU", cases,
      category: product?.category ?? "", notes: [note, source?.additionalNotes, reviewedDisplay].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(" · ") };
  };
  const builds: Array<{ id: string; area: DisplayArea; code: string; name: string; signage: string; notes: string; products: ExecutionProduct[] }> = [];
  for (const display of data.campaignDisplays.filter((item) => item.campaignId === campaignId).sort((a, b) => a.sortOrder - b.sortOrder)) {
    const assignment = assignments.find((item) => item.campaignDisplayId === display.id);
    const area = data.displayAreas.find((item) => item.id === assignment?.displayAreaId && item.storeId === storeId && item.active);
    const memberIds = new Set(data.campaignDisplayProducts.filter((item) => item.campaignDisplayId === display.id).map((item) => item.id));
    const displayHasStoreProducts = data.campaignDisplayProducts.some((item) => memberIds.has(item.id) && productInMonth(item.productId) && allocations.some((allocation) => allocation.campaignProductId === item.campaignProductId));
    if (imports.length && !displayHasStoreProducts) continue;
    const products = assignment ? data.campaignDisplayAssignmentProducts.filter((item) => item.campaignDisplayAssignmentId === assignment.id && memberIds.has(item.campaignDisplayProductId) && item.caseQuantity !== 0 && productInMonth(item.productId)).map((item) => productLine(item.productId, item.caseQuantity, item.note)) : [];
    if (month && assignment?.status === "ASSIGNED" && !products.length) continue;
    if (assignment?.status === "EXCLUDED") {
      shelf.push(...products.map((item) => ({ ...item, notes: ["No display in this store; shelf support approved.", assignment.note, item.notes].filter(Boolean).join(" ") })));
      continue;
    }
    if (!assignment || assignment.status !== "ASSIGNED" || !area) {
      exceptions.push({ id: assignment?.id ?? display.id, kind: assignment?.status === "SUGGESTED" ? "Suggested alternative requiring approval" : "Missing store display",
        message: `${display.sourceLocalCode ?? display.name}: ${products.map((item) => `${item.sku} ${item.name} (${item.cases ?? "unresolved"} cases)`).join(", ") || "No approved placement"}`,
        action: "Approve a suggested area, choose another permanent area, or explicitly approve shelf support for this store.", assignment });
      continue;
    }
    builds.push({ id: assignment.id, area, code: area.localCode ?? area.displayNumber, name: area.name, signage: display.signage ?? "Not specified — confirm signage before setup", notes: [display.executionNotes, assignment.note].filter(Boolean).join(" · ") || "No additional execution notes supplied.", products });
    if (!products.length || products.some((item) => item.cases === undefined || executionGroup(item.category) === "Category requires review") || !display.signage || area.verificationStatus !== "verified") {
      exceptions.push({ id: `${assignment.id}-details`, kind: "Execution details missing", message: `${display.name}: confirm ${[!products.length ? "products" : "", products.some((item) => item.cases === undefined) ? "store cases" : "", !display.signage ? "signage" : "", area.verificationStatus !== "verified" ? "area verification" : "", products.some((item) => executionGroup(item.category) === "Category requires review") ? "product category" : ""].filter(Boolean).join(", ")}.`, action: "Review display instructions and store quantities before handing this pack to the store.", assignment });
    }
  }
  for (const allocation of allocations) {
    if (!productInMonth(allocation.productId)) continue;
    const member = data.campaignDisplayProducts.find((item) => item.campaignProductId === allocation.campaignProductId);
    const campaignProduct = campaign.products.find((item) => item.id === allocation.campaignProductId);
    if (campaignProduct?.merchandisingState === "SHELF_SUPPORTED" || !allocation.displayRequired) {
      shelf.push(productLine(allocation.productId, allocation.caseQuantity));
    } else if (!member) {
      const item = productLine(allocation.productId, allocation.caseQuantity);
      exceptions.push({ id: allocation.id, kind: "Missing display code", message: `${item.sku} · ${item.name} · ${item.cases} cases: display required, no campaign display selected.`, action: "Choose a campaign display on Products/Displays or explicitly mark this product shelf support.", campaignProductId: allocation.campaignProductId });
    }
  }
  for (const [index, row] of sourceRows.entries()) {
    if (!rowInMonth(row, month)) continue;
    if (row.allocations.length && !row.allocations.some((item) => item.storeId === storeId)) continue;
    const kind = row.issues.includes("inactive_sku") ? "Inactive SKU" : row.issues.some((item) => ["unmatched_sku", "ambiguous_product_master_sku", "missing_sku", "tbd_sku", "compound_sku"].includes(item)) ? "Unmatched SKU" : row.issues.some((item) => ["duplicate_sku", "invalid_case_quantity"].includes(item)) ? "Source row requires correction" : undefined;
    if (kind) exceptions.push({ id: `source-${index}`, kind, message: `${row.sourceSheet} row ${row.sourceRow}: ${row.skuRaw || "No SKU"} · ${row.productName} · ${row.allocations.find((item) => item.storeId === storeId)?.quantityCases ?? "unresolved"} cases. Not imported from this row.`, action: "Confirm the exact active SKU/quantity with the source owner, correct the consolidated workbook and import a new draft. Do not substitute by name." });
  }
  const layout = data.storeLayouts.find((item) => item.storeId === storeId && item.status === "current");
  if (!layout?.backgroundImageUrl) exceptions.push({ id: "map", kind: "Execution details missing", message: "No current source floor map is available.", action: "Ask the floorplan owner for a verified map before store execution." });
  return { campaign, store, layout, month, builds, shelf: [...new Map(shelf.map((item) => [item.id, item])).values()], exceptions, sources: imports.map((item) => item.sourceFileName) };
}

function rowInMonth(row: { flyerMonths?: string[] } | undefined, month?: ExecutionMonth) {
  if (!month) return true;
  return row?.flyerMonths?.includes(month) === true;
}
