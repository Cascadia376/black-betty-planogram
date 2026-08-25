import { describe, expect, it } from "vitest";
import { createCascadiaOndWorkbook } from "../../../tests/fixtures/cascadiaOndWorkbook";
import { cascadiaOndRows as fixture } from "../../../tests/fixtures/cascadiaOndRows";
import { IDS, seedSnapshot } from "../mock/seed";
import { CASCADIA_OND_HEADERS, CascadiaOndAllocationImportAdapter } from "./CascadiaOndAllocationImportAdapter";

const adapter = new CascadiaOndAllocationImportAdapter();
const context = { programId: IDS.ondProgram, snapshot: seedSnapshot };

describe("Cascadia OND allocation import adapter", () => {
  it("parses the known .xlsx fixture through the browser adapter", async () => {
    const workbook = new Blob([Uint8Array.from(createCascadiaOndWorkbook())], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const result = await adapter.parse(workbook, context);
    expect(result.issues).toEqual([]);
    expect(result.rows).toHaveLength(3);
  });

  it("normalizes the known workbook rows into assignments, products, and supplier options", () => {
    const result = adapter.parseRows(fixture, context);
    expect(result.issues).toEqual([]);
    expect(result.rows.every((row) => row.status === "ready")).toBe(true);
    expect(result.batch.program.name).toBe("OND 2026");
    expect(result.batch.assignments).toHaveLength(2);
    expect(result.batch.assignments[0].assignment).toEqual(expect.objectContaining({ storeId: IDS.eagleStore, displayAreaId: IDS.eagleEndcapA, resetRequired: true, periodId: IDS.ondEarlyPeriod }));
    expect(result.batch.assignments[0].products.map((product) => product.caseQuantity)).toEqual([18, 6]);
    expect(result.batch.supplierProductOptions.some((option) => option.productId === IDS.ondHolidayProduct && option.supplierId === IDS.ondPreferredSupplier)).toBe(true);
  });

  it("resolves SKUs from the product master without requiring prior allocations", () => {
    const snapshot = structuredClone(seedSnapshot);
    snapshot.displayAssignmentProducts = [];
    const result = adapter.parseRows(fixture, { programId: IDS.ondProgram, snapshot });
    expect(result.issues).toEqual([]);
    expect(result.batch.assignments.flatMap((item) => item.products)).toHaveLength(3);
  });

  it("rejects a workbook whose headers do not exactly match the known format", () => {
    const rows = [[...CASCADIA_OND_HEADERS.slice(0, -1), "Notes"], ...fixture.slice(1)];
    const result = adapter.parseRows(rows, context);
    expect(result.issues).toEqual([expect.objectContaining({ code: "invalid_headers", severity: "error" })]);
    expect(result.batch.assignments).toEqual([]);
  });

  it("flags unknown displays, SKUs, quantities, vendors, and ambiguous dates", () => {
    const rows = [fixture[0], ["OND 2026", "Eagle Creek", "17", "UNKNOWN", "Unknown product", "many", "Unknown vendor", "Oct 1", "2026-11-11", "Nov 12", "Reset Nov 12"]];
    const result = adapter.parseRows(rows, context);
    expect(new Set(result.issues.map((issue) => issue.code))).toEqual(new Set(["invalid_display_number", "unknown_sku", "invalid_case_quantity", "unknown_vendor", "ambiguous_start_date", "ambiguous_reset_date", "unparsed_timing_note"]));
    expect(result.rows[0].status).toBe("error");
    expect(result.batch.assignments).toEqual([]);
  });

  it("flags timing mentioned only in promo notes instead of inferring it", () => {
    const row = [...fixture[1]];
    row[9] = "";
    row[10] = "Reset Nov 12 for holiday assortment";
    const result = adapter.parseRows([fixture[0], row], context);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "unparsed_timing_note", severity: "warning" }));
    expect(result.rows[0].status).toBe("review");
  });

  it("clears a timing warning after the reset date is explicitly structured", () => {
    const row = [...fixture[1]];
    row[9] = "";
    row[10] = "Reset Nov 12 for holiday assortment";
    const warning = adapter.parseRows([fixture[0], row], context);
    expect(warning.rows[0].status).toBe("review");

    row[9] = "2026-11-12";
    const resolved = adapter.parseRows([fixture[0], row], context);
    expect(resolved.issues).toEqual([]);
    expect(resolved.rows[0].status).toBe("ready");
    expect(resolved.batch.assignments[0].assignment.resetRequired).toBe(true);
  });
});
