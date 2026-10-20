import type { RankingPriorities } from "./schema";
export interface SalesObservation { date: string; storeId: string; units: number; revenue: number; cost: number; promotional?: boolean }
export interface CommercialEvidence { source: string; start: string; end: string; observations: SalesObservation[] }
export function commercialSignals(evidence?: CommercialEvidence) {
  const gaps = ["No verified inventory/supply evidence", "No forecast or causal promotion attribution"];
  if (!evidence?.observations.length) return { state: "Insufficient Evidence" as const, gaps: ["No authoritative dated sales evidence", ...gaps], explanations: [] as string[], values: {} as Partial<Record<keyof RankingPriorities, number>> };
  const rows = evidence.observations;
  if (evidence.start > evidence.end || rows.some((r) => !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || r.date < evidence.start || r.date > evidence.end || ![r.units, r.revenue, r.cost].every(Number.isFinite)) || new Set(rows.map((r) => `${r.storeId}:${r.date}`)).size !== rows.length) throw new Error("Commercial observations have invalid scope, values or duplicate store dates.");
  const values: Partial<Record<keyof RankingPriorities, number>> = { volume: rows.reduce((n, r) => n + r.units, 0), margin: rows.reduce((n, r) => n + r.revenue - r.cost, 0) };
  const promo = rows.filter((r) => r.promotional === true), regular = rows.filter((r) => r.promotional === false);
  const baseline = regular.reduce((n, r) => n + r.units, 0) / regular.length;
  if (promo.length && baseline > 0) values.lift = ((promo.reduce((n, r) => n + r.units, 0) / promo.length) / baseline - 1) * 100;
  else gaps.push("No comparable classified promotion/regular observations; lift unavailable");
  return { state: "Observed Evidence" as const, values, gaps, explanations: [`${evidence.source}, ${evidence.start} to ${evidence.end}; ${rows.length} observed store-days. Missing days are not assumed to be zero.`, `Observed units ${values.volume}; gross margin dollars ${values.margin!.toFixed(2)} (net revenue minus recorded total cost).`, ...(values.lift === undefined ? [] : [`Observed store-day lift ${values.lift.toFixed(1)}%; descriptive, sensitive to store mix and seasonality.`])] };
}
export function rankEvidence(evidence: CommercialEvidence | undefined, priorities: RankingPriorities) {
  const signals = commercialSignals(evidence);
  if (Object.values(priorities).some((v) => !Number.isFinite(v) || v < 0 || v > 100)) throw new Error("Priorities must be between 0 and 100.");
  const enabled = (Object.keys(priorities) as Array<keyof RankingPriorities>).filter((key) => priorities[key] > 0);
  if (!enabled.length || enabled.some((key) => signals.values[key] === undefined)) return { ...signals, state: "Insufficient Evidence", score: undefined, gaps: [...signals.gaps, !enabled.length ? "Set buyer ranking priorities to compare evidence" : "A selected signal lacks evidence"] };
  // Explicit linear utility with units shown in UI; no invented normalization or forecasts.
  const score = enabled.reduce((n, key) => n + signals.values[key]! * priorities[key], 0) / enabled.reduce((n, key) => n + priorities[key], 0);
  return { ...signals, score, explanations: [...signals.explanations, `Buyer weights: ${enabled.map((key) => `${key}=${priorities[key]}`).join(", ")}. Linear utility, comparable only for identical periods and store scope.`] };
}
