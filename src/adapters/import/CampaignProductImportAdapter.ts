import readXlsxFile from "read-excel-file";
import type { CampaignProduct, Product, ProductRole } from "../../domain/types";
import type { ImportAdapter, ImportIssue } from "../../services/imports/contracts";

export const CAMPAIGN_PRODUCT_IMPORT_HEADERS = ["SKU", "Role", "Required", "Notes"] as const;

export interface CampaignProductImportContext {
  products: Product[];
  campaignProducts: CampaignProduct[];
}

export interface CampaignProductImportRow {
  rowNumber: number;
  sku: string;
  role?: ProductRole;
  required?: boolean;
  note?: string;
  product?: Product;
  status: "matched" | "duplicate" | "pending" | "invalid";
  issues: ImportIssue[];
}

export interface CampaignProductImportResult {
  formatId: "campaign-product-v1";
  rows: CampaignProductImportRow[];
  issues: ImportIssue[];
  sourceRows: unknown[][];
}

export class CampaignProductImportAdapter implements ImportAdapter<CampaignProductImportContext, CampaignProductImportResult> {
  readonly formatId = "campaign-product-v1" as const;
  readonly acceptedExtensions = [".xlsx"];

  async parse(file: Blob, context: CampaignProductImportContext) {
    return this.parseRows(await readXlsxFile(file), context);
  }

  parseRows(sourceRows: unknown[][], context: CampaignProductImportContext): CampaignProductImportResult {
    const headers = (sourceRows[0] ?? []).map(cellText);
    if (headers.length !== CAMPAIGN_PRODUCT_IMPORT_HEADERS.length || CAMPAIGN_PRODUCT_IMPORT_HEADERS.some((header, index) => headers[index] !== header)) {
      return { formatId: this.formatId, rows: [], issues: [{ row: 1, field: "header", code: "invalid_headers", severity: "error", message: `Expected exactly: ${CAMPAIGN_PRODUCT_IMPORT_HEADERS.join(" | ")}.` }], sourceRows };
    }
    const catalogBySku = new Map(context.products.map((product) => [product.sku.toLocaleLowerCase(), product]));
    const addedProductIds = new Set(context.campaignProducts.map((product) => product.productId));
    const seen = new Set<string>();
    const rows: CampaignProductImportRow[] = [];
    const issues: ImportIssue[] = [];

    for (let index = 1; index < sourceRows.length; index += 1) {
      const cells = sourceRows[index] ?? [];
      if (cells.every((cell) => cellText(cell) === "")) continue;
      const rowNumber = index + 1;
      const sku = cellText(cells[0]);
      const role = parseRole(cells[1]);
      const required = parseRequired(cells[2]);
      const rowIssues: ImportIssue[] = [];
      const addIssue = (field: string, code: string, message: string) => rowIssues.push({ row: rowNumber, field, code, severity: "error", message });
      if (!isValidSku(sku)) addIssue("SKU", "invalid_sku", "SKU must use letters, numbers, periods, underscores, or hyphens.");
      if (!role) addIssue("Role", "invalid_role", "Role must be Feature, Core, Supporting, or Optional.");
      if (required === undefined) addIssue("Required", "invalid_required", "Required must be yes/no, true/false, required, or optional.");
      const product = catalogBySku.get(sku.toLocaleLowerCase());
      const identity = product?.id ?? sku.toLocaleLowerCase();
      if (seen.has(identity)) addIssue("SKU", "duplicate_sku", "This SKU appears more than once in the workbook.");
      seen.add(identity);
      if (product && addedProductIds.has(product.id)) addIssue("SKU", "already_added", "This product already belongs to the campaign.");
      const status = rowIssues.some((issue) => issue.code === "duplicate_sku" || issue.code === "already_added") ? "duplicate"
        : rowIssues.length ? "invalid"
          : product ? "matched" : "pending";
      const row = { rowNumber, sku, role, required, note: cellText(cells[3]) || undefined, product, status, issues: rowIssues } satisfies CampaignProductImportRow;
      rows.push(row);
      issues.push(...rowIssues);
    }
    return { formatId: this.formatId, rows, issues, sourceRows };
  }
}

function cellText(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }
function isValidSku(sku: string) { return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(sku); }
function parseRole(value: unknown): ProductRole | undefined {
  const role = cellText(value) || "Supporting";
  return (["Feature", "Core", "Supporting", "Optional"] as const).includes(role as ProductRole) ? role as ProductRole : undefined;
}
function parseRequired(value: unknown): boolean | undefined {
  const normalized = cellText(value).toLocaleLowerCase();
  if (!normalized || normalized === "yes" || normalized === "true" || normalized === "required") return true;
  if (normalized === "no" || normalized === "false" || normalized === "optional") return false;
  return undefined;
}
