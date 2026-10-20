import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommercialEvidence } from "../../domain/promotion/ranking";
const rowSchema = z.object({ sales_date: z.iso.date(), store_id: z.number().int(), units_sold: z.number(), net_revenue: z.number(), total_cost: z.number() });
export async function loadCommercialEvidence(client: SupabaseClient, sku: string, start: string, end: string): Promise<CommercialEvidence> {
  // Caller uses the user's existing SELECT RLS; never a service-role key.
  const { data, error } = await client.from("productdailysales").select("sales_date,store_id,units_sold,net_revenue,total_cost").eq("sku", sku).gte("sales_date", start).lte("sales_date", end).order("sales_date").limit(1000);
  if (error) throw new Error("Authoritative sales evidence unavailable for this user. No synthetic metrics substituted.");
  if (data?.length === 1000) throw new Error("Evidence exceeds the safe row limit; narrow the period before comparing.");
  const rows = z.array(rowSchema).parse(data);
  return { source: "Ursus productdailysales (authorized observed rows)", start, end, observations: rows.map((r) => ({ date: r.sales_date, storeId: String(r.store_id), units: r.units_sold, revenue: r.net_revenue, cost: r.total_cost })) };
}
