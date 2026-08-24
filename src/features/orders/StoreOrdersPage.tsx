import { AlertTriangle, CheckCircle2, Clock3, PackageCheck, ShoppingCart, TrendingDown } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Badge, Card, DataState, EmptyState, PageHeader } from "../../components/ui";
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
  const { data, loading, error, updateOrderRecommendation } = usePlatform();
  const store = data?.stores.find((item) => item.id === storeId);
  const program = data?.programs.find((item) => item.id === programId);
  const items = data && storeId ? buildOrderWorkspaceItems(data, storeId, programId) : [];

  return <DataState loading={loading} error={error}>{!store || !data ? <EmptyState title="Store not found" message="The ordering workspace needs a valid store." /> : <>
    <PageHeader eyebrow="Store ordering assistant" title={`${store.name} orders`} description={`What needs to be ordered or reviewed today? ${program ? `${program.name} · ` : ""}Synthetic operational recommendations only; forecast need is not calculated.`} actions={<><Link className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle" to={`/stores/${store.id}/workspace`}>Store workspace</Link><Link className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle" to={`/stores/${store.id}/floorplan${programId ? `?program=${programId}` : ""}`}>View floorplan</Link></>} />
    <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{groups.map((group) => { const Icon = group.icon; const count = items.filter((item) => item.group === group.id).length; return <Card key={group.id} className="p-4"><div className="flex items-center justify-between gap-2"><span className="grid h-8 w-8 place-items-center rounded-md bg-subtle text-text-secondary"><Icon className="h-4 w-4" /></span><Badge>{count}</Badge></div><p className="mt-3 text-xs font-semibold">{group.title}</p></Card>; })}</div>
    <div className="mt-4 space-y-4">{groups.map((group) => { const groupItems = items.filter((item) => item.group === group.id); const Icon = group.icon; return <section key={group.id} aria-labelledby={`orders-${group.id}`} className="min-w-0"><div className="mb-2 flex items-center gap-2"><Icon className="h-4 w-4 text-text-muted" /><h2 id={`orders-${group.id}`} className="text-sm font-semibold">{group.title}</h2><Badge>{groupItems.length}</Badge></div><p className="mb-3 text-xs text-text-muted">{group.description}</p>{groupItems.length ? <div className="space-y-3">{groupItems.map((item) => <OrderRecommendationCard key={item.recommendation.id} item={item} data={data} programId={programId} update={updateOrderRecommendation} />)}</div> : <div className="rounded-md border border-dashed border-border bg-surface px-4 py-5 text-sm text-text-muted">No recommendations in this group.</div>}</section>; })}</div>
  </>}</DataState>;
}
