import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCommercialEvidence, canonicalRequest, observationDigest, sourceQualificationSchema, type CommercialEvidence, type CommercialRequest, type SalesObservation, type SourceQualification } from "../../domain/promotion/commercial";
const rowSchema = z.object({ sales_date: z.iso.date(), store_id: z.number().int().positive(), units_sold: z.number().finite(), net_revenue: z.number().finite(), total_cost: z.number().finite() });
const PAGE_SIZE = 500;
async function readPages(client: SupabaseClient, request: CommercialRequest, signal: AbortSignal): Promise<SalesObservation[]> {
  const rows: SalesObservation[] = [];
  let cursor: { date: string; storeId: number } | undefined;
  // Date + store is a unique key for a fixed SKU (existing source unique constraint).
  // The explicit tie-breaker and cursor also tolerate a server cap below PAGE_SIZE.
  for (let page = 0; page < 100; page++) {
    if (signal.aborted) throw new Error("Commercial evidence read timed out. No partial receipt was retained.");
    let query = client.from("productdailysales").select("sales_date,store_id,units_sold,net_revenue,total_cost")
      .eq("sku", request.sku).in("store_id", request.storeIds).gte("sales_date", request.start).lte("sales_date", request.end)
      .order("sales_date", { ascending: true }).order("store_id", { ascending: true }).limit(PAGE_SIZE).abortSignal(signal);
    if (cursor) query = query.or(`sales_date.gt.${cursor.date},and(sales_date.eq.${cursor.date},store_id.gt.${cursor.storeId})`);
    const { data, error } = await query.then((result) => result, () => { throw new Error("Commercial sales evidence unavailable for this user. No synthetic metrics substituted."); });
    if (error) throw new Error("Commercial sales evidence unavailable for this user. No synthetic metrics substituted.");
    const parsed = z.array(rowSchema).max(PAGE_SIZE).safeParse(data);
    if (!parsed.success) throw new Error("Commercial source returned missing or invalid dates, stores or amounts.");
    if (!parsed.data.length) return rows;
    for (const row of parsed.data) {
      if (row.sales_date < request.start || row.sales_date > request.end || !request.storeIds.includes(row.store_id)) throw new Error("Commercial source returned rows outside the requested scope.");
      if (cursor && (row.sales_date < cursor.date || (row.sales_date === cursor.date && row.store_id <= cursor.storeId))) throw new Error("Commercial source ordering changed or contains duplicate store dates. Reload evidence.");
      cursor = { date: row.sales_date, storeId: row.store_id };
      rows.push({ date: row.sales_date, storeId: String(row.store_id), units: row.units_sold, revenue: row.net_revenue, cost: row.total_cost });
      if (rows.length > 4758) throw new Error("Commercial source exceeds the bounded store/date scope.");
    }
  }
  throw new Error("Commercial source pagination did not complete within its read budget.");
}
export async function loadCommercialEvidence(client: SupabaseClient, input: CommercialRequest, qualification?: SourceQualification): Promise<CommercialEvidence> {
  // Caller uses the user's existing SELECT RLS. An explicit filter never grants store access.
  const request = canonicalRequest(input), signal = AbortSignal.timeout(30000);
  const sourceContract = qualification ? sourceQualificationSchema.parse(qualification) : undefined;
  const first = await readPages(client, request, signal), second = await readPages(client, request, signal);
  if (await observationDigest(request, first) !== await observationDigest(request, second)) throw new Error("Commercial source changed while loading. Discarded incomplete evidence; reload before reviewing.");
  // Even identical reads are unverified without an independently approved immutable source revision.
  return buildCommercialEvidence(request, first, { qualification: sourceContract });
}
