import { z } from "zod";

const storesSchema = z.array(z.number().int().min(1).max(13)).min(1).max(13).refine((ids) => new Set(ids).size === ids.length, "Duplicate stores");
export const commercialRequestSchema = z.object({
  sku: z.string().trim().min(1).max(100), start: z.iso.date(), end: z.iso.date(), storeIds: storesSchema,
}).strict().superRefine((value, context) => {
  const days = (Date.parse(value.end) - Date.parse(value.start)) / 86400000 + 1;
  if (days < 1 || days > 366) context.addIssue({ code: "custom", message: "Choose a period of 1–366 days." });
});
export type CommercialRequest = z.infer<typeof commercialRequestSchema>;
export const salesObservationSchema = z.object({
  date: z.iso.date(), storeId: z.string().regex(/^[1-9]\d*$/), units: z.number().finite(), revenue: z.number().finite(), cost: z.number().finite(),
}).strict();
export type SalesObservation = z.infer<typeof salesObservationSchema>;
const totalsSchema = z.object({ units: z.number().finite(), revenue: z.number().finite(), cost: z.number().finite() }).strict();
const scopeSchema = z.object({ start: z.iso.date(), end: z.iso.date(), storeIds: storesSchema }).strict().refine((scope) => {
  const days = (Date.parse(scope.end) - Date.parse(scope.start)) / 86400000 + 1;
  return days >= 1 && days <= 366;
}, "Receipt scope must cover 1–366 days.");
export const sourceQualificationSchema = z.object({
  contractVersion: z.literal("ursus-commercial-source-v1"), contractId: z.string().min(1).max(200), version: z.string().min(1).max(200),
  sourceId: z.literal("public.productdailysales"), sourceRevision: z.string().min(1).max(200),
  approvedBy: z.string().min(1).max(200), approvedAt: z.iso.datetime(), sourceAsOf: z.iso.datetime(),
  request: commercialRequestSchema, observedSha256: z.string().regex(/^[a-f0-9]{64}$/),
  currency: z.literal("CAD"), moneyScale: z.union([z.literal(2), z.literal(4)]),
  units: z.literal("sellable-units"), revenue: z.literal("net-merchandise-excluding-tax"),
  cost: z.literal("signed-total-COGS"), returns: z.literal("signed-net-including-returns"),
  coverage: z.literal("all-store-days-including-explicit-zero"), storeMappingVersion: z.string().min(1).max(200),
  reconciliation: z.object({ reference: z.string().min(1).max(200), version: z.string().min(1).max(200), totals: totalsSchema }).strict(),
}).strict();
export type SourceQualification = z.infer<typeof sourceQualificationSchema>;
export const evidenceReceiptSchema = z.object({
  contractVersion: z.literal("commercial-evidence-receipt-v1"), id: z.string().uuid(), sku: z.string().min(1).max(100),
  sourceId: z.literal("public.productdailysales"), observedSha256: z.string().regex(/^[a-f0-9]{64}$/),
  capturedAt: z.iso.datetime(), mode: z.enum(["observed", "synthetic"]), scope: scopeSchema,
  qualification: z.enum(["qualified", "unverified"]), sourceContract: sourceQualificationSchema.optional(),
  rowCount: z.number().int().nonnegative(), expectedStoreDays: z.number().int().positive(), missingStoreDays: z.number().int().nonnegative(),
  totals: totalsSchema, gaps: z.array(z.string().max(500)).max(30),
}).strict().superRefine((receipt, context) => {
  const expected = ((Date.parse(receipt.scope.end) - Date.parse(receipt.scope.start)) / 86400000 + 1) * receipt.scope.storeIds.length;
  if (expected !== receipt.expectedStoreDays || receipt.rowCount + receipt.missingStoreDays !== expected) context.addIssue({ code: "custom", message: "Receipt coverage is inconsistent." });
  const contract = receipt.sourceContract;
  if (receipt.qualification === "qualified" && (!contract || receipt.missingStoreDays !== 0)) context.addIssue({ code: "custom", message: "Qualified receipts require complete accepted source evidence." });
  if (contract && (requestKey(contract.request) !== requestKey({ sku: receipt.sku, ...receipt.scope }) || contract.observedSha256 !== receipt.observedSha256 || JSON.stringify(contract.reconciliation.totals) !== JSON.stringify(receipt.totals) || Date.parse(contract.sourceAsOf) > Date.parse(contract.approvedAt) || Date.parse(contract.approvedAt) > Date.parse(receipt.capturedAt))) context.addIssue({ code: "custom", message: "Receipt does not match its accepted source version, scope, totals or timestamps." });
});
export type CommercialEvidenceReceipt = z.infer<typeof evidenceReceiptSchema>;
export interface CommercialEvidence {
  source: string; start: string; end: string; observations: SalesObservation[]; receipt: CommercialEvidenceReceipt;
}
// Cache the exact payload validated by async SHA-256, so synchronous UI ranking
// cannot display a mutated/deserialized observation array as a checked receipt.
// This is an in-process integrity check, not authentication of source authority.
const verifiedPayloads = new WeakMap<CommercialEvidence, string>();
function evidencePayload(evidence: CommercialEvidence) { return JSON.stringify({ start: evidence.start, end: evidence.end, receipt: evidence.receipt, observations: evidence.observations }); }
export function assertVerifiedCommercialEvidence(evidence: CommercialEvidence) {
  if (verifiedPayloads.get(evidence) !== evidencePayload(evidence)) throw new Error("Commercial evidence changed or was imported without receipt verification. Reload evidence.");
}
export const commercialDecisionSchema = z.object({
  id: z.string().uuid(), at: z.iso.datetime(), actor: z.string().min(1).max(200), decision: z.string().min(1).max(100),
  receipt: evidenceReceiptSchema,
  priorities: z.object({ volume: z.number().min(0).max(100), margin: z.number().min(0).max(100), lift: z.number().min(0).max(100) }).strict(),
}).strict().refine((decision) => Date.parse(decision.at) >= Date.parse(decision.receipt.capturedAt), "Decision cannot predate its source receipt.");
export type CommercialDecision = z.infer<typeof commercialDecisionSchema>;

export function canonicalRequest(value: CommercialRequest): CommercialRequest {
  const parsed = commercialRequestSchema.parse(value);
  return { ...parsed, storeIds: [...parsed.storeIds].sort((a, b) => a - b) };
}
export function requestKey(request: CommercialRequest): string { return JSON.stringify(canonicalRequest(request)); }
export function scopeKey(receipt: CommercialEvidenceReceipt): string {
  return JSON.stringify({ start: receipt.scope.start, end: receipt.scope.end, storeIds: [...receipt.scope.storeIds].sort((a, b) => a - b) });
}
export function validateObservations(request: CommercialRequest, values: SalesObservation[]): SalesObservation[] {
  const rows = z.array(salesObservationSchema).max(4758).parse(values);
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.date}:${row.storeId}`;
    if (seen.has(key)) throw new Error("Commercial observations contain duplicate store dates.");
    if (row.date < request.start || row.date > request.end || !request.storeIds.includes(Number(row.storeId))) throw new Error("Commercial observations have invalid scope.");
    seen.add(key);
  }
  return [...rows].sort((a, b) => a.date.localeCompare(b.date) || Number(a.storeId) - Number(b.storeId));
}
export async function observationDigest(request: CommercialRequest, rows: SalesObservation[]): Promise<string> {
  const payload = JSON.stringify({ request: canonicalRequest(request), observations: validateObservations(request, rows) });
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload)))].map((n) => n.toString(16).padStart(2, "0")).join("");
}
function exactTotal(values: number[], scale: number): number {
  let total = 0;
  for (const value of values) {
    const fixed = value.toFixed(scale);
    if (Number(fixed) !== value) throw new Error("Source values exceed the accepted units/money precision.");
    const scaled = Number(fixed.replace(".", ""));
    if (!Number.isSafeInteger(scaled) || !Number.isSafeInteger(total + scaled)) throw new Error("Source totals exceed safe arithmetic bounds.");
    total += scaled;
  }
  return total / 10 ** scale;
}
export function observationTotals(rows: SalesObservation[], moneyScale = 4) {
  return { units: exactTotal(rows.map((r) => r.units), 6), revenue: exactTotal(rows.map((r) => r.revenue), moneyScale), cost: exactTotal(rows.map((r) => r.cost), moneyScale) };
}
export function commercialMargin(totals: CommercialEvidenceReceipt["totals"], moneyScale: 2 | 4): number {
  return exactTotal([totals.revenue, -totals.cost], moneyScale);
}
export async function verifyCommercialEvidence(evidence: CommercialEvidence): Promise<void> {
  const checkedPayload = evidencePayload(evidence);
  const receipt = evidenceReceiptSchema.parse(evidence.receipt);
  const request = { sku: receipt.sku, ...receipt.scope };
  if (evidence.start !== receipt.scope.start || evidence.end !== receipt.scope.end || evidence.observations.length !== receipt.rowCount || JSON.stringify(observationTotals(evidence.observations, receipt.sourceContract?.moneyScale)) !== JSON.stringify(receipt.totals) || await observationDigest(request, evidence.observations) !== receipt.observedSha256) throw new Error("Commercial observations no longer match their receipt. Reload evidence.");
  if (evidencePayload(evidence) !== checkedPayload) throw new Error("Commercial evidence changed during receipt verification. Reload evidence.");
  verifiedPayloads.set(evidence, checkedPayload);
}
/** A source-owner supplied contract must bind a complete immutable revision to these exact rows.
 * Matching repeated reads detect ordinary drift; they never confer source authority. */
export async function buildCommercialEvidence(input: CommercialRequest, values: SalesObservation[], suppliedOptions: {
  qualification?: SourceQualification; mode?: "observed" | "synthetic"; capturedAt?: string;
} = {}): Promise<CommercialEvidence> {
  const request = canonicalRequest(input), rows = validateObservations(request, values);
  const options = structuredClone(suppliedOptions);
  const sourceContract = options.qualification ? sourceQualificationSchema.parse(options.qualification) : undefined;
  const observedSha256 = await observationDigest(request, rows);
  const expectedStoreDays = ((Date.parse(request.end) - Date.parse(request.start)) / 86400000 + 1) * request.storeIds.length;
  const missingStoreDays = expectedStoreDays - rows.length;
  const totals = observationTotals(rows, sourceContract?.moneyScale);
  const gaps: string[] = [];
  if (missingStoreDays) gaps.push(`${missingStoreDays} requested store-days lack observations. Missing rows are not zero sales.`);
  if (!sourceContract) gaps.push("Source revision, completeness, currency, returns and cost semantics have not been approved. Repeated reads do not establish an atomic snapshot.");
  if (sourceContract) {
    if (requestKey(sourceContract.request) !== requestKey(request) || sourceContract.observedSha256 !== observedSha256) throw new Error("Source contract revision or scope differs from the observed evidence. Requalification required.");
    if (JSON.stringify(sourceContract.reconciliation.totals) !== JSON.stringify(totals)) throw new Error("Observed totals do not reconcile to the independent accepted source control.");
    if (Date.parse(sourceContract.sourceAsOf) > Date.parse(options.capturedAt ?? new Date().toISOString())) throw new Error("Source as-of is in the future.");
  }
  gaps.push("No qualified promotion classification and matched baseline; promotional lift unavailable.");
  const receipt = evidenceReceiptSchema.parse({
    contractVersion: "commercial-evidence-receipt-v1", id: crypto.randomUUID(), sku: request.sku, sourceId: "public.productdailysales", observedSha256,
    capturedAt: options.capturedAt ?? new Date().toISOString(), mode: options.mode ?? "observed", scope: { start: request.start, end: request.end, storeIds: request.storeIds },
    qualification: sourceContract && !missingStoreDays ? "qualified" : "unverified", sourceContract,
    rowCount: rows.length, expectedStoreDays, missingStoreDays, totals, gaps,
  });
  const evidence = { source: receipt.mode === "synthetic" ? "SYNTHETIC commercial fixture" : "Ursus productdailysales (authorized observed rows)", start: request.start, end: request.end, observations: rows, receipt };
  verifiedPayloads.set(evidence, evidencePayload(evidence));
  return evidence;
}
