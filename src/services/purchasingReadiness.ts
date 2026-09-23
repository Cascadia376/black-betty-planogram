import { z } from "zod";

// Verified Black Betty real-store IDs -> Ursus public.store IDs. Names are not keys.
const canonicalIds = [2, 4, 1, 9, 8, 6, 10, 11, 7, 3, 12, 5] as const;
const storeMap = new Map(canonicalIds.map((id, index) => [
  `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, id,
]));

export function canonicalPurchasingStoreId(blackBettyStoreId: string): number | undefined {
  return storeMap.get(blackBettyStoreId);
}

const quantity = z.number().finite().nonnegative().nullable();
const requirementSchema = z.object({
  key: z.string().min(1), campaign_id: z.string().min(1), store_id: z.number().int().positive(),
  sku: z.string(), source_product_id: z.string().nullish(), required_date: z.string().nullish(),
  status: z.enum(["Ready", "At risk", "Critical", "Unknown"]),
  required_units: quantity, usable_on_hand_units: quantity, eligible_incoming_units: quantity, uncovered_units: quantity,
  reasons: z.array(z.string()),
  review: z.object({ reviewed: z.boolean(), source_current: z.boolean() }),
  orders: z.array(z.object({
    order_id: z.string(), po_number: z.string().nullish(), status: z.string(),
    issued: z.boolean(), dispatched: z.boolean(), confirmed: z.boolean(),
    confirmation_fresh: z.boolean(), received_line_units: z.number().finite().nonnegative(),
  })),
}).superRefine((row, context) => {
  if (row.status === "Ready" && (!row.review.reviewed || !row.review.source_current || !row.required_date || row.required_units === null || row.usable_on_hand_units === null || row.eligible_incoming_units === null || row.uncovered_units !== 0 || row.usable_on_hand_units + row.eligible_incoming_units < row.required_units)) {
    context.addIssue({ code: "custom", message: "Ready requires current dated stock evidence." });
  }
});

const responseSchema = z.object({
  contract_version: z.literal("purchasing-readiness-v1"), campaign_id: z.string(),
  source_fingerprint: z.string().min(1), as_of: z.string(), requirements: z.array(requirementSchema),
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
  return response;
}

export async function fetchPurchasingReadiness(
  baseUrl: string, accessToken: string, request: PurchasingReadinessRequest, fetcher: typeof fetch = fetch,
): Promise<CampaignPurchasingReadiness> {
  const base = new URL(baseUrl);
  if (base.username || base.password || (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)))) {
    throw new Error("A trusted HTTPS Ursus Major URL is required.");
  }
  if (!accessToken || !request.campaign_id || request.store_ids.length === 0 || request.store_ids.some((id) => !Number.isInteger(id) || id < 1 || id > 13) || !Number.isInteger(request.max_confirmation_age_days) || request.max_confirmation_age_days < 0) {
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
