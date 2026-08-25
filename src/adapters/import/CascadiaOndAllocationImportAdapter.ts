import readXlsxFile from "read-excel-file";
import type { ApplyOndImportInput } from "../../domain/repositories";
import type { PlatformSnapshot } from "../../domain/types";
import type { ImportAdapter, ImportIssue } from "../../services/imports/contracts";

export const CASCADIA_OND_HEADERS = ["Program", "Store", "Display #", "SKU", "Product", "Case Qty", "Vendor", "Start Date", "End Date", "Reset Date", "Promo Notes"] as const;

export interface CascadiaOndImportContext {
  programId: string;
  snapshot: PlatformSnapshot;
}

export interface CascadiaOndReviewRow {
  rowNumber: number;
  program: string;
  store: string;
  displayNumber: string;
  sku: string;
  product: string;
  caseQuantity?: number;
  vendor: string;
  startDate?: string;
  endDate?: string;
  resetDate?: string;
  promoNotes: string;
  status: "ready" | "review" | "error";
  issues: ImportIssue[];
}

export interface CascadiaOndImportResult {
  formatId: "cascadia-ond-allocation-v1";
  rows: CascadiaOndReviewRow[];
  issues: ImportIssue[];
  batch: ApplyOndImportInput;
}

interface NormalizedRow extends CascadiaOndReviewRow {
  storeId: string;
  displayAreaId: string;
  productId: string;
  supplierId: string;
  periodId?: string;
  resetRequired: boolean;
}

export class CascadiaOndAllocationImportAdapter implements ImportAdapter<CascadiaOndImportContext, CascadiaOndImportResult> {
  readonly formatId = "cascadia-ond-allocation-v1" as const;
  readonly acceptedExtensions = [".xlsx"];

  async parse(file: Blob, context: CascadiaOndImportContext) {
    const rows = await readXlsxFile(file);
    return this.parseRows(rows, context);
  }

  parseRows(rows: unknown[][], context: CascadiaOndImportContext): CascadiaOndImportResult {
    const program = context.snapshot.programs.find((item) => item.id === context.programId);
    const emptyBatch: ApplyOndImportInput = { program: program ?? { id: context.programId, name: "Unknown", startDate: "", endDate: "", status: "draft", description: "" }, assignments: [], supplierProductOptions: [] };
    if (!program) return this.failure(emptyBatch, "program", "unknown_program", "The selected merchandising program was not found.");
    const headers = (rows[0] ?? []).map(cellText);
    if (headers.length !== CASCADIA_OND_HEADERS.length || CASCADIA_OND_HEADERS.some((header, index) => headers[index] !== header)) {
      return this.failure(emptyBatch, "header", "invalid_headers", `Expected exactly: ${CASCADIA_OND_HEADERS.join(" | ")}.`);
    }

    const normalized: NormalizedRow[] = [];
    const reviewRows: CascadiaOndReviewRow[] = [];
    const issues: ImportIssue[] = [];
    const seenProducts = new Set<string>();
    for (let index = 1; index < rows.length; index += 1) {
      const cells = rows[index] ?? [];
      if (cells.every((cell) => cellText(cell) === "")) continue;
      const rowNumber = index + 1;
      const rowIssues: ImportIssue[] = [];
      const add = (field: string, code: string, message: string, severity: "warning" | "error" = "error") => rowIssues.push({ row: rowNumber, field, code, message, severity });
      const programName = cellText(cells[0]);
      const storeText = cellText(cells[1]);
      const displayNumber = cellText(cells[2]);
      const sku = cellText(cells[3]).toUpperCase();
      const productText = cellText(cells[4]);
      const caseQuantity = parseCases(cells[5]);
      const vendorText = cellText(cells[6]);
      const startDate = parseDate(cells[7]);
      const endDate = parseDate(cells[8]);
      const resetDate = parseDate(cells[9]);
      const promoNotes = cellText(cells[10]);

      if (programName !== program.name) add("Program", "program_mismatch", `Expected ${program.name}; found ${programName || "blank"}.`);
      const store = context.snapshot.stores.find((item) => exactMatch(storeText, item.name) || exactMatch(storeText, item.code));
      if (!store) add("Store", "unknown_store", `Store ${storeText || "blank"} is not recognized by name or code.`);
      const matchingAreas = store ? context.snapshot.displayAreas.filter((item) => item.storeId === store.id && item.displayNumber === displayNumber) : [];
      if (!displayNumber || matchingAreas.length !== 1) add("Display #", "invalid_display_number", `Display number ${displayNumber || "blank"} does not identify exactly one display at the selected store.`);
      const masterProduct = context.snapshot.products.find((item) => item.active && item.sku.toUpperCase() === sku);
      if (!masterProduct) add("SKU", "unknown_sku", `SKU ${sku || "blank"} is not in the product master.`);
      const expectedProduct = masterProduct?.name;
      if (expectedProduct && !exactMatch(productText, expectedProduct)) add("Product", "product_mismatch", `SKU ${sku} is recorded as ${expectedProduct}; found ${productText || "blank"}.`);
      if (caseQuantity === undefined || caseQuantity <= 0) add("Case Qty", "invalid_case_quantity", "Case quantity must be a positive whole number.");
      const supplier = context.snapshot.suppliers.find((item) => exactMatch(vendorText, item.name) || exactMatch(vendorText, item.code));
      if (!supplier) add("Vendor", "unknown_vendor", `Vendor ${vendorText || "blank"} is not a known supplier name or code.`);
      if (!startDate) add("Start Date", "ambiguous_start_date", "Start Date must be an ISO date (YYYY-MM-DD) or an Excel date cell.");
      if (!endDate) add("End Date", "ambiguous_end_date", "End Date must be an ISO date (YYYY-MM-DD) or an Excel date cell.");
      if (startDate && endDate && startDate > endDate) add("End Date", "invalid_date_range", "End Date must be on or after Start Date.");
      if (startDate && (startDate < program.startDate || startDate > program.endDate)) add("Start Date", "outside_program", "Start Date is outside the selected program.");
      if (endDate && (endDate < program.startDate || endDate > program.endDate)) add("End Date", "outside_program", "End Date is outside the selected program.");
      if (cells[9] !== undefined && cellText(cells[9]) && !resetDate) add("Reset Date", "ambiguous_reset_date", "Reset Date must be an ISO date (YYYY-MM-DD) or an Excel date cell.");
      const resetDirective = parseResetDirective(promoNotes);
      if (!resetDate && mentionsDate(promoNotes)) add("Promo Notes", "unparsed_timing_note", "Promo Notes appear to contain timing information. Add it to a structured date column before import.", "warning");
      if (resetDate && resetDirective === false) add("Promo Notes", "reset_conflict", "Promo Notes say reset is not required but Reset Date is populated.");
      const period = startDate && endDate ? context.snapshot.programPeriods.find((item) => item.programId === program.id && startDate >= item.startDate && endDate <= item.endDate) : undefined;
      if (resetDate && period?.resetDate !== resetDate) add("Reset Date", "unknown_reset_date", "Reset Date does not match the reset configured for the assignment period.");
      const duplicateKey = `${store?.id}|${matchingAreas[0]?.id}|${startDate}|${endDate}|${masterProduct?.id}`;
      if (seenProducts.has(duplicateKey)) add("SKU", "duplicate_assignment_product", "The same SKU appears more than once for this store, display, and date range.");
      seenProducts.add(duplicateKey);

      const status = rowIssues.some((issue) => issue.severity === "error") ? "error" : rowIssues.length ? "review" : "ready";
      const reviewRow: CascadiaOndReviewRow = { rowNumber, program: programName, store: storeText, displayNumber, sku, product: productText, caseQuantity, vendor: vendorText, startDate, endDate, resetDate, promoNotes, status, issues: rowIssues };
      reviewRows.push(reviewRow);
      issues.push(...rowIssues);
      if (status !== "error" && store && matchingAreas[0] && masterProduct && supplier && caseQuantity && startDate && endDate) normalized.push({ ...reviewRow, storeId: store.id, displayAreaId: matchingAreas[0].id, productId: masterProduct.id, supplierId: supplier.id, periodId: period?.id, resetRequired: Boolean(resetDate) || resetDirective === true });
    }

    const assignmentGroups = new Map<string, NormalizedRow[]>();
    normalized.forEach((row) => { const key = `${row.storeId}|${row.displayAreaId}|${row.startDate}|${row.endDate}|${row.periodId ?? ""}`; assignmentGroups.set(key, [...(assignmentGroups.get(key) ?? []), row]); });
    const assignments: ApplyOndImportInput["assignments"] = [...assignmentGroups.values()].map((group) => ({
      assignment: { programId: program.id, periodId: group[0].periodId, storeId: group[0].storeId, displayAreaId: group[0].displayAreaId, startDate: group[0].startDate!, endDate: group[0].endDate!, resetRequired: group.some((row) => row.resetRequired), notes: [...new Set(group.map((row) => row.promoNotes).filter(Boolean))].join(" | "), status: "planned" },
      products: group.map((row) => ({ productId: row.productId, sku: row.sku, caseQuantity: row.caseQuantity!, required: true, preferredSupplierId: row.supplierId, note: row.promoNotes || undefined })),
    }));
    const supplierProductOptions = [...new Map(normalized.map((row) => {
      const existing = context.snapshot.supplierProductOptions.find((item) => item.productId === row.productId && item.supplierId === row.supplierId);
      return [`${row.productId}|${row.supplierId}`, existing ?? { productId: row.productId, supplierId: row.supplierId, supplierName: row.vendor, preferred: false }];
    })).values()];
    return { formatId: this.formatId, rows: reviewRows, issues, batch: { program, assignments, supplierProductOptions } };
  }

  private failure(batch: ApplyOndImportInput, field: string, code: string, message: string): CascadiaOndImportResult {
    const issue = { row: 1, field, code, severity: "error" as const, message };
    return { formatId: this.formatId, rows: [], issues: [issue], batch };
  }
}

function cellText(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }
function exactMatch(left: string, right: string) { return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase(); }
function parseCases(value: unknown) { const parsed = typeof value === "number" ? value : Number(cellText(value)); return Number.isInteger(parsed) ? parsed : undefined; }
function parseDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const text = cellText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === text ? text : undefined;
}
function parseResetDirective(notes: string) { const match = notes.match(/reset required\s*:\s*(yes|no)/i); return match ? match[1].toLowerCase() === "yes" : undefined; }
function mentionsDate(notes: string) { return /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/i.test(notes); }
