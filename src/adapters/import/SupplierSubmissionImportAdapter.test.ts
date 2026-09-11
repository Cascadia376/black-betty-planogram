import { beforeEach, describe, expect, it } from "vitest";
import { MockMerchandisingRepository } from "../mock/MockMerchandisingRepository";
import { MockProductMasterLookup } from "../mock/MockProductMasterLookup";
import { seedSnapshot } from "../mock/seed";
import type { ProductMasterLookup } from "../../services/products/ProductMasterLookup";
import { createSupplierSubmissionWorkbook, supplierSubmissionHeaders, supplierSubmissionRows } from "../../../tests/fixtures/supplierSubmissionWorkbook";
import { SupplierSubmissionImportAdapter, supplierSubmissionImportKey, toApplySupplierSubmissionImport } from "./SupplierSubmissionImportAdapter";

const adapter = new SupplierSubmissionImportAdapter();
const context = { productMaster: new MockProductMasterLookup(seedSnapshot.products) };
const options = { sourceFileName: "Mock Coast October Submission.xlsx", sourceSheet: "Supplier Submission", fingerprint: "supplier-sha" };

function row(overrides: Record<number, string | number> = {}) {
  const values = [...supplierSubmissionRows[1]];
  Object.entries(overrides).forEach(([index, value]) => { values[Number(index)] = value; });
  return values;
}

describe("SupplierSubmissionImportV1", () => {
  beforeEach(() => window.localStorage.clear());

  it("detects the XLSX template and retains structured promotion, commitments, and provenance", async () => {
    const bytes = createSupplierSubmissionWorkbook();
    const file = new File([bytes.slice().buffer], "Mock Coast October Submission.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const result = await adapter.parse(file, context);
    expect(result).toMatchObject({ fatal: false, supplier: "Mock Coast", sourceSheet: "Supplier Submission", proposedStartDate: "2026-10-01", proposedEndDate: "2026-10-31" });
    expect(result.rows[0]).toMatchObject({ status: "ready", opportunityStatus: "READY_FOR_REVIEW", product: { sku: "MOCK-1001" }, opportunity: {
      authoritativeCategory: "Beer", supplierCategory: "WINE", promotionEvidence: { wholesaleLto: 2, tpr: "TPR ON", proposedRetail: 18.99, flyerRequest: "October", points: "2X" },
      commercialTerms: { caseCommitment: 12, minimumOrder: 4, preorderRequired: true, marketingSupport: "Social posts", assetsAvailable: true },
      merchandisingRequest: { displayRequested: true, requestedDisplayFamily: "BEER_RTD", requestedDisplayCount: 2 },
      availability: { availableFrom: "2026-09-20", quantity: 100, restrictions: "Island only", storesOrRegions: "Vancouver Island" },
      supplierEvidence: { claims: "Strong fall seller", notes: "Preorder by September 15", rawText: "Rep email summary" },
    } });
    expect(result.rows[0].provenance).toMatchObject({ workbookSha256: expect.stringMatching(/^[a-f0-9]{64}$/), row: 2, productMatchMethod: "EXACT_SKU", sourceValues: { Supplier: "Mock Coast", SKU: "MOCK-1001" } });
  });

  it("accepts only deterministic structured boolean values and flags populated invalid values", async () => {
    const cases = [
      { index: 17, raw: "YES", normalizedKey: "preorderRequired", expected: true },
      { index: 17, raw: "NO", normalizedKey: "preorderRequired", expected: false },
      { index: 17, raw: "", normalizedKey: "preorderRequired", expected: undefined },
      { index: 17, raw: "Maybe", normalizedKey: "preorderRequired", issue: "invalid_preorder" },
      { index: 19, raw: "Y", normalizedKey: "displayRequested", expected: true },
      { index: 19, raw: "N", normalizedKey: "displayRequested", expected: false },
      { index: 19, raw: "Required", normalizedKey: "displayRequested", issue: "invalid_display_requested" },
      { index: 25, raw: "TRUE", normalizedKey: "assetsAvailable", expected: true },
      { index: 25, raw: "FALSE", normalizedKey: "assetsAvailable", expected: false },
      { index: 25, raw: "Unknown", normalizedKey: "assetsAvailable", issue: "invalid_assets_available" },
    ];

    for (const testCase of cases) {
      const result = await adapter.parseRows([supplierSubmissionHeaders, row({ [testCase.index]: testCase.raw })], context, options);
      const reviewRow = result.rows[0];
      const normalized = reviewRow.provenance.normalizedValues[testCase.normalizedKey];
      if (testCase.issue) {
        expect(reviewRow).toMatchObject({ status: "needs_review", opportunityStatus: "NEEDS_REVIEW" });
        expect(reviewRow.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: testCase.issue, severity: "error" })]));
        expect(normalized).toBeNull();
        expect(reviewRow.provenance.sourceValues[supplierSubmissionHeaders[testCase.index]]).toBe(testCase.raw);
      } else {
        expect(reviewRow.status).toBe("ready");
        expect(normalized).toBe(testCase.expected ?? null);
      }
    }
  });

  it("requires display count and available quantity to be non-negative whole numbers", async () => {
    const cases = [
      { index: 21, raw: 2, normalizedKey: "requestedDisplayCount", expected: 2 },
      { index: 21, raw: "", normalizedKey: "requestedDisplayCount", expected: undefined },
      { index: 21, raw: "two", normalizedKey: "requestedDisplayCount", issue: "invalid_display_count" },
      { index: 21, raw: 1.5, normalizedKey: "requestedDisplayCount", issue: "invalid_display_count" },
      { index: 21, raw: -1, normalizedKey: "requestedDisplayCount", issue: "invalid_display_count" },
      { index: 27, raw: 100, normalizedKey: "availabilityQuantity", expected: 100 },
      { index: 27, raw: "", normalizedKey: "availabilityQuantity", expected: undefined },
      { index: 27, raw: "TBD", normalizedKey: "availabilityQuantity", issue: "invalid_available_quantity" },
      { index: 27, raw: 3.5, normalizedKey: "availabilityQuantity", issue: "invalid_available_quantity" },
      { index: 27, raw: -5, normalizedKey: "availabilityQuantity", issue: "invalid_available_quantity" },
    ];

    for (const testCase of cases) {
      const result = await adapter.parseRows([supplierSubmissionHeaders, row({ [testCase.index]: testCase.raw })], context, options);
      const reviewRow = result.rows[0];
      const normalized = reviewRow.provenance.normalizedValues[testCase.normalizedKey];
      if (testCase.issue) {
        expect(reviewRow).toMatchObject({ status: "needs_review", opportunityStatus: "NEEDS_REVIEW" });
        expect(reviewRow.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: testCase.issue, severity: "error" })]));
        expect(normalized).toBeNull();
        expect(reviewRow.provenance.sourceValues[supplierSubmissionHeaders[testCase.index]]).toBe(String(testCase.raw));
      } else {
        expect(reviewRow.status).toBe("ready");
        expect(normalized).toBe(testCase.expected ?? null);
      }
    }
  });

  it("retains provenance but skips actionable opportunities for every new structured-field error", async () => {
    const repository = new MockMerchandisingRepository();
    const result = await adapter.parseRows([supplierSubmissionHeaders,
      row({ 21: "two" }), row({ 27: "TBD" }), row({ 17: "Maybe" }), row({ 19: "Required" }), row({ 25: "Unknown" }),
      row({ 21: "two" }),
    ], context, options);
    const input = toApplySupplierSubmissionImport(result);

    expect(result.rows.map((item) => item.issues[0].code)).toEqual([
      "invalid_display_count", "invalid_available_quantity", "invalid_preorder", "invalid_display_requested", "invalid_assets_available",
      "invalid_display_count",
    ]);
    expect(input.rows).toEqual([]);
    expect(input.reviewRows.map((item) => item.disposition)).toEqual(Array(6).fill("SKIPPED_BLOCKING"));

    await repository.applySupplierSubmissionImport(input);
    const state = await repository.load();
    expect(state.promotionOpportunities).toEqual([]);
    expect(state.supplierSubmissions[0].rows).toHaveLength(6);
    expect(state.supplierSubmissions[0].rows.every((item) => item.disposition === "SKIPPED_BLOCKING")).toBe(true);
    expect(state.supplierSubmissions[0].rows.map((item) => item.provenance.row)).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it("blocks unsupported structure and classifies blank, TBD, compound, unmatched, and ambiguous SKUs", async () => {
    const unsupported = await adapter.parseRows([["Supplier", "Product"], ["Mock", "Item"]], context, options);
    expect(unsupported).toMatchObject({ fatal: true, issues: [{ code: "unsupported_supplier_workbook" }] });
    const ambiguousLookup: ProductMasterLookup = { async findByExactSkus() { return { products: [], ambiguousSkus: ["AMB-1"] }; } };
    const result = await adapter.parseRows([supplierSubmissionHeaders,
      row({ 2: "", 3: "Blank SKU" }), row({ 2: "TBD", 3: "TBD SKU" }), row({ 2: "1/2", 3: "Compound" }),
      row({ 2: "UNKNOWN", 3: "Unmatched" }), row({ 2: "AMB-1", 3: "Ambiguous" }),
    ], { productMaster: ambiguousLookup }, options);
    expect(result.rows.map((item) => item.issues[0].code)).toEqual(["missing_sku", "tbd_sku", "compound_sku", "unmatched_sku", "ambiguous_product_master_sku"]);
    expect(result.rows.every((item) => item.opportunityStatus === "NEEDS_REVIEW")).toBe(true);
  });

  it("handles optional blanks, preserves different terms for one SKU, and flags only an exact repeated proposal", async () => {
    const sparse = ["Mock Coast", "", "MOCK-1001", "Coastal Lager"];
    const first = row();
    const different = row({ 8: "2026-11-30", 9: 3, 12: "November" });
    const result = await adapter.parseRows([supplierSubmissionHeaders, sparse, first, different, first], context, options);
    expect(result.rows[0]).toMatchObject({ status: "ready", opportunity: { promotionEvidence: {}, commercialTerms: {}, merchandisingRequest: {}, availability: {} } });
    expect(result.rows.slice(1, 3).every((item) => !item.issues.some((issue) => issue.code === "exact_duplicate_opportunity"))).toBe(true);
    expect(result.rows[3]).toMatchObject({ status: "needs_review", issues: expect.arrayContaining([expect.objectContaining({ code: "exact_duplicate_opportunity" })]) });
    const input = toApplySupplierSubmissionImport(result);
    expect(input.rows).toHaveLength(3);
    expect(input.reviewRows.map((item) => item.disposition)).toEqual(["OPPORTUNITY_CREATED", "OPPORTUNITY_CREATED", "OPPORTUNITY_CREATED", "SKIPPED_DUPLICATE"]);
  });

  it("retains unresolved and duplicate source provenance but creates only eligible opportunities", async () => {
    const repository = new MockMerchandisingRepository();
    const exact = row();
    const differentTerms = row({ 9: 4, 12: "November" });
    const result = await adapter.parseRows([supplierSubmissionHeaders, exact, row({ 2: "", 3: "Missing SKU" }), exact, differentTerms], context, options);
    const input = toApplySupplierSubmissionImport(result);
    expect(input.rows).toHaveLength(2);
    expect(input.rows.every(({ opportunity }) => opportunity.status === "READY_FOR_REVIEW")).toBe(true);
    await repository.applySupplierSubmissionImport(input);
    const state = await repository.load();
    expect(state.promotionOpportunities).toHaveLength(2);
    expect(state.promotionOpportunities.every((item) => item.status === "READY_FOR_REVIEW")).toBe(true);
    expect(state.supplierSubmissions[0].rows.map((item) => item.disposition)).toEqual([
      "OPPORTUNITY_CREATED", "SKIPPED_BLOCKING", "SKIPPED_DUPLICATE", "OPPORTUNITY_CREATED",
    ]);
    expect(state.supplierSubmissions[0].rows.map((item) => item.provenance.row)).toEqual([2, 3, 4, 5]);

    const unresolvedOnly = await adapter.parseRows([supplierSubmissionHeaders, row({ 2: "", 3: "Only unresolved row" })], context, { ...options, fingerprint: "unresolved-only" });
    window.localStorage.clear();
    const unresolvedRepository = new MockMerchandisingRepository();
    await unresolvedRepository.applySupplierSubmissionImport(toApplySupplierSubmissionImport(unresolvedOnly));
    const unresolvedState = await unresolvedRepository.load();
    expect(unresolvedState.supplierSubmissions[0].rows).toEqual([expect.objectContaining({ disposition: "SKIPPED_BLOCKING", provenance: expect.objectContaining({ row: 2, issues: ["missing_sku"] }) })]);
    expect(unresolvedState.promotionOpportunities).toEqual([]);
  });

  it("applies atomically, blocks replay, preserves revisions, and creates no execution records", async () => {
    const repository = new MockMerchandisingRepository();
    const before = await repository.load();
    const result = await adapter.parseRows(supplierSubmissionRows, context, options);
    const input = toApplySupplierSubmissionImport(result);
    const applied = await repository.applySupplierSubmissionImport(input);
    const after = await repository.load();
    expect(after.supplierSubmissions).toEqual([expect.objectContaining({ id: applied.submissionId, version: 1, importKey: supplierSubmissionImportKey(result) })]);
    expect(after.promotionOpportunities).toEqual([expect.objectContaining({ sourceSubmissionId: applied.submissionId, productId: result.rows[0].product?.id, status: "READY_FOR_REVIEW" })]);
    expect(after.campaigns).toEqual(before.campaigns); expect(after.assignments).toEqual(before.assignments); expect(after.displayAssignments).toEqual(before.displayAssignments);
    expect(after.purchaseOrders).toEqual(before.purchaseOrders); expect(after.executions).toEqual(before.executions);
    await expect(repository.applySupplierSubmissionImport(input)).rejects.toThrow("already been applied");

    await repository.updatePromotionOpportunity({ opportunityId: applied.opportunityIds[0], status: "APPROVED", jeremyComment: "Jeremy: carry forward" });
    const revision = await adapter.parseRows([supplierSubmissionHeaders, row({ 9: 4 })], context, { ...options, fingerprint: "revised-sha" });
    await repository.applySupplierSubmissionImport(toApplySupplierSubmissionImport(revision));
    const revisedState = await repository.load();
    expect(revisedState.supplierSubmissions.map((item) => item.version)).toEqual([1, 2]);
    expect(revisedState.promotionOpportunities[0]).toMatchObject({ status: "APPROVED", jeremyComment: "Jeremy: carry forward", supplierEvidence: { notes: "Preorder by September 15" } });
    expect(revisedState.promotionOpportunities[1]).toMatchObject({ status: "READY_FOR_REVIEW", promotionEvidence: { wholesaleLto: 4 } });
  });

  it("rolls back the whole Apply when a Product Master link is invalid", async () => {
    const repository = new MockMerchandisingRepository();
    const result = await adapter.parseRows(supplierSubmissionRows, context, options);
    const input = toApplySupplierSubmissionImport(result);
    input.rows.push({ ...input.rows[0], opportunity: { ...input.rows[0].opportunity, productId: "bad-id" }, product: undefined });
    await expect(repository.applySupplierSubmissionImport(input)).rejects.toThrow("Invalid Product Master link");
    const state = await repository.load();
    expect(state.supplierSubmissions).toEqual([]); expect(state.promotionOpportunities).toEqual([]);
  });
});
