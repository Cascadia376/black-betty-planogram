import readXlsxFile, { readSheetNames } from "read-excel-file";
import type { ApplyStoreDisplayWorkbookInput } from "../../domain/repositories";
import type { CampaignImportRowMetadata, DisplayArea, PlatformSnapshot, Product, Store } from "../../domain/types";
import type { ImportIssue } from "../../services/imports/contracts";
import type { ProductMasterLookup } from "../../services/products/ProductMasterLookup";
import { normalizeProductSku } from "../../services/products/ProductMasterLookup";

export const STORE_DISPLAY_WORKBOOK_FORMAT_ID = "store-display-workbook-import-v1" as const;
export const STORE_DISPLAY_HEADERS = ["VENDOR", "CATEGORY", "INV NUM", "PRODUCT", "DISPLAY", "CASE QTY", "DISPLAY NOTES"] as const;

const storeAliases: Record<string, string> = {
  COURTENAY: "Crown Isle", "CROWN ISLE": "Crown Isle", "CADDY BAY": "Caddy Bay", COLWOOD: "Hatley Park",
  "HATLEY PARK": "Hatley Park", "NANOOSE BAY": "Nanoose", "PORT ALBERNI": "Port Alberni",
};

export interface StoreDisplayWorkbookImportContext {
  snapshot: Pick<PlatformSnapshot, "stores" | "displayAreas" | "products">;
  productMaster: ProductMasterLookup;
}

/**
 * Buyer-selected worksheet mappings are review input, not an inferred property
 * of a workbook filename. Values are canonical Store ids.
 */
export type StoreDisplayWorkbookSheetMappings = Record<string, string>;

export interface StoreDisplayWorkbookReviewRow {
  sheet: string;
  rowNumber: number;
  store?: Store;
  sku: string;
  productName: string;
  vendor?: string;
  category?: string;
  caseQuantity?: number;
  displaySourceValue: string;
  displayLocalCode?: string;
  displayArea?: DisplayArea;
  displayInterpretation: "ASSIGNED" | "UNRESOLVED" | "SHELF_SUPPORTED";
  /** Source-only marker. It is never written into campaign state. */
  temporaryDisplayMarker?: "N";
  displayNotes?: string;
  rotatingFlyerSlot?: boolean;
  product: Product;
  productResolution: "MATCHED_ACTIVE" | "MATCHED_INACTIVE" | "PENDING" | "INVALID";
  status: "ready" | "pending" | "inactive" | "invalid";
  source: CampaignImportRowMetadata;
  issues: ImportIssue[];
}

export interface StoreDisplayNoteReview {
  store?: Store;
  displayLocalCode: string;
  executionNotes?: string;
  hasConflict: boolean;
  sourceRows: number[];
}

export interface StoreDisplayWorkbookImportResult {
  formatId: typeof STORE_DISPLAY_WORKBOOK_FORMAT_ID;
  fingerprint: string;
  sourceFileName: string;
  sheetNames: string[];
  rows: StoreDisplayWorkbookReviewRow[];
  displayNotes: StoreDisplayNoteReview[];
  issues: ImportIssue[];
}

export class StoreDisplayWorkbookImportAdapter {
  async parse(file: Blob, context: StoreDisplayWorkbookImportContext, sheetMappings: StoreDisplayWorkbookSheetMappings = {}): Promise<StoreDisplayWorkbookImportResult> {
    const named = file as File;
    const sheetNames = await readSheetNames(file);
    const sheets = await Promise.all(sheetNames.map(async (sheet) => ({ sheet, rows: await readXlsxFile(file, { sheet }) })));
    return this.parseSheets(sheets, context, { sourceFileName: named.name || "store-display-workbook.xlsx", fingerprint: await sha256(file) }, sheetMappings);
  }

  async parseSheets(sheets: Array<{ sheet: string; rows: unknown[][] }>, context: StoreDisplayWorkbookImportContext, provenance: { sourceFileName: string; fingerprint: string }, sheetMappings: StoreDisplayWorkbookSheetMappings = {}): Promise<StoreDisplayWorkbookImportResult> {
    const allSkus = sheets.flatMap(({ rows }) => rows.slice(1).map((row) => skuText(row[2])).filter(Boolean));
    const lookup = await context.productMaster.findByExactSkus(allSkus);
    const activeBySku = new Map(lookup.products.map((product) => [normalizeProductSku(product.sku), product]));
    const inactive = new Set((lookup.inactiveSkus ?? []).map(normalizeProductSku));
    const ambiguous = new Set(lookup.ambiguousSkus.map(normalizeProductSku));
    const rows: StoreDisplayWorkbookReviewRow[] = [];
    const issues: ImportIssue[] = [];

    for (const { sheet, rows: sheetRows } of sheets) {
      const headers = (sheetRows[0] ?? []).map(normalizeHeader);
      const indexes = new Map(headers.map((header, index) => [header, index]));
      const missing = STORE_DISPLAY_HEADERS.filter((header) => !indexes.has(header));
      const store = resolveStore(sheet, context.snapshot.stores, sheetMappings);
      if (!store) issues.push(issue(0, sheet, "unknown_store_sheet", `Sheet ${sheet} does not resolve to a known store and will not be applied.`, "warning"));
      if (missing.length) {
        issues.push(issue(1, sheet, "missing_store_display_headers", `Sheet ${sheet} is missing: ${missing.join(", ")}.`, "error"));
        continue;
      }
      for (let index = 1; index < sheetRows.length; index += 1) {
        const cells = sheetRows[index] ?? [];
        if (cells.every((cell) => text(cell) === "")) continue;
        if (isRepeatedStoreDisplayHeader(cells, indexes)) continue;
        const rowNumber = index + 1;
        const sku = skuText(cells[indexes.get("INV NUM")!]);
        const productName = text(cells[indexes.get("PRODUCT")!]);
        const vendor = text(cells[indexes.get("VENDOR")!]) || undefined;
        const category = text(cells[indexes.get("CATEGORY")!]) || undefined;
        const displaySourceValue = text(cells[indexes.get("DISPLAY")!]);
        const displayNotes = text(cells[indexes.get("DISPLAY NOTES")!]) || undefined;
        const rawCases = cells[indexes.get("CASE QTY")!];
        const caseQuantity = parseCases(rawCases);
        const rowIssues: ImportIssue[] = [];
        if (!store) rowIssues.push(issue(rowNumber, sheet, "unknown_store_sheet", `Sheet ${sheet} is not mapped to a known store.`, "warning"));
        if (!productName) rowIssues.push(issue(rowNumber, sheet, "missing_product_name", "Product is required to retain this row for review.", "error"));
        if (caseQuantity === null) rowIssues.push(issue(rowNumber, sheet, "invalid_case_quantity", "Case QTY must be a non-negative whole number when supplied.", "error"));
        const rotatingFlyerSlot = !sku && /rotating\s+(?:flyer\s+)?(?:sku|beer|rtd)/i.test(productName);
        const normalizedSku = normalizeProductSku(sku);
        let productResolution: StoreDisplayWorkbookReviewRow["productResolution"];
        let product: Product;
        if (!productName || ambiguous.has(normalizedSku)) {
          productResolution = "INVALID";
          if (ambiguous.has(normalizedSku)) rowIssues.push(issue(rowNumber, sheet, "ambiguous_product_master_sku", `SKU ${sku} has multiple exact Product Master matches.`, "error"));
          product = planningProduct(sku, productName || "Invalid source row", category, vendor, "unresolved");
        } else if (activeBySku.has(normalizedSku)) {
          productResolution = "MATCHED_ACTIVE";
          product = activeBySku.get(normalizedSku)!;
        } else if (normalizedSku && inactive.has(normalizedSku)) {
          productResolution = "MATCHED_INACTIVE";
          product = context.snapshot.products.find((item) => normalizeProductSku(item.sku) === normalizedSku) ?? planningProduct(sku, productName, category, vendor, "unresolved");
          rowIssues.push(issue(rowNumber, sheet, "inactive_sku", `SKU ${sku} exactly matches an inactive Product Master product.`, "warning"));
        } else {
          productResolution = "PENDING";
          product = planningProduct(sku, productName, category, vendor, "pending");
          rowIssues.push(issue(rowNumber, sheet, normalizedSku ? "unmatched_sku" : "missing_sku", normalizedSku ? `SKU ${sku} is not in Product Master; retained as a pending campaign product.` : "No INV_NUM was supplied; retained as a pending campaign product.", "warning"));
        }
        const temporaryDisplayMarker: StoreDisplayWorkbookReviewRow["temporaryDisplayMarker"] = displaySourceValue.toLocaleUpperCase() === "N" ? "N" : undefined;
        const display = resolveDisplay(displaySourceValue, store, context.snapshot.displayAreas);
        if (temporaryDisplayMarker) {
          rowIssues.push(issue(rowNumber, sheet, "temporary_display_marker", "Display value N is a temporary source marker only. Replace or remove it in the source workbook before Apply.", "warning"));
        } else if (display.interpretation === "UNRESOLVED") {
          rowIssues.push(issue(rowNumber, sheet, "unresolved_display", `Display ${displaySourceValue || "(blank)"} requires review.`, "warning"));
        }
        const source: CampaignImportRowMetadata = {
          sourceSheet: sheet, sourceRow: rowNumber, skuRaw: sku, productName, vendor, category,
          displaySourceValue, displayLocalCode: display.code, displayInterpretation: display.interpretation, displayNotes,
          productResolution, rotatingFlyerSlot, allocations: store ? [{ sourceColumn: "Case QTY", sourceStoreName: store.name, storeId: store.id, quantityCases: caseQuantity ?? 0, sourceCell: `F${rowNumber}`, displayRequired: true, displayLocalCode: display.code, displaySourceCell: `E${rowNumber}` }] : [],
          issues: rowIssues.map((item) => item.code),
        };
        const status: StoreDisplayWorkbookReviewRow["status"] = productResolution === "INVALID" || !store ? "invalid" : productResolution === "PENDING" ? "pending" : productResolution === "MATCHED_INACTIVE" ? "inactive" : "ready";
        const review = { sheet, rowNumber, store, sku, productName, vendor, category, caseQuantity: caseQuantity ?? undefined,
          displaySourceValue, displayLocalCode: display.code, displayArea: display.area, displayInterpretation: display.interpretation, temporaryDisplayMarker, displayNotes, rotatingFlyerSlot, product, productResolution, status, source, issues: rowIssues };
        rows.push(review); issues.push(...rowIssues);
      }
    }
    return { formatId: STORE_DISPLAY_WORKBOOK_FORMAT_ID, fingerprint: provenance.fingerprint, sourceFileName: provenance.sourceFileName,
      sheetNames: sheets.map((item) => item.sheet), rows, displayNotes: collectDisplayNotes(rows), issues };
  }
}

/** Identifies the one-worksheet-per-store shape without relying on a filename. */
export async function isStoreDisplayWorkbook(file: Blob): Promise<boolean> {
  const sheetNames = await readSheetNames(file);
  if (sheetNames.length < 2) return false;
  const sheets = await Promise.all(sheetNames.map(async (sheet) => readXlsxFile(file, { sheet })));
  return sheets.every((rows) => {
    const headers = new Set((rows[0] ?? []).map(normalizeHeader));
    return STORE_DISPLAY_HEADERS.every((header) => headers.has(header));
  });
}

export function toApplyStoreDisplayWorkbookImport(result: StoreDisplayWorkbookImportResult, campaignId: string): ApplyStoreDisplayWorkbookInput {
  const temporaryMarkers = result.rows.filter((row) => row.temporaryDisplayMarker);
  if (temporaryMarkers.length) {
    throw new Error(`Apply blocked: ${temporaryMarkers.length} temporary N display marker${temporaryMarkers.length === 1 ? " remains" : "s remain"}. Replace or remove them in the source workbook, then re-import.`);
  }
  const applicable = result.rows.filter((row) => row.store && row.status !== "invalid" && !row.rotatingFlyerSlot);
  return {
    campaignId, fingerprint: result.fingerprint, importKey: `${result.formatId} | ${result.fingerprint} | ${campaignId}`,
    sourceFileName: result.sourceFileName, sourceSheet: result.sheetNames.join(", "), reviewRows: result.rows.map((row) => row.source),
    rows: applicable.map((row) => ({ storeId: row.store!.id, product: row.product, productResolution: row.productResolution, source: row.source,
      caseQuantity: row.caseQuantity, displayLocalCode: row.displayLocalCode, displayAreaId: row.displayArea?.id, displayInterpretation: row.displayInterpretation })),
    rotationSlots: result.rows.filter((row) => row.store && row.status !== "invalid" && row.rotatingFlyerSlot && row.displayLocalCode).map((row) => ({ storeId: row.store!.id, displayLocalCode: row.displayLocalCode!, displayAreaId: row.displayArea?.id, displayInterpretation: row.displayInterpretation, note: row.displayNotes })),
    displayNotes: result.displayNotes.filter((note) => note.store).map((note) => ({ storeId: note.store!.id, displayLocalCode: note.displayLocalCode, executionNotes: note.executionNotes, hasConflict: note.hasConflict })),
  };
}

function collectDisplayNotes(rows: StoreDisplayWorkbookReviewRow[]): StoreDisplayNoteReview[] {
  const grouped = new Map<string, StoreDisplayWorkbookReviewRow[]>();
  rows.filter((row) => row.store && row.displayLocalCode).forEach((row) => {
    const key = `${row.store!.id}|${row.displayLocalCode!.toLocaleUpperCase()}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  });
  return [...grouped.values()].map((group) => {
    const values = [...new Set(group.map((row) => row.displayNotes).filter((note): note is string => Boolean(note)))];
    return { store: group[0].store, displayLocalCode: group[0].displayLocalCode!, executionNotes: values.length === 1 ? values[0] : undefined, hasConflict: values.length > 1, sourceRows: group.map((row) => row.rowNumber) };
  });
}

function resolveStore(sheet: string, stores: Store[], sheetMappings: StoreDisplayWorkbookSheetMappings) {
  const mappedStoreId = sheetMappings[sheet];
  if (mappedStoreId) return stores.find((store) => store.id === mappedStoreId);
  const normalized = normalizeHeader(sheet);
  const expected = storeAliases[normalized] ?? sheet;
  return stores.find((store) => normalizeHeader(store.name) === normalizeHeader(expected));
}

function resolveDisplay(raw: string, store: Store | undefined, areas: DisplayArea[]) {
  if (!raw || raw.toLocaleUpperCase() === "N") return { interpretation: "UNRESOLVED" as const };
  const normalized = normalizeHeader(raw);
  const area = store && areas.find((item) => item.storeId === store.id && item.active && [item.code, item.localCode, item.displayNumber].some((value) => normalizeHeader(value) === normalized));
  return area ? { interpretation: "ASSIGNED" as const, code: area.localCode ?? area.displayNumber, area } : { interpretation: "UNRESOLVED" as const, code: normalized };
}

function planningProduct(sku: string, name: string, category: string | undefined, vendor: string | undefined, masterStatus: Product["masterStatus"]): Product {
  return { id: crypto.randomUUID(), sku: sku || `PENDING-${crypto.randomUUID().slice(0, 8)}`, name, category: category || "Uncategorized", supplierName: vendor, masterStatus, active: false, synthetic: false,
    notes: "Campaign-only pending source product; Product Master reconciliation required." };
}
function parseCases(value: unknown) { const raw = text(value); if (!raw) return undefined; const number = Number(raw); return Number.isInteger(number) && number >= 0 ? number : null; }
function isRepeatedStoreDisplayHeader(cells: unknown[], indexes: Map<string, number>) {
  return ["VENDOR", "CATEGORY", "INV NUM", "PRODUCT", "CASE QTY", "DISPLAY NOTES"].every((header) => normalizeHeader(cells[indexes.get(header)!]) === header);
}
function skuText(value: unknown) { return text(value).replace(/\.0$/, ""); }
function text(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }
function normalizeHeader(value: unknown) { return text(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLocaleUpperCase(); }
function issue(row: number, field: string, code: string, message: string, severity: ImportIssue["severity"]): ImportIssue { return { row, field, code, message, severity }; }
async function sha256(file: Blob) { const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer()); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
