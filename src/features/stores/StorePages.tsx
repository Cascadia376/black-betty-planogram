import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, MapPin, X } from "lucide-react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { clsx } from "clsx";
import { Badge, Card, DataState, EmptyState, PageHeader, formatDate, humanize } from "../../components/ui";
import { usePlatform } from "../../services/PlatformProvider";
import { displayAreaStateLabels, FloorplanCanvas, type DisplayAreaState } from "./FloorplanCanvas";
import { ProgramDisplaySchedulePanel } from "./ProgramDisplaySchedulePanel";
import { orderStatusForAssignment } from "./programSchedule";

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
  const selectedProgram = data?.programs.find((item) => item.id === params.get("program"));
  const programAssignments = data?.displayAssignments.filter((item) => item.programId === selectedProgram?.id && item.storeId === storeId && item.status !== "cancelled") ?? [];
  const operationalStateFor = (areaId: string): DisplayAreaState => {
    if (selectedProgram && data) {
      const scheduled = programAssignments.filter((assignment) => assignment.displayAreaId === areaId);
      if (scheduled.length === 0) return "available";
      if (scheduled.some((assignment) => {
        const status = orderStatusForAssignment(assignment, data);
        return status === "at_risk" || status === "order_required";
      })) return "requires_attention";
      if (scheduled.length > 1 || scheduled.some((assignment) => assignment.resetRequired)) return "upcoming_reset";
      return "current";
    }
    const assignment = data?.assignments.find((item) => {
      const campaign = data.campaigns.find((candidate) => candidate.id === item.campaignId);
      return item.displayAreaId === areaId && (campaign?.status === "active" || campaign?.status === "scheduled");
    });
    if (!assignment) return "available";
    const execution = data?.executions.find((item) => item.assignmentId === assignment.id);
    if (execution?.status === "issue") return "requires_attention";
    const campaign = data?.campaigns.find((item) => item.id === assignment.campaignId);
    return campaign?.status === "active" ? "active_campaign" : "upcoming_campaign";
  };
  const stateFor = (areaId: string): DisplayAreaState => selected?.id === areaId ? "selected" : operationalStateFor(areaId);

  const details = selected ? (() => {
    const assignments = data?.assignments.filter((item) => item.displayAreaId === selected.id) ?? [];
    const assignment = assignments.find((item) => data?.campaigns.find((campaign) => campaign.id === item.campaignId)?.status === "active")
      ?? assignments.find((item) => data?.campaigns.find((campaign) => campaign.id === item.campaignId)?.status === "scheduled");
    const campaign = data?.campaigns.find((item) => item.id === assignment?.campaignId);
    const execution = data?.executions.find((item) => item.assignmentId === assignment?.id);
    const review = data?.complianceReviews.find((item) => item.executionId === execution?.id);
    const performance = [...(data?.performance.filter((item) => item.displayAreaId === selected.id) ?? [])]
      .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];
    return {
      zone: zones.find((item) => item.id === selected.zoneId),
      fixture: fixtures.find((item) => item.id === selected.fixtureId),
      campaign,
      execution,
      review,
      performance,
      state: operationalStateFor(selected.id),
    };
  })() : undefined;

  const selectArea = (areaId: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("area", areaId);
      return next;
    });
  };
  const clearSelection = () => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("area");
      return next;
    });
  };
  const legendStyles: Record<DisplayAreaState, string> = {
    available: "border-border-strong bg-surface",
    active_campaign: "border-success bg-success",
    upcoming_campaign: "border-info bg-info",
    current: "border-success bg-success",
    upcoming_reset: "border-warning bg-warning",
    requires_attention: "border-error bg-error",
    selected: "border-primary bg-primary ring-2 ring-focus",
  };
  const legendStates: DisplayAreaState[] = selectedProgram
    ? ["available", "current", "upcoming_reset", "requires_attention", "selected"]
    : ["available", "active_campaign", "upcoming_campaign", "requires_attention", "selected"];
  const badgeTone = (state: DisplayAreaState) => state === "active_campaign" || state === "current" ? "success" : state === "upcoming_campaign" ? "info" : state === "upcoming_reset" ? "warning" : state === "requires_attention" ? "error" : "neutral";

  return (
    <DataState loading={loading} error={error}>
      {!store ? <EmptyState title="Store not found" message="The requested store is not available." /> : (
        <>
          <PageHeader
            eyebrow="Persistent display areas"
            title={`${store.name} floorplan`}
            description={selectedProgram ? `${selectedProgram.name} display schedule across persistent merchandising assets.` : "A simplified spatial index of zones, fixtures, and reusable merchandising assets."}
            actions={
              <>
                {selectedProgram && <Link className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle" to={`/programs/${selectedProgram.id}`}>Open program</Link>}
                <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle" to={`/stores/${store.id}/workspace`}>Store workspace <ArrowRight className="h-4 w-4" /></Link>
              </>
            }
          />

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="min-w-0 overflow-hidden p-0">
              <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Store layout</h2>
                  <p className="mt-1 text-xs text-text-muted">{areas.length} persistent display areas · simplified context</p>
                </div>
                <div aria-label="Display area state legend" className="flex flex-wrap gap-x-3 gap-y-2 text-[11px] text-text-secondary">
                  {legendStates.map((state) => (
                    <span key={state} className="flex items-center gap-1.5">
                      <i aria-hidden="true" className={clsx("h-3 w-3 rounded-sm border-2", legendStyles[state])} />
                      {displayAreaStateLabels[state]}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-4 sm:p-5">
                <FloorplanCanvas
                  storeName={store.name}
                  zones={zones}
                  fixtures={fixtures}
                  areas={areas}
                  selectedAreaId={selected?.id}
                  stateFor={stateFor}
                  onSelect={selectArea}
                />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] leading-4 text-text-muted">Numbered markers are persistent display areas. Structural labels provide simplified visual context only.</p>
                  {selected && <button type="button" onClick={clearSelection} className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-semibold hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><X className="h-3.5 w-3.5" />Clear selection</button>}
                </div>
              </div>
            </Card>

            <aside className="min-w-0">
              {selected && selectedProgram && data ? (
                <ProgramDisplaySchedulePanel area={selected} programId={selectedProgram.id} data={data} />
              ) : selected && details ? (
                <Card className="overflow-hidden p-0 xl:sticky xl:top-24">
                  <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase text-text-muted">Persistent display area</p>
                      <h2 className="mt-1 truncate text-lg font-semibold">{selected.name}</h2>
                    </div>
                    <Badge tone={badgeTone(details.state)}>{displayAreaStateLabels[details.state]}</Badge>
                  </div>
                  <div className="divide-y divide-border">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 text-xs">
                      <div><dt className="text-text-muted">Type</dt><dd className="mt-1 font-semibold">{humanize(selected.type)}</dd></div>
                      <div><dt className="text-text-muted">Capacity</dt><dd className="mt-1 font-semibold">{selected.capacity}</dd></div>
                      <div><dt className="text-text-muted">Zone</dt><dd className="mt-1 font-semibold">{details.zone?.name ?? "Not mapped"}</dd></div>
                      <div><dt className="text-text-muted">Fixture</dt><dd className="mt-1 font-semibold">{details.fixture?.name ?? "Not mapped"}</dd></div>
                    </dl>
                    <div className="px-5 py-4">
                      <p className="text-[11px] font-semibold uppercase text-text-muted">Current or upcoming campaign</p>
                      {details.campaign ? (
                        <div className="mt-2">
                          <Link className="text-sm font-semibold text-primary hover:text-primary-hover" to={`/campaigns/${details.campaign.id}`}>{details.campaign.name}</Link>
                          <p className="mt-1 text-xs text-text-muted">{formatDate(details.campaign.startDate)} - {formatDate(details.campaign.endDate)}</p>
                        </div>
                      ) : <p className="mt-2 text-sm font-semibold">Available</p>}
                    </div>
                    <dl className="space-y-3 px-5 py-4 text-xs">
                      <div className="flex items-center justify-between gap-3"><dt className="text-text-muted">Execution status</dt><dd>{details.execution ? <Badge tone={details.execution.status === "issue" ? "error" : details.execution.status === "completed" ? "success" : "warning"}>{humanize(details.execution.status)}</Badge> : <span className="font-semibold">No open task</span>}</dd></div>
                      <div className="flex items-center justify-between gap-3"><dt className="text-text-muted">Compliance</dt><dd className="text-right font-semibold">{details.review ? `${details.review.score}% · ${humanize(details.review.decision)}` : "Not reviewed"}</dd></div>
                      <div className="flex items-center justify-between gap-3"><dt className="text-text-muted">Most recent performance</dt><dd className="text-right font-semibold">{details.performance ? `${details.performance.salesLiftPercent > 0 ? "+" : ""}${details.performance.salesLiftPercent}% mock sales lift` : "Limited data"}</dd></div>
                    </dl>
                  </div>
                  <div className="border-t border-border bg-subtle/50 p-4">
                    <Link className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover" to={`/display-areas/${selected.id}`}>
                      Persistent Display Area Profile <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </Card>
              ) : (
                <Card className="xl:sticky xl:top-24">
                  <div className="grid min-h-64 place-items-center text-center">
                    <div>
                      <span className="mx-auto grid h-10 w-10 place-items-center rounded-md bg-primary-subtle text-primary"><MapPin className="h-5 w-5" /></span>
                      <h2 className="mt-3 text-sm font-semibold">Select a display area</h2>
                      <p className="mx-auto mt-1 max-w-56 text-xs leading-5 text-text-muted">Use a numbered marker to inspect its physical details, campaign, execution, and performance.</p>
                    </div>
                  </div>
                </Card>
              )}
            </aside>
          </div>
        </>
      )}
    </DataState>
  );
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
