import { AlertTriangle, CheckCircle2, Clock3, PackageCheck, ShoppingCart, TrendingDown } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Badge, Button, Card, DataState, EmptyState, PageHeader, formatDate } from "../../components/ui";
import type { PlatformSnapshot } from "../../domain/types";
import { usePlatform } from "../../services/PlatformProvider";
import { OrderRecommendationCard } from "./OrderRecommendationCard";
import { buildOrderWorkspaceItems, type OrderWorkspaceGroup } from "./orderingWorkspace";

const groups: { id: OrderWorkspaceGroup; title: string; description: string; icon: typeof ShoppingCart }[] = [
  { id: "order_today", title: "Order today", description: "Actionable recommendations with a supplier path that can meet the required date.", icon: ShoppingCart },
  { id: "at_risk", title: "At risk", description: "Required stock needs supplier or timing review before an order can be confirmed.", icon: AlertTriangle },
  { id: "covered", title: "Covered", description: "Recorded on-hand and ordering decisions cover the current display requirement.", icon: CheckCircle2 },
  { id: "arriving_soon", title: "Arriving soon", description: "Recommendations marked ordered or covered by qualifying inbound cases.", icon: Clock3 },
  { id: "potential_residual", title: "Potential unwanted residual", description: "Exit-oriented items that need post-program inventory control.", icon: TrendingDown },
  { id: "intentional_bridge", title: "Intentional bridge inventory", description: "Centrally defined Buying strategies; store managers can act on the recommendation but cannot change policy.", icon: PackageCheck },
];

export function StoreOrdersPage() {
  const { storeId } = useParams();
  const [searchParams] = useSearchParams();
  const programId = searchParams.get("program") ?? undefined;
  const { data, loading, error, updateOrderRecommendation, createPurchaseOrder, refreshOrderRecommendations } = usePlatform();
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const store = data?.stores.find((item) => item.id === storeId);
  const program = data?.programs.find((item) => item.id === programId);
  const items = data && storeId ? buildOrderWorkspaceItems(data, storeId, programId) : [];

  const refresh = async () => {
    if (!programId || !store) return;
    setActionError("");
    try { const count = await refreshOrderRecommendations({ programId, storeId: store.id }); setActionMessage(`${count} recommendations refreshed.`); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Refresh failed."); }
  };

  return <DataState loading={loading} error={error}>{!store || !data ? <EmptyState title="Store not found" message="The ordering workspace needs a valid store." /> : <>
    <PageHeader eyebrow="Store ordering assistant" title={`${store.name} orders`} description={`What needs to be ordered or reviewed today? ${program ? `${program.name} · ` : ""}Synthetic, explainable demand and supplier rules.`} actions={<><Link className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle" to={`/stores/${store.id}/workspace`}>Store workspace</Link><Link className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle" to={`/stores/${store.id}/floorplan${programId ? `?program=${programId}` : ""}`}>View floorplan</Link>{programId && <Button type="button" variant="secondary" onClick={() => void refresh()}>Refresh recommendations</Button>}</>} />
    {actionMessage && <div role="status" className="rounded-md border border-success/30 bg-success-subtle p-3 text-sm text-success">{actionMessage}</div>}
    {actionError && <div role="alert" className="rounded-md border border-error/30 bg-error-subtle p-3 text-sm text-error">{actionError}</div>}
    <SupplierOrderBatches data={data} storeId={store.id} programId={programId} createOrder={async (supplierId, recommendationIds) => {
      setActionError("");
      try { const id = await createPurchaseOrder({ storeId: store.id, supplierId, programId, recommendationIds }); setActionMessage(`Supplier order ${id.slice(0, 8)} created.`); }
      catch (cause) { setActionError(cause instanceof Error ? cause.message : "Unable to create supplier order."); }
    }} />
    <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{groups.map((group) => { const Icon = group.icon; const count = items.filter((item) => item.group === group.id).length; return <Card key={group.id} className="p-4"><div className="flex items-center justify-between gap-2"><span className="grid h-8 w-8 place-items-center rounded-md bg-subtle text-text-secondary"><Icon className="h-4 w-4" /></span><Badge>{count}</Badge></div><p className="mt-3 text-xs font-semibold">{group.title}</p></Card>; })}</div>
    <div className="mt-4 space-y-4">{groups.map((group) => { const groupItems = items.filter((item) => item.group === group.id); const Icon = group.icon; return <section key={group.id} aria-labelledby={`orders-${group.id}`} className="min-w-0"><div className="mb-2 flex items-center gap-2"><Icon className="h-4 w-4 text-text-muted" /><h2 id={`orders-${group.id}`} className="text-sm font-semibold">{group.title}</h2><Badge>{groupItems.length}</Badge></div><p className="mb-3 text-xs text-text-muted">{group.description}</p>{groupItems.length ? <div className="space-y-3">{groupItems.map((item) => <OrderRecommendationCard key={item.recommendation.id} item={item} data={data} programId={programId} update={updateOrderRecommendation} />)}</div> : <div className="rounded-md border border-dashed border-border bg-surface px-4 py-5 text-sm text-text-muted">No recommendations in this group.</div>}</section>; })}</div>
  </>}</DataState>;
}

function SupplierOrderBatches({ data, storeId, programId, createOrder }: { data: PlatformSnapshot; storeId: string; programId?: string; createOrder(supplierId: string, recommendationIds: string[]): Promise<void> }) {
  const assignmentIds = new Set(data.displayAssignments.filter((item) => item.storeId === storeId && (!programId || item.programId === programId)).map((item) => item.id));
  const actionable = data.orderRecommendations.filter((item) => item.storeId === storeId && assignmentIds.has(item.displayAssignmentId ?? "") && item.recommendedCases > 0 && !["dismissed", "ordered"].includes(item.status));
  const suppliers = [...new Set(actionable.map((item) => item.supplierId))];
  const orders = data.purchaseOrders.filter((item) => item.storeId === storeId && (!programId || item.programId === programId));
  return <Card className="mt-5 p-0"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Supplier order batches</h2><p className="mt-1 text-xs text-text-muted">Actionable recommendations grouped into one submitted mock order per supplier.</p></div><div className="divide-y divide-border">{suppliers.map((supplierId) => {
    const supplier = data.suppliers.find((item) => item.id === supplierId);
    const recommendations = actionable.filter((item) => item.supplierId === supplierId);
    return <div key={supplierId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-semibold">{supplier?.name ?? "Supplier not configured"}</p><p className="mt-1 text-xs text-text-muted">{recommendations.length} products · {recommendations.reduce((sum, item) => sum + item.recommendedCases, 0)} cases</p></div><Button type="button" onClick={() => void createOrder(supplierId, recommendations.map((item) => item.id))}><ShoppingCart className="h-4 w-4" />Create supplier order</Button></div>;
  })}{!suppliers.length && <p className="px-4 py-4 text-sm text-text-muted">No recommendations are ready to batch.</p>}</div>{orders.length > 0 && <div className="border-t border-border bg-subtle/50 px-4 py-3"><p className="text-xs font-semibold">Submitted orders</p><div className="mt-2 flex flex-wrap gap-2">{orders.map((order) => <Badge key={order.id} tone="success">{data.suppliers.find((item) => item.id === order.supplierId)?.name ?? "Supplier"} · {order.lines.reduce((sum, line) => sum + line.cases, 0)} cases · due {formatDate(order.expectedArrivalDate)}</Badge>)}</div></div>}</Card>;
}
