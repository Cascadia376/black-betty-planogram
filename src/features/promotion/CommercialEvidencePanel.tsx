import { useState } from "react";
import { Badge, Button, Card, Field, inputClass } from "../../components/ui";
import { usePlatform } from "../../services/PlatformProvider";
import { canonicalPurchasingStoreId } from "../../services/purchasingReadiness";
import { syntheticCommercialEvidence } from "../../services/promotion/commercialFixture";
import { rankEvidence } from "../../domain/promotion/ranking";
import { hasCurrentCommercialIdentity } from "../../domain/promotion/decision";
import type { CommercialEvidence } from "../../domain/promotion/commercial";
import type { IntelligenceOpportunity, RankingPriorities } from "../../domain/promotion/schema";
interface Props { item: IntelligenceOpportunity; priorities: RankingPriorities; evidence?: CommercialEvidence; onEvidence(value?: CommercialEvidence): void; busy: boolean; skuChanged: boolean; run(op: () => Promise<void>): Promise<void> }
function defaultPeriod() {
  const end = new Date(); end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 89);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
export function CommercialEvidencePanel({ item, priorities, evidence, onEvidence, busy, skuChanged, run }: Props) {
  const platform = usePlatform();
  const stores = (platform.data?.stores ?? []).map((store) => ({ ...store, canonicalId: canonicalPurchasingStoreId(store.id) })).filter((store) => store.canonicalId !== undefined);
  const [period, setPeriod] = useState(defaultPeriod), [storeIds, setStoreIds] = useState<number[]>(stores.map((store) => store.canonicalId!));
  const [error, setError] = useState<string>(), [page, setPage] = useState(0);
  const ranking = rankEvidence(evidence, priorities);
  const canLoad = !skuChanged && hasCurrentCommercialIdentity(item) && storeIds.length > 0;
  async function load(synthetic: boolean) {
    if (!canLoad) return;
    onEvidence(undefined); setError(undefined); setPage(0);
    try {
      const request = { sku: item.authoritativeSku!, ...period, storeIds };
      onEvidence(synthetic ? await syntheticCommercialEvidence(request) : await platform.loadPromotionEvidence(request));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Evidence unavailable"); }
  }
  function exportEvidence() {
    if (!evidence) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `commercial-${evidence.receipt.id}.json`; anchor.click(); URL.revokeObjectURL(url);
  }
  function exportReceipts() {
    const payload = { contractVersion: "commercial-decision-export-v1", opportunityId: item.id, decisions: item.intelligence.commercialDecisions, note: "Historical buyer decision receipts. Source freshness and authority are not re-established by this export." };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `commercial-decisions-${item.id}.json`; anchor.click(); URL.revokeObjectURL(url);
  }
  return <Card><h2 className="font-semibold">Commercial evidence</h2><Badge tone="info">{ranking.state}</Badge>
    {evidence?.receipt.mode === "synthetic" && <p className="mt-2 font-semibold">SYNTHETIC commercial fixture · no live sales validation</p>}
    {ranking.score !== undefined && <p className="mt-2 font-semibold">Buyer utility: {ranking.score.toFixed(2)}</p>}
    <ul className="mt-2 list-inside list-disc break-words text-sm text-text-secondary">{[...ranking.explanations, ...ranking.gaps].map((line) => <li key={line}>{line}</li>)}</ul>
    <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Evidence start date"><input type="date" className={inputClass} disabled={busy} value={period.start} onChange={(event) => { setPeriod({ ...period, start: event.target.value }); onEvidence(undefined); }} /></Field><Field label="Evidence end date"><input type="date" className={inputClass} disabled={busy} value={period.end} onChange={(event) => { setPeriod({ ...period, end: event.target.value }); onEvidence(undefined); }} /></Field></div>
    <fieldset disabled={busy} className="mt-3"><legend className="text-sm font-semibold">Evidence stores (canonical Ursus mapping)</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{stores.map((store) => <label key={store.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={storeIds.includes(store.canonicalId!)} onChange={(event) => { setStoreIds(event.target.checked ? [...storeIds, store.canonicalId!] : storeIds.filter((id) => id !== store.canonicalId)); onEvidence(undefined); }} />{store.name} · {store.canonicalId}</label>)}</div></fieldset>
    {!stores.length && <p className="mt-2 text-sm text-warning">No verified store mappings are available.</p>}
    {skuChanged ? <p className="mt-2 text-sm text-warning">Save the SKU correction, then reconcile Product Master before loading new evidence. Previously saved receipts remain available below.</p> : !hasCurrentCommercialIdentity(item) && <p className="mt-2 text-sm text-warning">Reconcile the current SKU with Product Master before loading commercial evidence.</p>}
    <div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" disabled={busy || !canLoad} onClick={() => void run(() => load(false))}>Load observed sales</Button>{!platform.authEnabled && <Button variant="secondary" disabled={busy || !canLoad} onClick={() => void run(() => load(true))}>Load synthetic commercial fixture</Button>}</div>
    {error && <p role="status" className="mt-2 text-sm text-warning">{error}</p>}
    {evidence && <><p className="mt-3 text-sm">This receipt will be retained with the next Save review. A changed product identity requires a new load.</p><Button className="mt-2" variant="secondary" onClick={exportEvidence}>Export dated evidence JSON</Button><details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Dated observations ({evidence.observations.length})</summary><div className="overflow-x-auto"><table className="mt-2 w-full text-left text-xs"><thead><tr>{["Date", "Store", "Units", "Net revenue", "Total cost"].map((label) => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{evidence.observations.slice(page * 25, (page + 1) * 25).map((row) => <tr key={`${row.date}:${row.storeId}`}><td className="p-2">{row.date}</td><td className="p-2">{row.storeId}</td><td className="p-2">{row.units}</td><td className="p-2">{row.revenue.toFixed(2)}</td><td className="p-2">{row.cost.toFixed(2)}</td></tr>)}</tbody></table></div><div className="flex gap-2"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous observations</Button><Button variant="secondary" disabled={(page + 1) * 25 >= evidence.observations.length} onClick={() => setPage(page + 1)}>Next observations</Button></div></details></>}
    {!!item.intelligence.commercialDecisions?.length && <details open className="mt-4"><summary className="cursor-pointer font-semibold">Retained decision receipts ({item.intelligence.commercialDecisions.length})</summary><Button className="mt-2" variant="secondary" onClick={exportReceipts}>Export retained receipts JSON</Button><ul className="mt-2 space-y-2 text-xs">{item.intelligence.commercialDecisions.map((decision) => <li key={decision.id} className="break-words rounded-md bg-subtle p-3">{decision.decision} · {decision.actor} · {decision.at}<br />SKU {decision.receipt.sku} · {decision.receipt.scope.start} to {decision.receipt.scope.end} · Stores {decision.receipt.scope.storeIds.join(", ")}<br />{decision.receipt.mode.toUpperCase()} / {decision.receipt.qualification} · source revision {decision.receipt.sourceContract?.sourceRevision ?? "unverified"}<br />Receipt {decision.receipt.id} · SHA-256 {decision.receipt.observedSha256}<br />Historical decision evidence; current source freshness must be checked again.</li>)}</ul></details>}
  </Card>;
}
