import { z } from "zod";

// Verified Black Betty real-store IDs -> Ursus public.store IDs. Names are not keys.
const canonicalIds = [2, 4, 1, 9, 8, 6, 10, 11, 7, 3, 12, 5] as const;
const storeMap = new Map(canonicalIds.map((id, index) => [
  `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, id,
]));

export function canonicalPurchasingStoreId(blackBettyStoreId: string): number | undefined {
  return storeMap.get(blackBettyStoreId);
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const quantity = z.number().finite().nonnegative().nullable();
const readinessStatus = z.enum(["Ready", "At risk", "Critical", "Unknown"]);
const requirementSchema = z.object({
  key: z.string().min(1), campaign_id: z.string().min(1), store_id: z.number().int().positive(),
  sku: z.string().min(1), source_product_id: z.string().nullish(), required_date: isoDate.nullish(),
  source_fingerprint: z.string().min(1),
  source_refs: z.array(z.object({ kind: z.string().min(1), id: z.string().min(1) })),
  status: readinessStatus,
  required_units: quantity, usable_on_hand_units: quantity, eligible_incoming_units: quantity, uncovered_units: quantity,
  reasons: z.array(z.string()),
  review: z.object({
    reviewed: z.boolean(), source_current: z.boolean(), prior_review_exists: z.boolean(),
    quantity_basis: z.string().nullable(), review_conflict: z.boolean(),
    dispositions: z.array(z.string()), reviewed_batch_ids: z.array(z.string()),
  }),
  orders: z.array(z.object({
    order_id: z.string(), po_number: z.string().nullish(), status: z.string(),
    issued: z.boolean(), dispatched: z.boolean(), confirmed: z.boolean(),
    confirmation_fresh: z.boolean(), received_line_units: z.number().finite().nonnegative(),
  })),
}).superRefine((row, context) => {
  if (row.status === "Ready" && (!row.review.reviewed || !row.review.source_current || row.review.quantity_basis !== "target_stock" || row.review.review_conflict || !row.required_date || row.required_units === null || row.usable_on_hand_units === null || row.eligible_incoming_units === null || row.uncovered_units !== 0 || row.usable_on_hand_units + row.eligible_incoming_units < row.required_units)) {
    context.addIssue({ code: "custom", message: "Ready requires current dated stock evidence." });
  }
});

const countsSchema = z.object({
  Ready: z.number().int().nonnegative(),
  "At risk": z.number().int().nonnegative(),
  Critical: z.number().int().nonnegative(),
  Unknown: z.number().int().nonnegative(),
});

const responseSchema = z.object({
  contract_version: z.literal("purchasing-readiness-v1"), campaign_id: z.string(),
  source_fingerprint: z.string().min(1), as_of: isoDate, requirements: z.array(requirementSchema),
  counts: countsSchema,
  store_source_fingerprints: z.record(z.string(), z.string().min(1)),
  ledger_version: z.number().int().nonnegative(),
  calculation_issues: z.array(z.object({ batch_id: z.string().min(1), reason: z.string().min(1) })),
  stock_writes: z.literal(false),
});

export type CampaignPurchasingReadiness = z.infer<typeof responseSchema>;
export interface PurchasingReadinessRequest {
  campaign_id: string;
  store_ids: number[];
  max_confirmation_age_days: number;
}

export function parsePurchasingReadiness(value: unknown, request: PurchasingReadinessRequest): CampaignPurchasingReadiness {
  const parsed = responseSchema.safeParse(value);
  if (!parsed.success) throw new Error("Purchasing readiness returned incomplete or unverified dated stock evidence.");
  const response = parsed.data;
  if (response.campaign_id !== request.campaign_id || response.requirements.some((row) => row.campaign_id !== request.campaign_id || !request.store_ids.includes(row.store_id))) {
    throw new Error("Readiness response does not match the requested campaign/store scope.");
  }
  if (new Set(response.requirements.map((row) => row.key)).size !== response.requirements.length) {
    throw new Error("Readiness response contains duplicate requirement identities.");
  }
  const requestedStores = new Set(request.store_ids.map(String));
  const responseStores = Object.keys(response.store_source_fingerprints);
  if (responseStores.length !== requestedStores.size || responseStores.some((storeId) => !requestedStores.has(storeId))) {
    throw new Error("Readiness response does not contain source evidence for the exact requested store scope.");
  }
  if (response.requirements.some((row) => row.source_fingerprint !== response.store_source_fingerprints[String(row.store_id)])) {
    throw new Error("Readiness response mixes requirement evidence from different source versions.");
  }
  const actualCounts = Object.fromEntries(readinessStatus.options.map((status) => [
    status,
    response.requirements.filter((row) => row.status === status).length,
  ]));
  if (readinessStatus.options.some((status) => response.counts[status] !== actualCounts[status])) {
    throw new Error("Readiness response status totals do not reconcile to its requirements.");
  }
  return response;
}

export async function fetchPurchasingReadiness(
  baseUrl: string, accessToken: string, request: PurchasingReadinessRequest, fetcher: typeof fetch = fetch,
): Promise<CampaignPurchasingReadiness> {
  const base = new URL(baseUrl);
  if (base.username || base.password || (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)))) {
    throw new Error("A trusted HTTPS Ursus Major URL is required.");
  }
  if (!accessToken || !request.campaign_id || request.store_ids.length === 0 || new Set(request.store_ids).size !== request.store_ids.length || request.store_ids.some((id) => !Number.isInteger(id) || id < 1 || id > 13) || !Number.isInteger(request.max_confirmation_age_days) || request.max_confirmation_age_days < 0 || request.max_confirmation_age_days > 90) {
    throw new Error("Sign in and choose a mapped store and explicit confirmation freshness.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetcher(new URL("/api/purchasing/readiness", base), {
      method: "POST", credentials: "omit", redirect: "error", signal: controller.signal,
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (response.status === 401 || response.status === 403) throw new Error("Your provisioned Ursus Major account does not currently authorize this readiness request. Sign in or review existing store access.");
    if (!response.ok) throw new Error("Purchasing readiness is unavailable. Existing merchandising work is safe; try again later.");
    return parsePurchasingReadiness(await response.json(), request);
  } finally {
    clearTimeout(timeout);
  }
}
