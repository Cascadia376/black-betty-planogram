import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, MapPin } from "lucide-react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { clsx } from "clsx";
import { Badge, Card, DataState, EmptyState, PageHeader, formatDate, humanize } from "../../components/ui";
import { usePlatform } from "../../services/PlatformProvider";

export function StoreOverviewPage() {
  const { storeId } = useParams();
  return <Navigate replace to={`/stores/${storeId}/workspace`} />;
}

export function StoreFloorplanPage() {
  const { storeId } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, loading, error } = usePlatform();
  const store = data?.stores.find((item) => item.id === storeId);
  const zones = data?.zones.filter((item) => item.storeId === storeId) ?? [];
  const fixtures = data?.fixtures.filter((item) => item.storeId === storeId) ?? [];
  const areas = data?.displayAreas.filter((item) => item.storeId === storeId) ?? [];
  const selected = areas.find((item) => item.id === params.get("area"));
  const details = selected ? (() => {
    const assignments = data?.assignments.filter((item) => item.displayAreaId === selected.id) ?? [];
    const current = assignments.find((item) => data?.campaigns.find((campaign) => campaign.id === item.campaignId)?.status === "active");
    const upcoming = assignments.find((item) => data?.campaigns.find((campaign) => campaign.id === item.campaignId)?.status === "scheduled");
    const assignment = current ?? upcoming;
    const campaign = data?.campaigns.find((item) => item.id === assignment?.campaignId);
    const execution = data?.executions.find((item) => item.assignmentId === assignment?.id);
    const review = data?.complianceReviews.find((item) => item.executionId === execution?.id);
    const performance = data?.performance.filter((item) => item.displayAreaId === selected.id).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];
    return { campaign, execution, review, performance };
  })() : undefined;
  const stateFor = (areaId: string) => {
    if (selected?.id === areaId) return "selected";
    const assignment = data?.assignments.find((item) => item.displayAreaId === areaId && data.campaigns.find((campaign) => campaign.id === item.campaignId)?.status !== "completed");
    if (!assignment) return "available";
    const campaign = data?.campaigns.find((item) => item.id === assignment.campaignId);
    const execution = data?.executions.find((item) => item.assignmentId === assignment.id);
    if (execution?.status === "issue") return "requires_attention";
    return campaign?.status === "active" ? "active_campaign" : "upcoming_campaign";
  };
  const stateClass = { available: "border-text-muted bg-surface", active_campaign: "border-success bg-success", upcoming_campaign: "border-info bg-info", requires_attention: "border-error bg-error", selected: "border-primary bg-primary ring-4 ring-primary/25" };
  return <DataState loading={loading} error={error}>{!store ? <EmptyState title="Store not found" message="The requested store is not available." /> : <><PageHeader eyebrow="Locate" title={`${store.name} floorplan`} description="A spatial index of persistent merchandising assets. Geometry is normalized and responsive; ordinary shelf positions are intentionally excluded." actions={<Link className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold" to={`/stores/${store.id}/workspace`}>Store workspace</Link>} />
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"><Card className="overflow-hidden"><div className="mb-3 flex flex-wrap gap-4 text-xs">{[{ key: "available", label: "Available" }, { key: "active_campaign", label: "Active" }, { key: "upcoming_campaign", label: "Upcoming" }, { key: "requires_attention", label: "Attention" }].map((item) => <span key={item.key} className="flex items-center gap-1.5"><i className={clsx("h-3 w-3 border-2", stateClass[item.key as keyof typeof stateClass])} />{item.label}</span>)}</div><div className="relative mx-auto aspect-[4/3] w-full max-w-5xl overflow-hidden border-8 border-locked bg-surface" aria-label={`${store.name} merchandising floorplan`}>
      <div className="absolute left-[2%] top-[45%] flex h-[15%] w-[12%] items-center justify-center border border-dashed border-text-muted bg-subtle text-xs font-medium">Checkout</div><div className="absolute bottom-[3%] left-[38%] text-xs font-semibold text-text-muted">ENTRANCE</div>
      {zones.map((zone) => <div key={zone.id} className="absolute border border-dashed border-border bg-subtle/35 p-2 text-[10px] font-semibold uppercase text-text-muted" style={{ left: `${zone.geometry.x * 100}%`, top: `${zone.geometry.y * 100}%`, width: `${zone.geometry.width * 100}%`, height: `${zone.geometry.height * 100}%` }}>{zone.name}</div>)}
      {fixtures.map((fixture) => <div key={fixture.id} className="absolute border border-locked/40 bg-locked/15" title={fixture.name} style={{ left: `${fixture.geometry.x * 100}%`, top: `${fixture.geometry.y * 100}%`, width: `${fixture.geometry.width * 100}%`, height: `${fixture.geometry.height * 100}%` }} />)}
      {areas.map((area) => { const state = stateFor(area.id); return <button key={area.id} aria-label={`${area.name}, ${humanize(state)}`} title={area.name} onClick={() => setParams({ area: area.id })} className={clsx("absolute z-10 border-2 shadow-sm transition hover:scale-110", stateClass[state])} style={{ left: `${area.geometry.x * 100}%`, top: `${area.geometry.y * 100}%`, width: `${Math.max(area.geometry.width * 100, 2.8)}%`, height: `${Math.max(area.geometry.height * 100, 4)}%` }} />; })}
    </div></Card><aside>{selected && details ? <Card><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase text-text-muted">Persistent display area</p><h2 className="mt-1 text-lg font-semibold">{selected.name}</h2></div><MapPin className="h-5 w-5 text-primary" /></div><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-text-muted">Type</dt><dd className="font-medium">{humanize(selected.type)}</dd></div><div><dt className="text-text-muted">Current program</dt><dd className="font-medium">{details.campaign?.name ?? "Available"}</dd></div><div><dt className="text-text-muted">Execution</dt><dd>{details.execution ? <Badge tone={details.execution.status === "issue" ? "error" : details.execution.status === "completed" ? "success" : "warning"}>{humanize(details.execution.status)}</Badge> : "No task"}</dd></div><div><dt className="text-text-muted">Compliance</dt><dd className="font-medium">{details.review ? `${details.review.score}% · ${humanize(details.review.decision)}` : "Not reviewed"}</dd></div><div><dt className="text-text-muted">Recent performance</dt><dd className="font-medium">{details.performance ? `${details.performance.salesLiftPercent > 0 ? "+" : ""}${details.performance.salesLiftPercent}% mock sales lift` : "Limited data"}</dd></div></dl><Link className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary" to={`/display-areas/${selected.id}`}>Open area profile <ArrowRight className="h-4 w-4" /></Link></Card> : <Card><div className="grid min-h-56 place-items-center text-center"><div><MapPin className="mx-auto h-6 w-6 text-text-muted" /><p className="mt-3 font-medium">Select a display area</p><p className="mt-1 text-sm text-text-muted">Choose a highlighted asset to inspect its current campaign and history.</p></div></div></Card>}</aside></div>
  </>}</DataState>;
}

export function StoreWorkspacePage() {
  const { storeId } = useParams();
  const { data, loading, error } = usePlatform();
  const store = data?.stores.find((item) => item.id === storeId);
  const tasks = data?.executions.filter((execution) => data.assignments.find((assignment) => assignment.id === execution.assignmentId)?.storeId === storeId) ?? [];
  const iconFor = (status: string) => status === "completed" ? CheckCircle2 : status === "issue" ? AlertTriangle : Clock3;
  return <DataState loading={loading} error={error}>{!store ? <EmptyState title="Store not found" message="The requested store is not available." /> : <><PageHeader eyebrow="Execute" title={`${store.name} merchandising workspace`} description="What needs my attention? Open a task, find its display area, and report issues from one operational view." actions={<Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold" to={`/stores/${store.id}/floorplan`}><MapPin className="h-4 w-4" />View floorplan</Link>} />
    <div className="grid gap-3 sm:grid-cols-3">{[{ label: "Not started", value: tasks.filter((item) => item.status === "not_started").length }, { label: "In progress", value: tasks.filter((item) => item.status === "in_progress").length }, { label: "Issues", value: tasks.filter((item) => item.status === "issue").length }].map((item) => <Card key={item.label}><p className="text-sm text-text-muted">{item.label}</p><p className="mt-1 text-2xl font-semibold">{item.value}</p></Card>)}</div>
    <Card className="overflow-hidden p-0"><div className="border-b border-border px-4 py-3"><h2 className="font-semibold">Display tasks</h2></div><div className="divide-y divide-border">{tasks.map((execution) => { const assignment = data?.assignments.find((item) => item.id === execution.assignmentId); const campaign = data?.campaigns.find((item) => item.id === assignment?.campaignId); const area = data?.displayAreas.find((item) => item.id === assignment?.displayAreaId); const Icon = iconFor(execution.status); const required = campaign?.products.filter((item) => item.required) ?? []; return <div key={execution.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto] md:items-center"><div className="flex gap-3"><span className={clsx("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md", execution.status === "completed" ? "bg-success/10 text-success" : execution.status === "issue" ? "bg-error/10 text-error" : "bg-warning/10 text-warning")}><Icon className="h-4 w-4" /></span><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{campaign?.name}</p><Badge tone={execution.status === "completed" ? "success" : execution.status === "issue" ? "error" : "warning"}>{humanize(execution.status)}</Badge></div><p className="mt-1 text-sm text-text-secondary">{area?.name} · Due {formatDate(execution.dueDate)}</p><p className="mt-1 text-xs text-text-muted">Required SKUs: {required.map((item) => item.sku).join(", ")}</p></div></div><div className="flex gap-2"><Link className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold" to={`/stores/${store.id}/floorplan?area=${area?.id}`}>Locate</Link><Link className="inline-flex min-h-9 items-center gap-1 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground" to={`/executions/${execution.id}`}>Open task <ArrowRight className="h-4 w-4" /></Link></div></div>; })}</div></Card>
  </>}</DataState>;
}
