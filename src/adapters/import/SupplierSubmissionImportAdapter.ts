import readXlsxFile, { readSheetNames } from "read-excel-file";
import type { ApplySupplierSubmissionImportInput } from "../../domain/repositories";
import type { DisplayFamily, Product, PromotionOpportunity, PromotionOpportunityStatus } from "../../domain/types";
import type { ImportAdapter, ImportIssue } from "../../services/imports/contracts";
import type { ProductMasterLookup } from "../../services/products/ProductMasterLookup";
import { normalizeProductSku } from "../../services/products/ProductMasterLookup";

export const SUPPLIER_SUBMISSION_FORMAT_ID = "supplier-submission-import-v1" as const;

const COLUMNS = {
  supplier: ["SUPPLIER"], supplierContact: ["SUPPLIER CONTACT", "CONTACT"], submittedAt: ["SUBMITTED AT", "SUBMISSION DATE"],
  sku: ["SKU", "INV NUM", "INV NUMBER", "INV_NUM"], product: ["PRODUCT", "PRODUCT NAME"],
  supplierDescription: ["SUPPLIER DESCRIPTION", "PRODUCT DESCRIPTION"], vendor: ["VENDOR"], category: ["CATEGORY"],
  start: ["PROMOTION START", "PROMO START"], end: ["PROMOTION END", "PROMO END"], lto: ["LTO", "LTO AMOUNT"],
  tpr: ["TPR"], proposedRetail: ["PROPOSED RETAIL", "RETAIL"], flyerMonth: ["FLYER MONTH", "FLYER REQUEST"],
  mechanic: ["PROMOTIONAL MECHANIC", "PROMOTION MECHANIC"], points: ["POINTS", "POINTS REQUEST"],
  caseCommitment: ["CASE COMMITMENT"], minimumOrder: ["MINIMUM ORDER", "MIN ORDER"], preorder: ["PREORDER", "PRE-ORDER"],
  displaySupport: ["DISPLAY SUPPORT"], displayRequested: ["DISPLAY REQUESTED", "DISPLAY REQUEST"], displayFamily: ["DISPLAY FAMILY"],
  displayCount: ["DISPLAY COUNT"], placementNotes: ["PLACEMENT NOTES", "DISPLAY NOTES"], marketingSupport: ["MARKETING SUPPORT"],
  supplierFundedSupport: ["SUPPLIER-FUNDED SUPPORT", "SUPPLIER FUNDED SUPPORT"], assetsAvailable: ["ASSETS AVAILABLE"],
  sampleSupport: ["SAMPLE/TASTING SUPPORT", "SAMPLE SUPPORT", "TASTING SUPPORT"], availableQuantity: ["AVAILABLE QUANTITY"],
  availableFrom: ["AVAILABILITY DATE", "AVAILABLE FROM"], restrictions: ["DISTRIBUTION CONSTRAINTS", "AVAILABILITY RESTRICTIONS"],
  storesRegions: ["STORES/REGIONS", "STORES OR REGIONS"], claims: ["REP CLAIMS", "CLAIMS"], notes: ["NOTES", "ADDITIONAL NOTES"],
  rawText: ["RAW TEXT"],
} as const;

type ColumnKey = keyof typeof COLUMNS;
type RowStatus = "ready" | "needs_review";

export interface SupplierSubmissionReviewRow {
  rowNumber: number;
  sku: string;
  productName: string;
  product?: Product;
  status: RowStatus;
  opportunityStatus: PromotionOpportunityStatus;
  opportunity: Omit<PromotionOpportunity, "id" | "sourceSubmissionId" | "provenance" | "createdAt" | "updatedAt">;
  provenance: Omit<PromotionOpportunity["provenance"], "importedAt">;
  issues: ImportIssue[];
}

export interface SupplierSubmissionImportResult {
  formatId: typeof SUPPLIER_SUBMISSION_FORMAT_ID;
  fingerprint: string;
  sourceFileName: string;
  sourceSheet: string;
  sheetNames: string[];
  supplier: string;
  supplierContact?: string;
  submittedAt?: string;
  proposedStartDate?: string;
  proposedEndDate?: string;
  rows: SupplierSubmissionReviewRow[];
  issues: ImportIssue[];
  fatal: boolean;
}

export interface SupplierSubmissionParseOptions {
  sourceFileName: string;
  sourceSheet: string;
  sheetNames?: string[];
  fingerprint: string;
}

export class SupplierSubmissionImportAdapter implements ImportAdapter<{ productMaster: ProductMasterLookup }, SupplierSubmissionImportResult> {
  readonly formatId = SUPPLIER_SUBMISSION_FORMAT_ID;
  readonly acceptedExtensions = [".xlsx"];

  async parse(file: Blob, context: { productMaster: ProductMasterLookup }): Promise<SupplierSubmissionImportResult> {
    const sheetNames = await readSheetNames(file);
    if (!sheetNames.length) throw new Error("The workbook does not contain a readable worksheet.");
    let sourceSheet = sheetNames[0];
    let rows: unknown[][] = [];
    for (const sheet of sheetNames) {
      const candidate = await readXlsxFile(file, { sheet });
      if (hasRequiredHeaders(candidate[0] ?? [])) { sourceSheet = sheet; rows = candidate; break; }
      if (!rows.length) rows = candidate;
    }
    return this.parseRows(rows, context, {
      sourceFileName: (file as File).name || "supplier-submission.xlsx", sourceSheet, sheetNames,
      fingerprint: await sha256(file),
    });
  }

  async parseRows(sourceRows: unknown[][], context: { productMaster: ProductMasterLookup }, options: SupplierSubmissionParseOptions): Promise<SupplierSubmissionImportResult> {
    const headers = (sourceRows[0] ?? []).map(cellText);
    const indexes = resolveIndexes(headers);
    const missing = (["supplier", "sku", "product"] as ColumnKey[]).filter((key) => indexes[key] === undefined);
    if (missing.length) {
      const issue = makeIssue(1, "Header", "unsupported_supplier_workbook", `Missing required columns: ${missing.map((key) => COLUMNS[key][0]).join(", ")}.`, "error");
      return { formatId: this.formatId, fingerprint: options.fingerprint, sourceFileName: options.sourceFileName, sourceSheet: options.sourceSheet, sheetNames: options.sheetNames ?? [options.sourceSheet], supplier: "", rows: [], issues: [issue], fatal: true };
    }

    const inputRows = sourceRows.slice(1).filter((cells) => cells.some((cell) => cellText(cell)));
    const lookupSkus = inputRows.map((cells) => normalizeProductSku(value(cells, indexes.sku))).filter(isLookupEligibleSku);
    const lookup = await context.productMaster.findByExactSkus(lookupSkus);
    const products = new Map(lookup.products.map((product) => [normalizeProductSku(product.sku), product]));
    const ambiguous = new Set(lookup.ambiguousSkus.map(normalizeProductSku));
    const supplierNames = [...new Set(inputRows.map((cells) => value(cells, indexes.supplier)).filter(Boolean))];
    const supplier = supplierNames.length === 1 ? supplierNames[0] : supplierNames.length > 1 ? "Multiple suppliers" : "";
    const seenProposals = new Set<string>();
    const rows: SupplierSubmissionReviewRow[] = [];
    const issues: ImportIssue[] = [];

    sourceRows.slice(1).forEach((cells, offset) => {
      if (!cells.some((cell) => cellText(cell))) return;
      const rowNumber = offset + 2;
      const rowIssues: ImportIssue[] = [];
      const sku = normalizeProductSku(value(cells, indexes.sku));
      const productName = value(cells, indexes.product);
      const rowSupplier = value(cells, indexes.supplier) || supplier;
      if (!rowSupplier) rowIssues.push(makeIssue(rowNumber, "Supplier", "missing_supplier", "Supplier is required.", "error"));
      if (!sku) rowIssues.push(makeIssue(rowNumber, "SKU", "missing_sku", "SKU is required for authoritative Product Master matching.", "error"));
      else if (sku === "TBD") rowIssues.push(makeIssue(rowNumber, "SKU", "tbd_sku", "TBD must be resolved before automatic product matching.", "error"));
      else if (isCompoundSku(sku)) rowIssues.push(makeIssue(rowNumber, "SKU", "compound_sku", "Compound SKUs are retained for review and are not split automatically.", "error"));
      if (!productName) rowIssues.push(makeIssue(rowNumber, "Product", "missing_product_name", "Product name is required as supplier evidence.", "error"));
      const product = isLookupEligibleSku(sku) ? products.get(sku) : undefined;
      if (ambiguous.has(sku)) rowIssues.push(makeIssue(rowNumber, "SKU", "ambiguous_product_master_sku", `SKU ${sku} has multiple normalized Product Master matches.`, "error"));
      else if (isLookupEligibleSku(sku) && !product) rowIssues.push(makeIssue(rowNumber, "SKU", "unmatched_sku", `SKU ${sku} was not found in Product Master.`, "error"));

      const start = parseDate(valueRaw(cells, indexes.start));
      const end = parseDate(valueRaw(cells, indexes.end));
      addInvalidDateIssue(rowIssues, rowNumber, "Promotion Start", value(cells, indexes.start), start);
      addInvalidDateIssue(rowIssues, rowNumber, "Promotion End", value(cells, indexes.end), end);
      if (start && end && start > end) rowIssues.push(makeIssue(rowNumber, "Promotion End", "invalid_promotion_period", "Promotion End cannot be before Promotion Start.", "error"));
      const lto = parseNumber(valueRaw(cells, indexes.lto));
      const retail = parseNumber(valueRaw(cells, indexes.proposedRetail));
      const caseCommitment = parseWhole(valueRaw(cells, indexes.caseCommitment));
      const minimumOrder = parseWhole(valueRaw(cells, indexes.minimumOrder));
      const displayCount = parseWhole(valueRaw(cells, indexes.displayCount));
      const availableQuantity = parseWhole(valueRaw(cells, indexes.availableQuantity));
      addInvalidNumberIssue(rowIssues, rowNumber, "LTO", value(cells, indexes.lto), lto);
      addInvalidNumberIssue(rowIssues, rowNumber, "Proposed Retail", value(cells, indexes.proposedRetail), retail);
      addInvalidNumberIssue(rowIssues, rowNumber, "Case Commitment", value(cells, indexes.caseCommitment), caseCommitment);
      addInvalidNumberIssue(rowIssues, rowNumber, "Minimum Order", value(cells, indexes.minimumOrder), minimumOrder);
      const preorder = parseBoolean(value(cells, indexes.preorder));
      const displayRequested = parseBoolean(value(cells, indexes.displayRequested));
      const assetsAvailable = parseBoolean(value(cells, indexes.assetsAvailable));
      const requestedDisplayFamily = parseDisplayFamily(value(cells, indexes.displayFamily));
      const availableFrom = parseDate(valueRaw(cells, indexes.availableFrom));
      addInvalidDateIssue(rowIssues, rowNumber, "Availability Date", value(cells, indexes.availableFrom), availableFrom);
      if (value(cells, indexes.displayFamily) && !requestedDisplayFamily) rowIssues.push(makeIssue(rowNumber, "Display Family", "unknown_display_family", "Display Family must be Wine, Beer/RTD, Multi, Seasonal, Window, or Other.", "error"));

      const normalizedValues: Record<string, string | number | boolean | null> = {
        supplier: rowSupplier || null, sku: sku || null, productName: productName || null,
        supplierProductDescription: value(cells, indexes.supplierDescription) || null, vendor: value(cells, indexes.vendor) || null,
        supplierCategory: value(cells, indexes.category) || null, proposedStartDate: start ?? null,
        proposedEndDate: end ?? null, wholesaleLto: lto ?? null, tpr: value(cells, indexes.tpr) || null,
        proposedRetail: retail ?? null, flyerRequest: value(cells, indexes.flyerMonth) || null,
        promotionalMechanic: value(cells, indexes.mechanic) || null, points: value(cells, indexes.points) || null,
        caseCommitment: caseCommitment ?? null, minimumOrder: minimumOrder ?? null, preorderRequired: preorder ?? null,
        displaySupport: value(cells, indexes.displaySupport) || null,
        displayRequested: displayRequested ?? null, requestedDisplayFamily: requestedDisplayFamily ?? null,
        requestedDisplayCount: displayCount ?? null, placementNotes: value(cells, indexes.placementNotes) || null,
        marketingSupport: value(cells, indexes.marketingSupport) || null, supplierFundedSupport: value(cells, indexes.supplierFundedSupport) || null,
        assetsAvailable: assetsAvailable ?? null, sampleTastingSupport: value(cells, indexes.sampleSupport) || null,
        availabilityQuantity: availableQuantity ?? null, availableFrom: availableFrom ?? null,
        availabilityRestrictions: value(cells, indexes.restrictions) || null, storesOrRegions: value(cells, indexes.storesRegions) || null,
        repClaims: value(cells, indexes.claims) || null, notes: value(cells, indexes.notes) || null, rawText: value(cells, indexes.rawText) || null,
      };
      const proposalIdentity = JSON.stringify(normalizedValues);
      if (seenProposals.has(proposalIdentity)) rowIssues.push(makeIssue(rowNumber, "Row", "exact_duplicate_opportunity", "This row exactly duplicates an earlier commercial proposal and requires review.", "error"));
      seenProposals.add(proposalIdentity);

      const status: RowStatus = rowIssues.some((issue) => issue.severity === "error") ? "needs_review" : "ready";
      const opportunityStatus: PromotionOpportunityStatus = status === "ready" ? "READY_FOR_REVIEW" : "NEEDS_REVIEW";
      const matchMethod = ambiguous.has(sku) ? "AMBIGUOUS" : product ? "EXACT_SKU" : isLookupEligibleSku(sku) ? "UNMATCHED" : "NOT_ATTEMPTED";
      const opportunity: SupplierSubmissionReviewRow["opportunity"] = {
        productId: product?.id, authoritativeSku: product?.sku, supplierSku: sku || undefined, productName: product?.name ?? productName,
        supplierProductDescription: value(cells, indexes.supplierDescription) || productName || undefined, supplier: rowSupplier,
        vendor: value(cells, indexes.vendor) || undefined, supplierCategory: value(cells, indexes.category) || undefined,
        authoritativeCategory: product?.category, proposedStartDate: start, proposedEndDate: end,
        promotionEvidence: { wholesaleLto: lto, tpr: value(cells, indexes.tpr) || undefined, proposedRetail: retail, flyerRequest: value(cells, indexes.flyerMonth) || undefined, promotionalMechanic: value(cells, indexes.mechanic) || undefined, points: value(cells, indexes.points) || undefined },
        commercialTerms: { caseCommitment, minimumOrder, preorderRequired: preorder, displaySupport: value(cells, indexes.displaySupport) || undefined, marketingSupport: value(cells, indexes.marketingSupport) || undefined, supplierFundedSupport: value(cells, indexes.supplierFundedSupport) || undefined, assetsAvailable, sampleTastingSupport: value(cells, indexes.sampleSupport) || undefined },
        merchandisingRequest: { displayRequested, requestedDisplayFamily, requestedDisplayCount: displayCount, notes: value(cells, indexes.placementNotes) || undefined },
        availability: { availableFrom, quantity: availableQuantity, restrictions: value(cells, indexes.restrictions) || undefined, storesOrRegions: value(cells, indexes.storesRegions) || undefined },
        supplierEvidence: { claims: value(cells, indexes.claims) || undefined, notes: value(cells, indexes.notes) || undefined, rawText: value(cells, indexes.rawText) || undefined },
        status: opportunityStatus,
      };
      const provenance: SupplierSubmissionReviewRow["provenance"] = {
        formatId: this.formatId, workbookName: options.sourceFileName, workbookSha256: options.fingerprint,
        sheet: options.sourceSheet, row: rowNumber, sourceValues: Object.fromEntries(headers.map((header, index) => [header || columnName(index), cellText(cells[index])])),
        normalizedValues, productMatchMethod: matchMethod, issues: rowIssues.map((issue) => issue.code),
      };
      rows.push({ rowNumber, sku, productName, product, status, opportunityStatus, opportunity, provenance, issues: rowIssues });
      issues.push(...rowIssues);
    });

    const dates = rows.flatMap((row) => [row.opportunity.proposedStartDate, row.opportunity.proposedEndDate]).filter((date): date is string => Boolean(date)).sort();
    const contacts = [...new Set(inputRows.map((cells) => value(cells, indexes.supplierContact)).filter(Boolean))];
    const submitted = inputRows.map((cells) => parseDate(valueRaw(cells, indexes.submittedAt))).find(Boolean);
    return {
      formatId: this.formatId, fingerprint: options.fingerprint, sourceFileName: options.sourceFileName,
      sourceSheet: options.sourceSheet, sheetNames: options.sheetNames ?? [options.sourceSheet], supplier,
      supplierContact: contacts.length === 1 ? contacts[0] : undefined, submittedAt: submitted,
      proposedStartDate: dates[0], proposedEndDate: dates.at(-1), rows, issues, fatal: false,
    };
  }
}

export function supplierSubmissionImportKey(result: Pick<SupplierSubmissionImportResult, "formatId" | "fingerprint" | "supplier" | "proposedStartDate" | "proposedEndDate">) {
  return [result.formatId, result.fingerprint, normalizeHeader(result.supplier), result.proposedStartDate ?? "", result.proposedEndDate ?? ""].join(" | ");
}

export function toApplySupplierSubmissionImport(result: SupplierSubmissionImportResult): ApplySupplierSubmissionImportInput {
  if (result.fatal) throw new Error("A workbook with unsupported structure cannot be applied.");
  if (!result.supplier.trim()) throw new Error("Supplier is required before Apply.");
  if (!result.rows.length) throw new Error("No proposal rows were found.");
  return {
    formatId: result.formatId, importKey: supplierSubmissionImportKey(result), fingerprint: result.fingerprint,
    sourceFileName: result.sourceFileName, sourceSheet: result.sourceSheet, supplier: result.supplier,
    supplierContact: result.supplierContact, submittedAt: result.submittedAt, proposedStartDate: result.proposedStartDate,
    proposedEndDate: result.proposedEndDate,
    reviewRows: result.rows.map((row) => ({
      provenance: row.provenance,
      disposition: row.status === "ready" ? "OPPORTUNITY_CREATED" : row.issues.some((issue) => issue.code === "exact_duplicate_opportunity") ? "SKIPPED_DUPLICATE" : "SKIPPED_BLOCKING",
    })),
    rows: result.rows.filter((row) => row.status === "ready" && row.product).map((row) => ({ opportunity: { ...row.opportunity, provenance: row.provenance }, product: row.product })),
  };
}

function hasRequiredHeaders(row: unknown[]) {
  const indexes = resolveIndexes(row.map(cellText));
  return indexes.supplier !== undefined && indexes.sku !== undefined && indexes.product !== undefined;
}
function resolveIndexes(headers: string[]): Partial<Record<ColumnKey, number>> {
  const normalized = headers.map(normalizeHeader);
  return Object.fromEntries(Object.entries(COLUMNS).flatMap(([key, aliases]) => {
    const index = normalized.findIndex((header) => (aliases as readonly string[]).map(normalizeHeader).includes(header));
    return index >= 0 ? [[key, index]] : [];
  })) as Partial<Record<ColumnKey, number>>;
}
function normalizeHeader(value: unknown) { return cellText(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLocaleUpperCase(); }
function cellText(value: unknown) { return value === null || value === undefined ? "" : value instanceof Date ? value.toISOString().slice(0, 10) : String(value).replace(/\u00a0/g, " ").trim(); }
function valueRaw(cells: unknown[], index?: number) { return index === undefined ? undefined : cells[index]; }
function value(cells: unknown[], index?: number) { return cellText(valueRaw(cells, index)); }
function isCompoundSku(sku: string) { return sku.includes("/"); }
function isLookupEligibleSku(sku: string) { return Boolean(sku) && sku !== "TBD" && !isCompoundSku(sku); }
function parseNumber(raw: unknown) { if (cellText(raw) === "") return undefined; const number = typeof raw === "number" ? raw : Number(cellText(raw).replace(/[$,]/g, "")); return Number.isFinite(number) && number >= 0 ? number : undefined; }
function parseWhole(raw: unknown) { const number = parseNumber(raw); return number !== undefined && Number.isInteger(number) ? number : undefined; }
function parseBoolean(raw: string) { if (!raw) return undefined; if (["Y", "YES", "TRUE", "1"].includes(normalizeHeader(raw))) return true; if (["N", "NO", "FALSE", "0"].includes(normalizeHeader(raw))) return false; return undefined; }
function parseDate(raw: unknown) { if (raw instanceof Date && !Number.isNaN(raw.valueOf())) return raw.toISOString().slice(0, 10); const text = cellText(raw); return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00Z`)) ? text : undefined; }
function parseDisplayFamily(raw: string): DisplayFamily | undefined { const key = normalizeHeader(raw).replace(/[/ ]+/g, "_"); const aliases: Record<string, DisplayFamily> = { WINE: "WINE", BEER: "BEER_RTD", RTD: "BEER_RTD", BEER_RTD: "BEER_RTD", MULTI: "MULTI", SEASONAL: "SEASONAL", WINDOW: "WINDOW", OTHER: "OTHER" }; return aliases[key]; }
function addInvalidDateIssue(issues: ImportIssue[], row: number, field: string, raw: string, parsed?: string) { if (raw && !parsed) issues.push(makeIssue(row, field, "invalid_date", `${field} must be an Excel date or YYYY-MM-DD.`, "error")); }
function addInvalidNumberIssue(issues: ImportIssue[], row: number, field: string, raw: string, parsed?: number) { if (raw && parsed === undefined) issues.push(makeIssue(row, field, "invalid_number", `${field} must be a non-negative number.`, "error")); }
function columnName(index: number) { let value = index + 1; let name = ""; while (value > 0) { value -= 1; name = String.fromCharCode(65 + (value % 26)) + name; value = Math.floor(value / 26); } return name; }
function makeIssue(row: number, field: string, code: string, message: string, severity: ImportIssue["severity"]): ImportIssue { return { row, field, code, message, severity }; }
async function sha256(file: Blob) { const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer()); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
