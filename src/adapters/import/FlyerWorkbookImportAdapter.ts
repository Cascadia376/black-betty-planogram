import readXlsxFile, { readSheetNames } from "read-excel-file";
import type { ApplyCampaignWorkbookImportInput } from "../../domain/repositories";
import type {
  CampaignImportRowMetadata,
  CampaignWorkbookKind,
  DisplayArea,
  DisplayFamily,
  NewCampaignInput,
  PlatformSnapshot,
  Product,
  Store,
} from "../../domain/types";
import type { ImportAdapter, ImportIssue } from "../../services/imports/contracts";

export const FLYER_WORKBOOK_FORMAT_ID = "flyer-workbook-import-v1" as const;

const STORE_ALIASES: Record<string, string> = {
  COURTENAY: "Crown Isle",
  "CROWN ISLE": "Crown Isle",
  "CROWNE ISLE": "Crown Isle",
  COLWOOD: "Hatley Park",
  "HATLEY PARK": "Hatley Park",
  "NANOOSE BAY": "Nanoose",
};

export interface FlyerWorkbookImportContext {
  snapshot: Pick<PlatformSnapshot, "products" | "stores" | "displayAreas">;
}

export interface FlyerWorkbookReviewRow {
  rowNumber: number;
  sku: string;
  productName: string;
  product?: Product;
  status: "ready" | "unmatched" | "duplicate" | "invalid" | "information";
  displayLocalCode?: string;
  displayRequired: boolean;
  allocations: Array<{ store: Store; quantityCases: number; sourceColumn: string; sourceCell: string }>;
  source: CampaignImportRowMetadata;
  issues: ImportIssue[];
}

export interface FlyerWorkbookPlacementReview {
  displayLocalCode: string;
  displayFamily: DisplayFamily;
  store: Store;
  status: "ASSIGNED" | "SUGGESTED" | "NEEDS_REVIEW" | "EXCLUDED";
  displayArea?: DisplayArea;
  suggestion?: DisplayArea;
  reasons: string[];
  productCount: number;
  caseQuantity: number;
}

export interface FlyerWorkbookImportResult {
  formatId: typeof FLYER_WORKBOOK_FORMAT_ID;
  workbookKind: CampaignWorkbookKind;
  fingerprint: string;
  sourceFileName: string;
  sourceSheet: string;
  sheetNames: string[];
  suggestedCampaign: Pick<NewCampaignInput, "name" | "type" | "description" | "startDate" | "endDate" | "owner" | "supplier">;
  rows: FlyerWorkbookReviewRow[];
  placements: FlyerWorkbookPlacementReview[];
  issues: ImportIssue[];
  fatal: boolean;
}

export interface FlyerWorkbookParseOptions {
  sourceFileName: string;
  sourceSheet: string;
  sheetNames?: string[];
  fingerprint: string;
}

export class FlyerWorkbookImportAdapter implements ImportAdapter<FlyerWorkbookImportContext, FlyerWorkbookImportResult> {
  readonly formatId = FLYER_WORKBOOK_FORMAT_ID;
  readonly acceptedExtensions = [".xlsx"];

  async parse(file: Blob, context: FlyerWorkbookImportContext): Promise<FlyerWorkbookImportResult> {
    const namedFile = file as File;
    const sheetNames = await readSheetNames(file);
    if (!sheetNames.length) throw new Error("The workbook does not contain a readable worksheet.");
    const sourceSheet = chooseProductSheet(sheetNames);
    const rows = await readXlsxFile(file, { sheet: sourceSheet });
    return this.parseRows(rows, context, {
      sourceFileName: namedFile.name || "uploaded-workbook.xlsx",
      sourceSheet,
      sheetNames,
      fingerprint: await sha256(file),
    });
  }

  parseRows(sourceRows: unknown[][], context: FlyerWorkbookImportContext, options: FlyerWorkbookParseOptions): FlyerWorkbookImportResult {
    const headers = (sourceRows[0] ?? []).map(cellText);
    const workbookKind = detectWorkbookKind(headers);
    const suggestedCampaign = inferCampaign(options.sourceFileName, workbookKind);
    if (!workbookKind) {
      const issue = makeIssue(1, "Header", "unsupported_workbook", "This is not a recognized flyer or campaign-planning workbook.", "error");
      return { formatId: this.formatId, workbookKind: "flyer", fingerprint: options.fingerprint, sourceFileName: options.sourceFileName, sourceSheet: options.sourceSheet, sheetNames: options.sheetNames ?? [options.sourceSheet], suggestedCampaign, rows: [], placements: [], issues: [issue], fatal: true };
    }

    const headerIndex = indexHeaders(headers);
    const indexes = workbookKind === "flyer" ? flyerIndexes(headers, headerIndex) : planningIndexes(headerIndex);
    const storeColumns = workbookKind === "campaign_planning" ? resolveStoreColumns(headers, context.snapshot.stores) : [];
    const catalogBySku = new Map(context.snapshot.products.filter((product) => product.active).map((product) => [normalizeSku(product.sku), product]));
    const seen = new Set<string>();
    const rows: FlyerWorkbookReviewRow[] = [];
    const issues: ImportIssue[] = [];

    for (let index = 1; index < sourceRows.length; index += 1) {
      const cells = sourceRows[index] ?? [];
      if (cells.every((cell) => cellText(cell) === "")) continue;
      const rowNumber = index + 1;
      const sku = normalizeSku(cells[indexes.sku]);
      const productName = cellText(cells[indexes.product]);
      if (!sku && productName) {
        const informationIssue = makeIssue(rowNumber, "Product", "non_product_row", "Informational or giveaway row retained for review and excluded from campaign products.", "warning");
        const source = sourceMetadata(cells, indexes, [], options.sourceSheet, rowNumber, "", productName, [informationIssue.code]);
        rows.push({ rowNumber, sku: "", productName, status: "information", displayRequired: false, allocations: [], source, issues: [informationIssue] });
        issues.push(informationIssue);
        continue;
      }
      if (!sku && !productName) continue;

      const rowIssues: ImportIssue[] = [];
      if (!sku) rowIssues.push(makeIssue(rowNumber, "SKU", "missing_sku", "SKU is required for authoritative Product Master matching.", "error"));
      if (!productName) rowIssues.push(makeIssue(rowNumber, "Product", "missing_product_name", "Product name is blank.", "warning"));
      const product = catalogBySku.get(sku);
      if (sku && !product) rowIssues.push(makeIssue(rowNumber, "SKU", "unmatched_sku", `SKU ${sku} was not found in the active Product Master.`, "error"));
      if (sku && seen.has(sku)) rowIssues.push(makeIssue(rowNumber, "SKU", "duplicate_sku", `SKU ${sku} appears more than once; later rows are skipped.`, "error"));
      if (sku) seen.add(sku);

      const allocations = storeColumns.flatMap(({ index: columnIndex, store, sourceHeader }) => {
        const quantity = parseWholeNumber(cells[columnIndex]);
        if (quantity === undefined && cellText(cells[columnIndex])) {
          rowIssues.push(makeIssue(rowNumber, sourceHeader, "invalid_case_quantity", "Store allocation must be a non-negative whole number.", "error"));
          return [];
        }
        return quantity && quantity > 0 ? [{ store, quantityCases: quantity, sourceColumn: columnName(columnIndex), sourceCell: `${columnName(columnIndex)}${rowNumber}` }] : [];
      });

      const sellingPrice = parseMoney(cells[indexes.sellingPrice]);
      const savings = parseMoney(cells[indexes.savings]);
      const salePrice = parseMoney(cells[indexes.salePrice]);
      if (sellingPrice !== undefined && savings !== undefined && salePrice !== undefined && Math.abs(sellingPrice - savings - salePrice) > 0.011) {
        rowIssues.push(makeIssue(rowNumber, "Sale Price", "price_inconsistent", "Selling Price minus Savings does not equal Sale Price.", "warning"));
      }
      const pointsRaw = cellText(cells[indexes.points]);
      const loyaltyPointsMultiplier = parsePoints(pointsRaw);
      if (pointsRaw && loyaltyPointsMultiplier === undefined) rowIssues.push(makeIssue(rowNumber, "Points", "unknown_points", "Points value was retained as metadata but could not be parsed as a multiplier.", "warning"));
      const displayRaw = cellText(cells[indexes.display]);
      const displayCodeRaw = cellText(cells[indexes.displayArea]);
      const displayLocalCode = normalizeDisplayCode(displayCodeRaw, context.snapshot.displayAreas);
      const displayRequired = parseYes(displayRaw) || Boolean(displayLocalCode);
      if (displayCodeRaw && !displayLocalCode) rowIssues.push(makeIssue(rowNumber, "Display Area", "invalid_display_code", `${displayCodeRaw} is not a recognized display concept code.`, "warning"));
      if (displayRequired && !displayLocalCode && workbookKind === "campaign_planning") rowIssues.push(makeIssue(rowNumber, "Display Area", "display_code_missing", "Display is required but no cross-store display code was supplied.", "warning"));

      const ltoRaw = cellText(cells[indexes.lto]);
      const note = cellText(cells[indexes.notes]);
      const wholesaleLtoAmount = parseLtoAmount(ltoRaw);
      const ltoCode = parseTprCode(note) ?? (wholesaleLtoAmount === undefined && ltoRaw && ltoRaw.toLocaleUpperCase() !== "NA" ? ltoRaw : undefined);
      const source = sourceMetadata(cells, indexes, allocations, options.sourceSheet, rowNumber, sku, productName, rowIssues.map((issue) => issue.code), {
        sellingPrice, savings, salePrice, loyaltyPointsMultiplier, wholesaleLtoAmount, ltoCode, displayRequired, displayLocalCode,
      });
      const status = rowIssues.some((issue) => issue.code === "duplicate_sku") ? "duplicate"
        : !product ? "unmatched"
          : rowIssues.some((issue) => issue.severity === "error") ? "invalid" : "ready";
      rows.push({ rowNumber, sku, productName, product, status, displayLocalCode, displayRequired, allocations, source, issues: rowIssues });
      issues.push(...rowIssues);
    }

    const readyRows = rows.filter((row) => row.status === "ready");
    const placements = buildPlacements(readyRows, context.snapshot.stores, context.snapshot.displayAreas);
    placements.filter((placement) => placement.status === "SUGGESTED" || placement.status === "NEEDS_REVIEW").forEach((placement) => {
      issues.push(makeIssue(0, `${placement.store.name} / ${placement.displayLocalCode}`, "placement_exception", placement.reasons.join(" "), "warning"));
    });
    return {
      formatId: this.formatId, workbookKind, fingerprint: options.fingerprint, sourceFileName: options.sourceFileName,
      sourceSheet: options.sourceSheet, sheetNames: options.sheetNames ?? [options.sourceSheet], suggestedCampaign,
      rows, placements, issues, fatal: false,
    };
  }
}

export function toApplyCampaignWorkbookImport(
  result: FlyerWorkbookImportResult,
  campaign: Pick<NewCampaignInput, "name" | "type" | "description" | "startDate" | "endDate" | "owner" | "supplier">,
): ApplyCampaignWorkbookImportInput {
  const rows = result.rows.filter((row) => row.status === "ready" && row.product).map((row) => ({
    productId: row.product!.id,
    role: "Supporting" as const,
    required: true,
    note: row.source.additionalNotes,
    merchandisingState: row.displayLocalCode ? "DISPLAY_ASSIGNED" as const : row.displayRequired ? "UNASSIGNED" as const : result.workbookKind === "campaign_planning" ? "SHELF_SUPPORTED" as const : "UNASSIGNED" as const,
    displayLocalCode: row.displayLocalCode,
    source: row.source,
    allocations: row.allocations.map((allocation) => ({ storeId: allocation.store.id, quantityCases: allocation.quantityCases })),
  }));
  return {
    formatId: result.formatId,
    workbookKind: result.workbookKind,
    fingerprint: result.fingerprint,
    sourceFileName: result.sourceFileName,
    sourceSheet: result.sourceSheet,
    reviewRows: result.rows.map((row) => row.source),
    campaign,
    rows,
    placements: result.placements.map((placement) => ({
      displayLocalCode: placement.displayLocalCode, displayFamily: placement.displayFamily, storeId: placement.store.id,
      status: placement.status, displayAreaId: placement.displayArea?.id, suggestionDisplayAreaId: placement.suggestion?.id,
      suggestionReasons: placement.reasons,
    })),
  };
}

function detectWorkbookKind(headers: string[]): CampaignWorkbookKind | undefined {
  const normalized = headers.map(normalizeHeader);
  if (normalized[0] === "VENDOR" && normalized[2] === "SKU" && normalized[3] === "PRODUCT" && normalized.includes("SELLING PRICE")) return "flyer";
  if (normalized[0] === "VENDOR" && normalized[1] === "CATEGORY" && ["INV NUM", "SKU"].includes(normalized[2]) && normalized[3] === "PRODUCT") return "campaign_planning";
  return undefined;
}

function indexHeaders(headers: string[]) {
  return new Map(headers.map((header, index) => [normalizeHeader(header), index]));
}

interface ColumnIndexes {
  vendor: number; category: number; sku: number; product: number; orderFrom: number; lto: number; display: number;
  displayArea: number; sellingPrice: number; savings: number; salePrice: number; size: number; points: number; notes: number;
  flyerMonths: Array<{ index: number; month: string }>;
}

function flyerIndexes(headers: string[], index: Map<string, number>): ColumnIndexes {
  return {
    vendor: 0, category: 1, sku: 2, product: 3, orderFrom: -1, lto: index.get("LTOS") ?? 9, display: -1,
    displayArea: index.get("DISPLAY AREA") ?? -1, sellingPrice: index.get("SELLING PRICE") ?? 4,
    savings: index.get("SAVINGS") ?? 5, salePrice: index.get("SALE PRICE") ?? 6, size: index.get("SIZE") ?? 7,
    points: index.get("POINTS") ?? 8, notes: index.get("ADDITIONAL NOTES") ?? 10, flyerMonths: [],
  };
}

function planningIndexes(index: Map<string, number>): ColumnIndexes {
  const flyerMonths = [...index].filter(([header]) => header.endsWith(" FLYER")).map(([header, columnIndex]) => ({ index: columnIndex, month: header.replace(" FLYER", "") }));
  return {
    vendor: index.get("VENDOR") ?? 0, category: index.get("CATEGORY") ?? 1, sku: index.get("INV NUM") ?? index.get("SKU") ?? 2,
    product: index.get("PRODUCT") ?? 3, orderFrom: index.get("ORDER FROM") ?? -1, lto: index.get("LTO MONTH") ?? -1,
    display: index.get("DISPLAY") ?? -1, displayArea: index.get("DISPLAY AREA") ?? -1,
    sellingPrice: index.get("SELLING PRICE") ?? -1, savings: index.get("SAVINGS") ?? -1, salePrice: index.get("SALE PRICE") ?? -1,
    size: index.get("SIZE") ?? -1, points: index.get("POINTS") ?? -1,
    notes: index.get("ADDITIONAL NOTES") ?? index.get("NOTES") ?? -1, flyerMonths,
  };
}

function sourceMetadata(
  cells: unknown[], indexes: ColumnIndexes,
  allocations: FlyerWorkbookReviewRow["allocations"], sourceSheet: string, sourceRow: number, skuRaw: string,
  productName: string, issueCodes: string[], overrides: Partial<CampaignImportRowMetadata> = {},
): CampaignImportRowMetadata {
  return {
    sourceSheet, sourceRow, skuRaw, productName,
    vendor: valueAt(cells, indexes.vendor), category: valueAt(cells, indexes.category), size: valueAt(cells, indexes.size),
    additionalNotes: valueAt(cells, indexes.notes), orderFrom: valueAt(cells, indexes.orderFrom),
    flyerMonths: indexes.flyerMonths.filter(({ index }) => parseYes(cells[index])).map(({ month }) => month),
    allocations: allocations.map((allocation) => ({ sourceColumn: allocation.sourceColumn, sourceStoreName: allocation.store.name, storeId: allocation.store.id, quantityCases: allocation.quantityCases, sourceCell: allocation.sourceCell })),
    issues: issueCodes,
    ...overrides,
  };
}

function resolveStoreColumns(headers: string[], stores: Store[]) {
  return headers.flatMap((header, index) => {
    const normalized = normalizeHeader(header);
    const alias = STORE_ALIASES[normalized];
    const store = stores.find((candidate) => normalizeHeader(candidate.name) === normalizeHeader(alias ?? header) || normalizeHeader(candidate.code) === normalized);
    return store ? [{ index, store, sourceHeader: header }] : [];
  });
}

function buildPlacements(rows: FlyerWorkbookReviewRow[], stores: Store[], areas: DisplayArea[]): FlyerWorkbookPlacementReview[] {
  const codes = [...new Set(rows.map((row) => row.displayLocalCode).filter((code): code is string => Boolean(code)))];
  const participatingStoreIds = new Set(rows.flatMap((row) => row.allocations.map((allocation) => allocation.store.id)));
  const reserved = new Map<string, Set<string>>();
  const results: FlyerWorkbookPlacementReview[] = [];

  for (const store of stores.filter((candidate) => participatingStoreIds.has(candidate.id))) {
    const storeAreas = areas.filter((area) => area.storeId === store.id && area.active && area.verificationStatus === "verified");
    const exactByCode = new Map(storeAreas.map((area) => [normalizeHeader(area.localCode ?? area.displayNumber), area]));
    reserved.set(store.id, new Set(codes.map((code) => exactByCode.get(normalizeHeader(code))?.id).filter((id): id is string => Boolean(id))));
  }

  for (const code of codes) {
    const codeRows = rows.filter((row) => row.displayLocalCode === code);
    const displayFamily = displayFamilyForCode(code);
    for (const store of stores.filter((candidate) => participatingStoreIds.has(candidate.id))) {
      const allocations = codeRows.flatMap((row) => row.allocations.filter((allocation) => allocation.store.id === store.id));
      const caseQuantity = allocations.reduce((sum, allocation) => sum + allocation.quantityCases, 0);
      if (!caseQuantity) {
        results.push({ displayLocalCode: code, displayFamily, store, status: "EXCLUDED", reasons: ["No products in this display have a store allocation."], productCount: 0, caseQuantity: 0 });
        continue;
      }
      const storeAreas = areas.filter((area) => area.storeId === store.id && area.active && area.verificationStatus === "verified");
      const exact = storeAreas.find((area) => normalizeHeader(area.localCode ?? area.displayNumber) === normalizeHeader(code) || normalizeHeader(area.code) === normalizeHeader(code));
      if (exact) {
        results.push({ displayLocalCode: code, displayFamily, store, status: "ASSIGNED", displayArea: exact, reasons: [`Exact store-local code ${code} exists.`], productCount: allocations.length, caseQuantity });
        continue;
      }
      const used = reserved.get(store.id) ?? new Set<string>();
      const available = storeAreas.filter((area) => !used.has(area.id));
      const suggestion = available.find((area) => area.displayFamily === displayFamily)
        ?? available.find((area) => area.displayFamily === "MULTI" || area.flexible)
        ?? available[0];
      if (suggestion) used.add(suggestion.id);
      const reasons = suggestion
        ? [`${code} does not exist at ${store.name}.`, suggestion.displayFamily === displayFamily ? `Suggested unused ${displayFamily} area ${suggestion.localCode ?? suggestion.displayNumber}.` : `Suggested repurposing ${suggestion.localCode ?? suggestion.displayNumber}; category compatibility requires review.`]
        : [`${code} does not exist at ${store.name}.`, "No unused display area is available; mark this display optional or choose a replacement."];
      results.push({ displayLocalCode: code, displayFamily, store, status: suggestion ? "SUGGESTED" : "NEEDS_REVIEW", suggestion, reasons, productCount: allocations.length, caseQuantity });
    }
  }
  return results;
}

function inferCampaign(fileName: string, kind?: CampaignWorkbookKind): FlyerWorkbookImportResult["suggestedCampaign"] {
  const match = fileName.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b[^0-9]*(20\d{2})/i);
  const monthIndex = match ? ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(match[1].toLocaleLowerCase()) : -1;
  const year = match ? Number(match[2]) : new Date().getUTCFullYear();
  const startDate = monthIndex >= 0 ? isoDate(year, monthIndex + 1, 1) : `${year}-10-01`;
  const endDate = monthIndex >= 0 ? isoDate(year, monthIndex + 2, 0) : `${year}-12-31`;
  const baseName = fileName.replace(/\.xlsx$/i, "").trim();
  return {
    name: baseName, type: kind === "campaign_planning" && /\bOND\b/i.test(fileName) ? "OND" : "Monthly flyer",
    description: `Imported from ${fileName}.`, startDate, endDate, owner: "Jeremy", supplier: "Multiple vendors",
  };
}

function chooseProductSheet(sheetNames: string[]) {
  return sheetNames.find((name) => /flyer|worksheet|plan/i.test(name)) ?? sheetNames[0];
}

function normalizeDisplayCode(value: string, areas: DisplayArea[]) {
  const normalized = normalizeHeader(value);
  if (!normalized) return undefined;
  const exactArea = areas.find((area) => normalizeHeader(area.code) === normalized);
  if (exactArea) return normalizeHeader(exactArea.localCode ?? exactArea.displayNumber);
  if (/^(BR|M|W)\d+$/.test(normalized) || ["ST", "SEASONAL", "SEASONAL-END"].includes(normalized)) return normalized;
  return undefined;
}

function displayFamilyForCode(code: string): DisplayFamily {
  if (code.startsWith("BR")) return "BEER_RTD";
  if (code.startsWith("W")) return "WINE";
  if (code === "ST" || code.startsWith("SEASONAL")) return "SEASONAL";
  return "MULTI";
}

function parseTprCode(notes: string) { return notes.match(/\bTPR\s+([A-Z]+)\b/i)?.[0].toLocaleUpperCase(); }
function parseLtoAmount(value: string) { const amount = parseMoney(value); return amount !== undefined && amount >= 0 ? amount : undefined; }
function parsePoints(value: string) { const match = value.match(/^\s*(\d+(?:\.\d+)?)\s*[xX]\s*$/); return match ? Number(match[1]) : undefined; }
function parseYes(value: unknown) { return ["Y", "YES", "TRUE", "1"].includes(cellText(value).toLocaleUpperCase()); }
function parseWholeNumber(value: unknown) { if (value === null || value === undefined || cellText(value) === "") return 0; const number = typeof value === "number" ? value : Number(cellText(value)); return Number.isInteger(number) && number >= 0 ? number : undefined; }
function parseMoney(value: unknown) { if (value === null || value === undefined || cellText(value) === "") return undefined; const number = typeof value === "number" ? value : Number(cellText(value).replace(/[$,]/g, "")); return Number.isFinite(number) ? number : undefined; }
function normalizeSku(value: unknown) { return cellText(value).replace(/\s+/g, "").toLocaleUpperCase(); }
function normalizeHeader(value: unknown) { return cellText(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLocaleUpperCase(); }
function cellText(value: unknown) { return value === null || value === undefined ? "" : String(value).replace(/\u00a0/g, " ").trim(); }
function valueAt(cells: unknown[], index: number) { const value = index >= 0 ? cellText(cells[index]) : ""; return value || undefined; }
function columnName(index: number) { let value = index + 1; let name = ""; while (value > 0) { value -= 1; name = String.fromCharCode(65 + (value % 26)) + name; value = Math.floor(value / 26); } return name; }
function isoDate(year: number, month: number, day: number) { return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10); }
function makeIssue(row: number, field: string, code: string, message: string, severity: ImportIssue["severity"]): ImportIssue { return { row, field, code, message, severity }; }

async function sha256(file: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
