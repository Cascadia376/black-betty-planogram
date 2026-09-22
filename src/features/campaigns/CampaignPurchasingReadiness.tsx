import { useState } from "react";
import { Badge, Button, Card, Field, inputClass } from "../../components/ui";
import type { Product, Store } from "../../domain/types";
import { canonicalPurchasingStoreId, type CampaignPurchasingReadiness as Readiness, type PurchasingReadinessRequest } from "../../services/purchasingReadiness";

interface Props {
  campaignId: string;
  stores: Store[];
  products: Product[];
  available: boolean;
  load(request: PurchasingReadinessRequest): Promise<Readiness>;
}

export function CampaignPurchasingReadiness({ campaignId, stores, products, available, load }: Props) {
  const [storeId, setStoreId] = useState("");
  const [freshness, setFreshness] = useState("");
  const [requestState, setRequestState] = useState<{ key: string; loading?: boolean; data?: Readiness; error?: string }>();
  const canonicalId = canonicalPurchasingStoreId(storeId);
  const days = freshness === "" ? undefined : Number(freshness);
  const valid = canonicalId !== undefined && days !== undefined && Number.isInteger(days) && days >= 0;
  const key = JSON.stringify([campaignId, storeId, freshness]);
  const current = requestState?.key === key ? requestState : undefined;
  const names = new Map(products.map((product) => [product.id, product.name]));

  const refresh = async () => {
    if (!available || !valid) return;
    setRequestState({ key, loading: true });
    try {
      const data = await load({ campaign_id: campaignId, store_ids: [canonicalId], max_confirmation_age_days: days });
      setRequestState({ key, data });
    } catch (cause) {
      setRequestState({ key, error: cause instanceof Error ? cause.message : "Purchasing readiness could not be checked." });
    }
  };

  return <Card>
    <h2 className="font-semibold">Purchasing and stock readiness</h2>
    <p className="mt-2 text-sm text-text-secondary">A prepared, issued or sent PO does not prove stock will be ready. This check uses the exact campaign and current Ursus Major permissions; merchandising publication is separate.</p>
    {!available ? <p role="status" className="mt-3 text-sm text-text-muted">Unknown — sign in with the configured purchasing connection to check current evidence.</p> : <>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Readiness store"><select className={inputClass} value={storeId} onChange={(event) => setStoreId(event.target.value)}><option value="">Select a participating store</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></Field>
        <Field label="Confirmation freshness (days)" hint="Use the existing operating rule; this check does not change standing policy."><input aria-label="Confirmation freshness (days)" type="number" min="0" step="1" className={inputClass} value={freshness} onChange={(event) => setFreshness(event.target.value)} /></Field>
      </div>
      {storeId && canonicalId === undefined ? <p role="status" className="mt-3 text-sm text-text-muted">Unknown — this store has no verified Ursus Major mapping. No request was sent.</p> : null}
      <Button className="mt-4" variant="secondary" disabled={!valid || current?.loading} onClick={() => void refresh()}>{current?.loading ? "Checking readiness…" : "Check purchasing readiness"}</Button>
      {current?.error ? <p role="alert" className="mt-3 text-sm text-error">Unknown — {current.error}</p> : null}
      {current?.data ? <div className="mt-4 space-y-3">
        <p className="text-xs text-text-muted">Evidence date: {current.data.as_of}. Campaign: {current.data.campaign_id}. Source: {current.data.source_fingerprint.slice(0, 12)}.</p>
        {current.data.requirements.length === 0 ? <p className="text-sm text-text-muted">No purchasing requirements were returned for this selected scope.</p> : current.data.requirements.map((row) => <article key={row.key} className="rounded-md border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{row.sku} · {names.get(row.source_product_id ?? "") ?? "Campaign requirement"}</h3><Badge tone={row.status === "Ready" ? "success" : row.status === "Critical" ? "error" : row.status === "At risk" ? "warning" : "neutral"}>{row.status}</Badge></div>
          <p className="mt-2 text-sm text-text-secondary">Required {row.required_date ?? "date unknown"} · Target {row.required_units ?? "unknown"} units · Uncovered {row.uncovered_units ?? "unknown"} units.</p>
          <ul className="mt-2 list-inside list-disc text-sm text-text-secondary">{row.reasons.map((reason, index) => <li key={`${index}:${reason}`}>{reason}</li>)}</ul>
          {row.orders.length ? <ul className="mt-3 space-y-1 text-xs text-text-muted">{row.orders.map((order) => <li key={order.order_id}>{order.po_number ?? "Saved PO"}: {order.status}; {order.dispatched ? "dispatch recorded" : "not sent"}; {order.confirmed ? (order.confirmation_fresh ? "current confirmation" : "confirmation needs review") : "not supplier confirmed"}; {order.received_line_units} line units recorded received. Receipt annotations are not stock updates.</li>)}</ul> : <p className="mt-3 text-xs text-text-muted">No allocated saved PO.</p>}
        </article>)}
      </div> : null}
    </>}
  </Card>;
}
