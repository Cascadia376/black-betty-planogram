import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCommercialEvidence } from "./commercial";
import { syntheticCommercialEvidence } from "./commercialFixture";
import { buildCommercialEvidence, commercialMargin, observationDigest, verifyCommercialEvidence, type CommercialRequest } from "../../domain/promotion/commercial";
import { commercialSignals, rankComparableReceipts, rankEvidence, receiptSignals } from "../../domain/promotion/ranking";
const request: CommercialRequest = { sku: "0000123", start: "2026-01-01", end: "2026-03-31", storeIds: Array.from({ length: 13 }, (_, index) => index + 1) };
type Row = { sales_date: string; store_id: number; units_sold: number; net_revenue: number; total_cost: number };
async function sourceRows(input = request) { const evidence = await syntheticCommercialEvidence(input); return { evidence, rows: evidence.observations.map((r) => ({ sales_date: r.date, store_id: Number(r.storeId), units_sold: r.units, net_revenue: r.revenue, total_cost: r.cost })) }; }
function fakeClient(source: Row[], options: { cap?: number; transform?: (rows: Row[], call: number, pass: number) => unknown; errorAt?: number } = {}) {
  const calls: { sku?: string; stores?: number[]; order: string[]; cursor?: string; signal?: AbortSignal }[] = [];
  let pass = 0;
  const from = vi.fn((table: string) => {
    expect(table).toBe("productdailysales");
    let start = "", end = "", cursor = "", limit = 500;
    const call = { order: [] as string[], sku: undefined as string | undefined, stores: undefined as number[] | undefined, cursor: undefined as string | undefined, signal: undefined as AbortSignal | undefined };
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn((key, value) => { expect(key).toBe("sku"); call.sku = value; return query; }),
      in: vi.fn((key, value) => { expect(key).toBe("store_id"); call.stores = value; return query; }),
      gte: vi.fn((_key, value) => { start = value; return query; }), lte: vi.fn((_key, value) => { end = value; return query; }),
      order: vi.fn((key) => { call.order.push(key); return query; }), limit: vi.fn((value) => { limit = value; return query; }),
      or: vi.fn((value) => { cursor = value; call.cursor = value; return query; }),
      abortSignal: vi.fn((signal) => { call.signal = signal; return query; }),
      then: (resolve: (value: unknown) => unknown, reject: (cause: unknown) => unknown) => {
        if (!cursor) pass++;
        calls.push(call);
        const after = cursor.match(/sales_date.gt.(\d{4}-\d{2}-\d{2}),and\(sales_date.eq.\d{4}-\d{2}-\d{2},store_id.gt.(\d+)\)/);
        const rows = source.filter((row) => row.sales_date >= start && row.sales_date <= end && call.stores?.includes(row.store_id) && (!after || row.sales_date > after[1] || (row.sales_date === after[1] && row.store_id > Number(after[2])))).slice(0, Math.min(limit, options.cap ?? 500));
        const data = options.transform ? options.transform(rows, calls.length, pass) : rows;
        return Promise.resolve({ data, error: options.errorAt === calls.length ? { message: "denied" } : null }).then(resolve, reject);
      },
    };
    return query;
  });
  return { client: { from } as unknown as SupabaseClient, calls, from };
}
describe("commercial source paging and qualification", () => {
  it("reads 1170 rows with stable date/store tie ordering and keeps leading-zero SKU", async () => {
    const { rows } = await sourceRows(), fake = fakeClient(rows);
    const evidence = await loadCommercialEvidence(fake.client, request);
    expect(evidence.observations).toHaveLength(1170);
    expect(fake.calls).toHaveLength(8); // three pages plus empty tail, repeated
    expect(fake.calls.every((call) => call.sku === "0000123" && call.order.join() === "sales_date,store_id")).toBe(true);
    expect(fake.calls[1].cursor).toMatch(/store_id.gt./);
    expect(fake.calls.every((call) => call.signal === fake.calls[0].signal && !call.signal?.aborted)).toBe(true);
    expect(evidence.receipt.qualification).toBe("unverified");
    expect(rankEvidence(evidence, { volume: 1, margin: 0, lift: 0 }).score).toBeUndefined();
    expect(evidence.receipt.gaps.join()).toContain("atomic snapshot");
  });
  it("continues past short pages when the server cap is lower than requested", async () => {
    const { rows } = await sourceRows(), fake = fakeClient(rows, { cap: 73 });
    expect((await loadCommercialEvidence(fake.client, request)).observations).toHaveLength(1170);
    expect(fake.calls).toHaveLength(36);
  });
  it("accepts a complete independently pinned fixture version and reconciles signed returns/total COGS", async () => {
    const { rows, evidence } = await sourceRows(), fake = fakeClient(rows);
    const loaded = await loadCommercialEvidence(fake.client, request, evidence.receipt.sourceContract);
    expect(loaded.receipt.qualification).toBe("qualified");
    expect(loaded.observations.some((row) => row.units < 0 && row.cost < 0)).toBe(true);
    expect(commercialSignals(loaded).values.margin).toBe(loaded.receipt.totals.revenue - loaded.receipt.totals.cost);
    expect(commercialSignals(loaded).values.lift).toBeUndefined();
    await verifyCommercialEvidence(loaded);
  });
  it.each(["missing-store", "missing-date"])("retains %s gaps rather than manufacturing zero days", async (kind) => {
    const { rows } = await sourceRows();
    const source = rows.filter((row) => kind === "missing-store" ? row.store_id !== 13 : row.sales_date !== request.end);
    const evidence = await loadCommercialEvidence(fakeClient(source).client, request);
    expect(evidence.receipt.missingStoreDays).toBe(kind === "missing-store" ? 90 : 13);
    expect(evidence.receipt.qualification).toBe("unverified");
  });
  it("rejects source revisions between read passes without returning a receipt", async () => {
    const { rows } = await sourceRows();
    const fake = fakeClient(rows, { transform: (page, _call, pass) => pass === 2 ? page.map((row) => ({ ...row, net_revenue: row.net_revenue + 1 })) : page });
    await expect(loadCommercialEvidence(fake.client, request)).rejects.toThrow(/changed while loading/);
  });
  it("rejects a changed immutable version digest, scope and independent totals", async () => {
    const { rows, evidence } = await sourceRows();
    const contract = evidence.receipt.sourceContract!;
    await expect(loadCommercialEvidence(fakeClient(rows).client, request, { ...contract, observedSha256: "a".repeat(64) })).rejects.toThrow(/revision or scope/);
    await expect(loadCommercialEvidence(fakeClient(rows).client, request, { ...contract, request: { ...request, sku: "different" } })).rejects.toThrow(/revision or scope/);
    await expect(loadCommercialEvidence(fakeClient(rows).client, request, { ...contract, reconciliation: { ...contract.reconciliation, totals: { ...contract.reconciliation.totals, cost: 0 } } })).rejects.toThrow(/reconcile/);
  });
  it.each(["duplicate", "out-of-order", "wrong-store", "missing-date", "null-cost"])("fails closed for %s source rows", async (kind) => {
    const { rows } = await sourceRows();
    const fake = fakeClient(rows, { transform: (page, call) => call !== 1 ? page : kind === "duplicate" ? [page[0], page[0]] : kind === "out-of-order" ? [...page].reverse() : kind === "wrong-store" ? [{ ...page[0], store_id: 99 }] : kind === "missing-date" ? [{ ...page[0], sales_date: null }] : [{ ...page[0], total_cost: null }] });
    await expect(loadCommercialEvidence(fake.client, request)).rejects.toThrow(/scope|duplicate|ordering|invalid/);
  });
  it.each([1, 2, 5])("rejects authorization/outage failure at page call %s without partial evidence", async (errorAt) => {
    const { rows } = await sourceRows();
    await expect(loadCommercialEvidence(fakeClient(rows, { errorAt }).client, request)).rejects.toThrow(/unavailable for this user/);
  });
  it("does not issue requests for invalid scope, duplicate stores, invalid calendar dates or numeric SKU", async () => {
    const fake = fakeClient([]);
    for (const input of [{ ...request, storeIds: [] }, { ...request, storeIds: [1, 1] }, { ...request, start: "2026-02-30" }, { ...request, end: "2028-01-01" }, { ...request, sku: 123 }]) await expect(loadCommercialEvidence(fake.client, input as CommercialRequest)).rejects.toThrow();
    expect(fake.from).not.toHaveBeenCalled();
  });
  it("applies one read deadline across pages and passes without retaining partial results", async () => {
    const { rows } = await sourceRows();
    const controller = new AbortController(), timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const fake = fakeClient(rows, { transform: (page, call) => { if (call === 1) controller.abort(); return page; } });
    try { await expect(loadCommercialEvidence(fake.client, request)).rejects.toThrow(/timed out/); expect(fake.calls).toHaveLength(1); expect(timeout).toHaveBeenCalledWith(30000); }
    finally { timeout.mockRestore(); }
  });
  it("keeps empty authorized reads as missing observations, not confirmed zero sales", async () => {
    const evidence = await loadCommercialEvidence(fakeClient([]).client, request);
    expect(evidence.receipt.missingStoreDays).toBe(1170);
    expect(evidence.receipt.totals.units).toBe(0);
    expect(commercialSignals(evidence).values).toEqual({});
  });
  it("requires accepted cost units and rejects values beyond approved precision", async () => {
    const one = { ...request, start: "2026-01-01", end: "2026-01-01", storeIds: [1] };
    const fixture = await syntheticCommercialEvidence(one), contract = fixture.receipt.sourceContract!;
    await expect(buildCommercialEvidence(one, fixture.observations, { qualification: { ...contract, cost: "unit-cost" } as never })).rejects.toThrow();
    const values = [{ ...fixture.observations[0], revenue: 10.001 }];
    await expect(buildCommercialEvidence(one, values, { qualification: { ...contract, observedSha256: await observationDigest(one, values) } })).rejects.toThrow(/precision/);
  });
  it("requires receipt hash validation when same-total observations are revised", async () => {
    const fixture = await syntheticCommercialEvidence(request);
    const changed = structuredClone(fixture);
    [changed.observations[0].revenue, changed.observations[30].revenue] = [changed.observations[30].revenue, changed.observations[0].revenue];
    expect(() => rankEvidence(changed, { volume: 1, margin: 0, lift: 0 })).toThrow(/changed or was imported/);
    await expect(verifyCommercialEvidence(changed)).rejects.toThrow(/no longer match/);
  });
  it("requires verification before an exported/imported observation bundle is ranked", async () => {
    const imported = structuredClone(await syntheticCommercialEvidence(request));
    expect(() => rankEvidence(imported, { volume: 1, margin: 0, lift: 0 })).toThrow(/imported without receipt verification/);
    await verifyCommercialEvidence(imported);
    expect(rankEvidence(imported, { volume: 1, margin: 0, lift: 0 }).score).toBeDefined();
  });
});
describe("comparable commercial batches", () => {
  const priorities = { volume: 1, margin: 0, lift: 0 };
  it("sorts a complete comparable batch with stable opportunity-ID ties", async () => {
    const a = await syntheticCommercialEvidence(request), b = await syntheticCommercialEvidence({ ...request, sku: "0000124", storeIds: [...request.storeIds].reverse() });
    expect(rankComparableReceipts([{ id: "b", receipt: b.receipt }, { id: "a", receipt: a.receipt }], priorities).items.map((r) => r.id)).toEqual(["a", "b"]);
  });
  it("compares imported scopes irrespective of object-key order", async () => {
    const a = await syntheticCommercialEvidence(request), b = await syntheticCommercialEvidence({ ...request, sku: "0000124" });
    b.receipt.scope = { storeIds: [...b.receipt.scope.storeIds].reverse(), end: b.receipt.scope.end, start: b.receipt.scope.start };
    expect(rankComparableReceipts([{ id: "a", receipt: a.receipt }, { id: "b", receipt: b.receipt }], priorities).state).toBe("Comparable Evidence");
  });
  it("uses accepted scaled arithmetic for decimal margins and signed returns", async () => {
    const fixture = await syntheticCommercialEvidence(request), receipt = fixture.receipt;
    receipt.totals = { units: 1, revenue: 0.3, cost: 0.2 };
    receipt.sourceContract!.reconciliation.totals = receipt.totals;
    expect(receiptSignals(receipt).values.margin).toBe(0.1);
    expect(commercialMargin({ units: -1, revenue: -0.3, cost: -0.2 }, 2)).toBe(-0.1);
    expect(() => commercialMargin({ units: 1, revenue: 90071992547409.91, cost: -90071992547409.91 }, 2)).toThrow(/safe arithmetic/);
  });
  it.each(["period", "store", "revision", "unverified", "mode"])("suppresses all scores for incomparable %s", async (kind) => {
    const a = await syntheticCommercialEvidence(request), b = await syntheticCommercialEvidence({ ...request, sku: "0000124", ...(kind === "period" ? { start: "2026-01-02" } : {}), ...(kind === "store" ? { storeIds: [1] } : {}) });
    if (kind === "revision") b.receipt.sourceContract!.sourceRevision = "revision-2";
    if (kind === "unverified") b.receipt.qualification = "unverified";
    if (kind === "mode") b.receipt.mode = "observed";
    const batch = rankComparableReceipts([{ id: "a", receipt: a.receipt }, { id: "b", receipt: b.receipt }], priorities);
    expect(batch.state).toBe("Insufficient Evidence"); expect(batch.items.every((r) => r.score === undefined)).toBe(true);
  });
  it("leaves lift unavailable and includes missing receipts in batch rejection", async () => {
    const fixture = await syntheticCommercialEvidence(request);
    expect(rankEvidence(fixture, { volume: 0, margin: 0, lift: 1 }).score).toBeUndefined();
    expect(rankComparableReceipts([{ id: "a", receipt: fixture.receipt }, { id: "b" }], priorities).state).toBe("Insufficient Evidence");
  });
});
