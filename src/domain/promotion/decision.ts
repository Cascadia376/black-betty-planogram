import { assertVerifiedCommercialEvidence, commercialDecisionSchema, verifyCommercialEvidence, type CommercialEvidence } from "./commercial";
import type { IntelligenceOpportunity, IntelligenceWorkspace, RankingPriorities } from "./schema";
export async function retainCommercialDecision(item: IntelligenceOpportunity, evidence: CommercialEvidence, priorities: RankingPriorities, actor: string): Promise<IntelligenceOpportunity> {
  const next = structuredClone(item), chosenPriorities = { ...priorities };
  await verifyCommercialEvidence(evidence);
  assertVerifiedCommercialEvidence(evidence);
  if (next.authoritativeSku !== evidence.receipt.sku || next.supplierSku !== evidence.receipt.sku) throw new Error("Product identity changed. Reload commercial evidence before saving this decision.");
  if ((next.intelligence.commercialDecisions?.length ?? 0) >= 20) throw new Error("Commercial receipt history is full. Export and review retention before adding more; prior receipts are preserved.");
  const decision = commercialDecisionSchema.parse({ id: crypto.randomUUID(), at: new Date().toISOString(), actor, decision: next.status, receipt: evidence.receipt, priorities: chosenPriorities });
  next.intelligence.commercialDecisions = [...(next.intelligence.commercialDecisions ?? []), decision];
  next.intelligence.history.push({ at: decision.at, actor, action: `Commercial receipt ${decision.receipt.id} retained for ${decision.decision}; ${decision.receipt.mode}/${decision.receipt.qualification}` });
  return next;
}
/** Historical receipts stay exportable; active comparisons require the current matched identity.
 * This also excludes older deleted-source records that retained a stale master SKU. */
export function currentCommercialReceipt(item: IntelligenceOpportunity) {
  if (item.intelligence.resolution !== "MATCHED" || !item.authoritativeSku || item.supplierSku !== item.authoritativeSku) return undefined;
  return item.intelligence.commercialDecisions?.filter((decision) => decision.receipt.sku === item.authoritativeSku).at(-1)?.receipt;
}
/** Application-level history preservation complements existing buyer RLS and workspace CAS.
 * It is not a database append-only/tamper-proof guarantee. */
export function assertCommercialHistoryPreserved(current: IntelligenceWorkspace, next: IntelligenceWorkspace) {
  for (const item of current.opportunities) {
    const prior = item.intelligence.commercialDecisions ?? [];
    if (!prior.length) continue;
    const after = next.opportunities.find((candidate) => candidate.id === item.id)?.intelligence.commercialDecisions ?? [];
    if (JSON.stringify(after.slice(0, prior.length)) !== JSON.stringify(prior)) throw new Error("Saved commercial decision receipts cannot be rewritten or removed by this operation.");
  }
}
