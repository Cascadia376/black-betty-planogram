import { buildPlacements, normalizeDisplayCode, type FlyerWorkbookImportResult } from "./FlyerWorkbookImportAdapter";
import type { PlatformSnapshot, Product } from "../../domain/types";

type Snapshot = Pick<PlatformSnapshot, "stores" | "displayAreas">;
type Decision = { kind: "display"; code?: string } | { kind: "product"; product: Product };
const skuIssues = ["unmatched_sku", "inactive_sku", "ambiguous_product_master_sku", "missing_sku", "tbd_sku", "compound_sku", "duplicate_sku"];

/** Applies only an explicit reviewed decision; never changes original workbook evidence or quantities. */
export function resolveWorkbookRow(result: FlyerWorkbookImportResult, rowNumber: number, decision: Decision, snapshot: Snapshot): FlyerWorkbookImportResult {
  const original = result.rows.find((row) => row.rowNumber === rowNumber);
  if (!original) throw new Error("Source row not found.");
  const row = structuredClone(original);
  row.source.originalIssues ??= [...row.source.issues];
  if (decision.kind === "display") {
    const code = decision.code ? normalizeDisplayCode(decision.code, snapshot.displayAreas) : undefined;
    if (decision.code && !code) throw new Error("Enter a recognized cross-store display code, such as W8 or BR2.");
    row.displayLocalCode = code; row.displayRequired = Boolean(code);
    row.source.reviewedDisplay = { code, required: Boolean(code) };
    row.issues = row.issues.filter((item) => !["invalid_display_code", "display_code_missing", "conflicting_display_codes"].includes(item.code));
  } else {
    if (!decision.product.active) throw new Error("Inactive products cannot be approved.");
    if (result.rows.some((item) => item.rowNumber !== rowNumber && item.status === "ready" && item.sku === decision.product.sku)) throw new Error("This exact SKU is already approved on another workbook row. Correct the duplicate allocation in the source workbook.");
    row.product = decision.product; row.sku = decision.product.sku; row.productName = decision.product.name;
    row.source.reviewedSku = decision.product.sku;
    row.issues = row.issues.filter((item) => !skuIssues.includes(item.code));
  }
  row.source.issues = row.issues.map((item) => item.code);
  row.status = row.issues.some((item) => item.code === "inactive_sku") ? "inactive" : row.issues.some((item) => skuIssues.includes(item.code)) ? "unmatched" : row.issues.some((item) => item.severity === "error") || !row.product ? "invalid" : "ready";
  const rows = result.rows.map((item) => item.rowNumber === rowNumber ? row : item);
  const placements = buildPlacements(rows.filter((item) => item.status === "ready"), snapshot.stores, snapshot.displayAreas);
  const placementIssues = placements.filter((item) => ["SUGGESTED", "NEEDS_REVIEW"].includes(item.status)).map((item) => ({ row: 0, field: `${item.store.name} / ${item.displayLocalCode}`, code: "placement_exception", message: item.reasons.join(" "), severity: "warning" as const }));
  return { ...result, rows, placements, issues: [...result.issues.filter((item) => item.row !== rowNumber && item.code !== "placement_exception"), ...row.issues, ...placementIssues] };
}
