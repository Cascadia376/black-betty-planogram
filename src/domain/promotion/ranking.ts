import type { RankingPriorities } from "./schema";
import { assertVerifiedCommercialEvidence, commercialMargin, evidenceReceiptSchema, observationTotals, scopeKey, validateObservations, type CommercialEvidence, type CommercialEvidenceReceipt } from "./commercial";
export type { CommercialEvidence, SalesObservation } from "./commercial";
export function receiptSignals(receipt?: CommercialEvidenceReceipt) {
  const gaps = ["No verified inventory/supply evidence", "No forecast or causal promotion attribution"];
  if (!receipt) return { state: "Insufficient Evidence" as const, gaps: ["No authoritative dated sales evidence", ...gaps], explanations: [] as string[], values: {} as Partial<Record<keyof RankingPriorities, number>> };
  evidenceReceiptSchema.parse(receipt);
  const explanations = [
    `${receipt.mode === "synthetic" ? "SYNTHETIC fixture" : receipt.sourceId}, ${receipt.scope.start} to ${receipt.scope.end}; stores ${receipt.scope.storeIds.join(", ")}; ${receipt.rowCount}/${receipt.expectedStoreDays} observed store-days.`,
    `Observed units ${receipt.totals.units}; recorded net revenue ${receipt.totals.revenue.toFixed(2)}; recorded total cost ${receipt.totals.cost.toFixed(2)}.`,
    `Observed content SHA-256 ${receipt.observedSha256}; source revision ${receipt.sourceContract?.sourceRevision ?? "unverified"}.`,
  ];
  if (receipt.qualification !== "qualified" || !receipt.sourceContract || receipt.missingStoreDays) return { state: "Insufficient Evidence" as const, gaps: [...receipt.gaps, ...gaps], explanations, values: {} as Partial<Record<keyof RankingPriorities, number>> };
  return { state: "Observed Evidence" as const, values: { volume: receipt.totals.units, margin: commercialMargin(receipt.totals, receipt.sourceContract.moneyScale) } as Partial<Record<keyof RankingPriorities, number>>, gaps: [...receipt.gaps, ...gaps], explanations };
}
export function commercialSignals(evidence?: CommercialEvidence) {
  if (evidence) {
    validateObservations({ sku: evidence.receipt.sku, ...evidence.receipt.scope }, evidence.observations);
    if (evidence.start !== evidence.receipt.scope.start || evidence.end !== evidence.receipt.scope.end || evidence.observations.length !== evidence.receipt.rowCount || JSON.stringify(observationTotals(evidence.observations, evidence.receipt.sourceContract?.moneyScale)) !== JSON.stringify(evidence.receipt.totals)) throw new Error("Commercial observations do not match the receipt totals/scope.");
    assertVerifiedCommercialEvidence(evidence);
  }
  return receiptSignals(evidence?.receipt);
}
export function rankReceipt(receipt: CommercialEvidenceReceipt | undefined, priorities: RankingPriorities) {
  const signals = receiptSignals(receipt);
  if (Object.values(priorities).some((v) => !Number.isFinite(v) || v < 0 || v > 100)) throw new Error("Priorities must be between 0 and 100.");
  const enabled = (Object.keys(priorities) as Array<keyof RankingPriorities>).filter((key) => priorities[key] > 0);
  if (!enabled.length || enabled.some((key) => signals.values[key] === undefined)) return { ...signals, state: "Insufficient Evidence", score: undefined, gaps: [...signals.gaps, !enabled.length ? "Set buyer ranking priorities to compare evidence" : "A selected signal lacks evidence"] };
  const score = enabled.reduce((n, key) => n + signals.values[key]! * priorities[key], 0) / enabled.reduce((n, key) => n + priorities[key], 0);
  return { ...signals, score, explanations: [...signals.explanations, `Buyer weights: ${enabled.map((key) => `${key}=${priorities[key]}`).join(", ")}. Linear utility for identical periods/store scope only.`] };
}
export function rankEvidence(evidence: CommercialEvidence | undefined, priorities: RankingPriorities) {
  if (evidence) commercialSignals(evidence);
  return rankReceipt(evidence?.receipt, priorities);
}
/** A batch is all-or-nothing: never silently drop incomparable opportunities. */
export function rankComparableReceipts(items: { id: string; receipt?: CommercialEvidenceReceipt }[], priorities: RankingPriorities) {
  const scored = items.map((item) => ({ ...item, ...rankReceipt(item.receipt, priorities) }));
  const keys = new Set(items.map(({ receipt }) => receipt && JSON.stringify({ scope: scopeKey(receipt), mode: receipt.mode, source: receipt.sourceId, revision: receipt.sourceContract?.sourceRevision, contractId: receipt.sourceContract?.contractId, contractVersion: receipt.sourceContract?.version, currency: receipt.sourceContract?.currency, scale: receipt.sourceContract?.moneyScale, units: receipt.sourceContract?.units, cost: receipt.sourceContract?.cost, returns: receipt.sourceContract?.returns, mapping: receipt.sourceContract?.storeMappingVersion })));
  if (items.length < 2 || scored.some((item) => item.score === undefined) || keys.size !== 1) return { state: "Insufficient Evidence", reason: "Every opportunity needs qualified evidence for the identical period, stores, source revision and accounting contract.", items: scored.map(({ id }) => ({ id, score: undefined })) };
  return { state: "Comparable Evidence", reason: "Identical source revision, period, stores and accounting contract; descriptive buyer utility only.", items: scored.map(({ id, score }) => ({ id, score })).sort((a, b) => b.score! - a.score! || a.id.localeCompare(b.id)) };
}
