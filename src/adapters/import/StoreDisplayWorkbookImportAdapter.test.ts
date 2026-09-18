import { describe, expect, it } from "vitest";
import { MockMerchandisingRepository } from "../mock/MockMerchandisingRepository";
import { seedSnapshot } from "../mock/seed";
import { MockProductMasterLookup } from "../mock/MockProductMasterLookup";
import { StoreDisplayWorkbookImportAdapter, toApplyStoreDisplayWorkbookImport } from "./StoreDisplayWorkbookImportAdapter";
import type { Product } from "../../domain/types";
import { buildStoreExecutionPack } from "../../domain/storeExecutionPack";
import { productMasterStatusLabel } from "../../domain/productMaster";
import { campaignProductReadiness } from "../../features/campaigns/campaignWorkflow";

const headers = ["Vendor", "Category", "INV_NUM", "Product", "Display", "Case QTY", "Display Notes"];

function row(values: string[]) { return values; }

describe("store display workbook importer", () => {
  it("imports known store sheets, retains pending products, and flags N as a temporary source marker", async () => {
    const data = structuredClone(seedSnapshot);
    const crown = data.stores.find((store) => store.name === "Crown Isle")!;
    const caddy = data.stores.find((store) => store.name === "Caddy Bay")!;
    const crownArea = data.displayAreas.find((area) => area.storeId === crown.id && area.active && area.localCode)!
    const caddyArea = data.displayAreas.find((area) => area.storeId === caddy.id && area.active && area.localCode)!
    const active: Product = { id: "product-active", sku: "1001", name: "Active product", category: "Wine", masterStatus: "verified", active: true, synthetic: false };
    const adapter = new StoreDisplayWorkbookImportAdapter();
    const result = await adapter.parseSheets([
      { sheet: "Courtenay", rows: [headers, row(["Vendor A", "Wine", "1001", "Active product", crownArea.localCode!, "2", "Build together"]), row(["Vendor B", "Wine", "9999", "New product", "N", "1", ""]) ] },
      { sheet: "Caddy Bay", rows: [headers, row(["Vendor C", "Beer", "", "Pending no SKU", caddyArea.localCode!, "3", "Build together"]) ] },
      { sheet: "Mystery Store", rows: [headers, row(["Vendor D", "Wine", "1001", "Ignored store", "W1", "1", ""]) ] },
    ], { snapshot: { stores: data.stores, displayAreas: data.displayAreas, products: [active] }, productMaster: new MockProductMasterLookup([active]) }, { sourceFileName: "OND 2026 Store Displays.xlsx", fingerprint: "fixture" });

    expect(result.rows).toHaveLength(4);
    expect(result.rows.find((item) => item.productName === "New product")).toMatchObject({ productResolution: "PENDING", displaySourceValue: "N", temporaryDisplayMarker: "N", status: "pending" });
    expect(result.rows.find((item) => item.productName === "Pending no SKU")).toMatchObject({ productResolution: "PENDING", displayInterpretation: "ASSIGNED" });
    expect(result.rows.find((item) => item.sheet === "Mystery Store")?.status).toBe("invalid");
    expect(result.issues.some((item) => item.code === "unknown_store_sheet")).toBe(true);
  });

  it("requires an explicit Sheet1 mapping and maps the Courtenay alias to Crown Isle only when selected", async () => {
    const data = structuredClone(seedSnapshot); const crown = data.stores.find((store) => store.name === "Crown Isle")!;
    const area = data.displayAreas.find((item) => item.storeId === crown.id && item.active && item.localCode)!;
    const product: Product = { id: "product-sheet1", sku: "3001", name: "Mapped product", category: "Wine", masterStatus: "verified", active: true, synthetic: false };
    const adapter = new StoreDisplayWorkbookImportAdapter();
    const context = { snapshot: { stores: data.stores, displayAreas: data.displayAreas, products: [product] }, productMaster: new MockProductMasterLookup([product]) };
    const withoutMapping = await adapter.parseSheets([{ sheet: "Sheet1", rows: [headers, row(["Vendor", "Wine", "3001", "Mapped product", area.localCode!, "1", ""]) ] }], context, { sourceFileName: "Courtenay.xlsx", fingerprint: "sheet1" });
    expect(withoutMapping.rows[0]).toMatchObject({ status: "invalid", store: undefined });
    const withMapping = await adapter.parseSheets([{ sheet: "Sheet1", rows: [headers, row(["Vendor", "Wine", "3001", "Mapped product", area.localCode!, "1", ""]) ] }], context, { sourceFileName: "Courtenay.xlsx", fingerprint: "sheet1" }, { Sheet1: crown.id });
    expect(withMapping.rows[0]).toMatchObject({ status: "ready", store: { id: crown.id, name: "Crown Isle" }, displayArea: { id: area.id } });
  });

  it("collapses identical display notes and flags conflicting non-empty notes", async () => {
    const data = structuredClone(seedSnapshot); const crown = data.stores.find((store) => store.name === "Crown Isle")!;
    const area = data.displayAreas.find((item) => item.storeId === crown.id && item.active && item.localCode)!;
    const product: Product = { id: "product-note", sku: "2001", name: "Note product", category: "Wine", masterStatus: "verified", active: true, synthetic: false };
    const adapter = new StoreDisplayWorkbookImportAdapter();
    const result = await adapter.parseSheets([{ sheet: "Crown Isle", rows: [headers,
      row(["A", "Wine", "2001", "Note product", area.localCode!, "2", "Keep together"]),
      row(["A", "Wine", "2002", "Another product", area.localCode!, "2", "Keep together"]),
      row(["A", "Wine", "2003", "Third product", area.localCode!, "2", "Face forward"]),
    ] }], { snapshot: { stores: data.stores, displayAreas: data.displayAreas, products: [product] }, productMaster: new MockProductMasterLookup([product]) }, { sourceFileName: "notes.xlsx", fingerprint: "notes" });
    const note = result.displayNotes[0];
    expect(note).toMatchObject({ displayLocalCode: area.localCode, hasConflict: true });
    expect(note.executionNotes).toBeUndefined();
  });

  it("keeps a pending product plannable and exact-SKU reconciliation preserves its assignment", async () => {
    const repository = new MockMerchandisingRepository(undefined, structuredClone(seedSnapshot), false);
    const before = await repository.load(); const crown = before.stores.find((store) => store.name === "Crown Isle")!;
    const area = before.displayAreas.find((item) => item.storeId === crown.id && item.active && item.localCode)!;
    const adapter = new StoreDisplayWorkbookImportAdapter();
    const result = await adapter.parseSheets([{ sheet: "Crown Isle", rows: [headers, row(["Vendor", "Wine", "765432", "Future wine", area.localCode!, "4", "Pending build note"]) ] }],
      { snapshot: { stores: before.stores, displayAreas: before.displayAreas, products: before.products }, productMaster: new MockProductMasterLookup(before.products) }, { sourceFileName: "pending.xlsx", fingerprint: "pending" });
    const campaignId = await repository.createCampaign({ name: "OND 2026", type: "OND", description: "", startDate: "2026-10-01", endDate: "2026-12-31", owner: "Jeremy", supplier: "", products: [] });
    await repository.applyStoreDisplayWorkbook(toApplyStoreDisplayWorkbookImport(result, campaignId));
    const imported = await repository.load(); const campaign = imported.campaigns.find((item) => item.id === campaignId)!;
    const pending = campaign.products.find((item) => item.productResolution === "PENDING")!;
    const assignment = imported.campaignDisplayAssignments.find((item) => item.campaignId === campaignId && item.storeId === crown.id)!;
    expect(assignment.status).toBe("ASSIGNED");
    expect(imported.campaignDisplayAssignmentProducts.some((item) => item.campaignDisplayAssignmentId === assignment.id && item.productId === pending.productId)).toBe(true);
    const pack = buildStoreExecutionPack(imported, campaignId, crown.id)!;
    expect(pack.builds).toHaveLength(1);
    expect(pack.builds[0].notes).toContain("Pending build note");
    expect(pack.builds[0].products[0]).toMatchObject({ productResolution: "PENDING", cases: 4 });
    const authoritative: Product = { id: "authoritative-future-wine", sku: "765432", name: "Future wine", category: "Wine", masterStatus: "verified", active: true, synthetic: false };
    repository.replaceSnapshot({ ...imported, products: [...imported.products, authoritative] });
    await repository.reconcilePendingCampaignProduct({ campaignId, campaignProductId: pending.id, productId: authoritative.id });
    const reconciled = (await repository.load()).campaigns.find((item) => item.id === campaignId)!.products.find((item) => item.id === pending.id)!;
    expect(reconciled).toMatchObject({ productId: authoritative.id, productResolution: "MATCHED_ACTIVE" });
    expect((await repository.load()).campaignDisplayAssignmentProducts.some((item) => item.campaignDisplayAssignmentId === assignment.id && item.productId === authoritative.id)).toBe(true);
  });

  it("blocks Apply when a temporary N source marker remains", async () => {
    const repository = new MockMerchandisingRepository(undefined, structuredClone(seedSnapshot), false);
    const before = await repository.load();
    const adapter = new StoreDisplayWorkbookImportAdapter();
    const result = await adapter.parseSheets([{ sheet: "Crown Isle", rows: [headers, row(["Vendor", "Wine", "888888", "Ambiguous source product", "N", "2", ""]) ] }],
      { snapshot: { stores: before.stores, displayAreas: before.displayAreas, products: before.products }, productMaster: new MockProductMasterLookup(before.products) }, { sourceFileName: "n.xlsx", fingerprint: "n" });
    expect(result.rows[0]).toMatchObject({ temporaryDisplayMarker: "N", displayArea: undefined });
    expect(() => toApplyStoreDisplayWorkbookImport(result, "campaign-id")).toThrow("temporary N display marker");
    expect((await repository.load()).campaignImports).toHaveLength(0);
  });

  it("accepts blank INV_NUM and omitted trailing Display Notes cells", async () => {
    const data = structuredClone(seedSnapshot);
    const crown = data.stores.find((store) => store.name === "Crown Isle")!;
    const area = data.displayAreas.find((item) => item.storeId === crown.id && item.active && item.localCode)!;
    const adapter = new StoreDisplayWorkbookImportAdapter();

    const result = await adapter.parseSheets([{
      sheet: "Crown Isle",
      rows: [headers, ["Vendor", "Wine", undefined, "Future wine", area.localCode!, 2]],
    }], {
      snapshot: { stores: data.stores, displayAreas: data.displayAreas, products: data.products },
      productMaster: new MockProductMasterLookup(data.products),
    }, { sourceFileName: "blank-cells.xlsx", fingerprint: "blank-cells" });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      sku: "",
      displayNotes: undefined,
      productResolution: "PENDING",
      status: "pending",
    });
    expect(result.rows[0].product).toMatchObject({ masterStatus: "pending", active: true });
    expect(result.issues.some((item) => item.code === "missing_sku")).toBe(true);
  });

  it("surfaces invalid headers as a blocking workbook error", async () => {
    const data = structuredClone(seedSnapshot);
    const adapter = new StoreDisplayWorkbookImportAdapter();
    const result = await adapter.parseSheets([{
      sheet: "Crown Isle",
      rows: [["Vendor", "Category", "INV_NUM", "Product", "Display Code", "Case QTY", "Display Notes"]],
    }], {
      snapshot: { stores: data.stores, displayAreas: data.displayAreas, products: data.products },
      productMaster: new MockProductMasterLookup(data.products),
    }, { sourceFileName: "invalid-header.xlsx", fingerprint: "invalid-header" });

    expect(result.rows).toHaveLength(0);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "missing_store_display_headers",
      severity: "error",
      message: expect.stringContaining("DISPLAY"),
    }));
    expect(() => toApplyStoreDisplayWorkbookImport(result, "campaign-id")).toThrow("workbook error");
  });

  it("keeps pending products pending after Apply", async () => {
    const repository = new MockMerchandisingRepository(undefined, structuredClone(seedSnapshot), false);
    const before = await repository.load();
    const crown = before.stores.find((store) => store.name === "Crown Isle")!;
    const area = before.displayAreas.find((item) => item.storeId === crown.id && item.active && item.localCode)!;
    const adapter = new StoreDisplayWorkbookImportAdapter();
    const result = await adapter.parseSheets([{
      sheet: "Crown Isle",
      rows: [headers, ["Vendor", "Wine", "", "Future wine", area.localCode!, 2, ""]],
    }], {
      snapshot: { stores: before.stores, displayAreas: before.displayAreas, products: before.products },
      productMaster: new MockProductMasterLookup(before.products),
    }, { sourceFileName: "pending-status.xlsx", fingerprint: "pending-status" });
    const campaignId = await repository.createCampaign({ name: "OND pending test", type: "OND", description: "", startDate: "2026-10-01", endDate: "2026-12-31", owner: "Jeremy", supplier: "", products: [] });

    await repository.applyStoreDisplayWorkbook(toApplyStoreDisplayWorkbookImport(result, campaignId));
    const after = await repository.load();
    const campaign = after.campaigns.find((item) => item.id === campaignId)!;
    const product = after.products.find((item) => item.id === campaign.products[0].productId)!;

    expect(productMasterStatusLabel(product)).toBe("New · Needs Product Master Review");
    expect(campaignProductReadiness(campaign, after)).toMatchObject({ pending: 1, inactive: 0 });
  });
});
