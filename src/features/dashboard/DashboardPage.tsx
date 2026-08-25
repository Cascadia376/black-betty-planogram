import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  CalendarRange,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Lightbulb,
  Megaphone,
  Plus,
  Store,
  UploadCloud,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Card, DataState, EmptyState, PageHeader, formatDate, humanize } from "../../components/ui";
import { mockBusinessClock } from "../../services/clock";
import { usePlatform } from "../../services/PlatformProvider";

function isDueInDemoWeek(dueDate: string) {
  const start = new Date(`${mockBusinessClock.today()}T00:00:00Z`);
  const due = new Date(`${dueDate}T00:00:00Z`);
  const weekEnd = new Date(start);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  return due >= start && due <= weekEnd;
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string | number; detail: string }) {
  return (
    <Card className="flex min-h-28 flex-col justify-between p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 break-words text-[11px] font-medium leading-4 text-text-muted">{label}</p>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-subtle text-text-secondary"><Icon className="h-3.5 w-3.5" /></span>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-semibold leading-7 text-text-primary">{value}</p>
        <p className="mt-1 text-[11px] leading-4 text-text-muted">{detail}</p>
      </div>
    </Card>
  );
}

function SectionHeading({ title, action, to }: { title: string; action?: string; to?: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      {action && to && <Link className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover" to={to}>{action}<ArrowRight className="h-3.5 w-3.5" /></Link>}
    </div>
  );
}

function QuickAction({ icon: Icon, label, to, primary = false }: { icon: LucideIcon; label: string; to: string; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={`flex min-h-10 items-center justify-between gap-3 rounded-md px-3 text-sm font-semibold transition-colors ${primary ? "bg-primary text-primary-foreground hover:bg-primary-hover" : "border border-border bg-surface text-text-primary hover:bg-subtle"}`}
    >
      <span className="flex min-w-0 items-center gap-2"><Icon className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span></span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0" />
    </Link>
  );
}

export function DashboardPage() {
  const { data, loading, error, role } = usePlatform();
  const ondProgram = data?.programs.find((item) => item.status === "active") ?? data?.programs.find((item) => item.name.startsWith("OND"));
  const canEdit = role === "admin" || role === "merchandising";
  const activeCampaigns = data?.campaigns.filter((campaign) => campaign.status === "active") ?? [];
  const monthlyFlyer = activeCampaigns.find((campaign) => campaign.type === "Monthly flyer");
  const seasonalPrograms = data?.campaigns.filter((campaign) => campaign.type === "Seasonal") ?? [];
  const dueThisWeek = data?.executions.filter((execution) => execution.status !== "completed" && isDueInDemoWeek(execution.dueDate)) ?? [];
  const completedExecutions = data?.executions.filter((execution) => execution.status === "completed").length ?? 0;
  const executionCount = data?.executions.length ?? 0;
  const executionProgress = executionCount ? Math.round((completedExecutions / executionCount) * 100) : 0;
  const awaitingReview = data?.executions.filter(
    (execution) => execution.submission && !data.complianceReviews.some((review) => review.executionId === execution.id),
  ) ?? [];
  const complianceExecutionId = awaitingReview[0]?.id ?? data?.complianceReviews[0]?.executionId;
  const openRecommendations = data?.recommendations.filter((recommendation) => recommendation.status === "open") ?? [];
  const rankedAreas = [...(data?.performance ?? [])].sort((a, b) => b.salesLiftPercent - a.salesLiftPercent);

  return (
    <DataState loading={loading} error={error}>
      <PageHeader
        eyebrow="Overview"
        title="Merchandising Dashboard"
        description="Campaign execution, compliance, and display performance across the Crown Isle pilot."
        actions={<Badge tone="info">Synthetic demo data</Badge>}
      />

      <div className="grid min-w-0 gap-5 xl:grid-cols-[226px_minmax(0,1fr)]">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase text-text-muted">Quick actions</p>
          <div className="mt-3 grid gap-2">
            {canEdit && <QuickAction icon={Plus} label="New campaign" to="/campaigns/new" primary />}
            {ondProgram && <QuickAction icon={CalendarRange} label={`Open ${ondProgram.name}`} to={`/programs/${ondProgram.id}`} />}
            <QuickAction icon={UploadCloud} label="Upload spreadsheets" to="/imports" />
            <QuickAction icon={Megaphone} label="View campaigns" to="/campaigns" />
            {complianceExecutionId && <QuickAction icon={ClipboardCheck} label="Review compliance" to={`/compliance/${complianceExecutionId}`} />}
            <QuickAction icon={BarChart3} label="View performance" to="/performance" />
          </div>
        </Card>

        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <MetricCard icon={Megaphone} label="Active campaigns" value={activeCampaigns.length} detail="Currently in market" />
          <MetricCard icon={CalendarClock} label="Displays due this week" value={dueThisWeek.length} detail="Demo week, Aug 24-30" />
          <MetricCard icon={Store} label="Store execution" value={`${executionProgress}%`} detail={`${completedExecutions} of ${executionCount} completed`} />
          <MetricCard icon={ClipboardCheck} label="Compliance review" value={awaitingReview.length} detail="Submitted and awaiting review" />
          <MetricCard icon={Lightbulb} label="Recommendations" value={openRecommendations.length} detail="Open advisory items" />
        </div>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="grid min-w-0 content-start gap-5">
          <Card className="overflow-hidden p-0">
            <SectionHeading title="Current monthly flyer" action="View campaign" to={monthlyFlyer ? `/campaigns/${monthlyFlyer.id}` : "/campaigns"} />
            {monthlyFlyer ? (
              <Link to={`/campaigns/${monthlyFlyer.id}`} className="group block p-5 hover:bg-subtle/50">
                <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><Badge tone="success">Active</Badge><span className="text-xs text-text-muted">{monthlyFlyer.type}</span></div>
                    <h3 className="mt-3 text-lg font-semibold text-text-primary group-hover:text-primary">{monthlyFlyer.name}</h3>
                    <p className="mt-1 max-w-xl text-sm leading-5 text-text-secondary">{monthlyFlyer.description}</p>
                  </div>
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-primary-subtle text-primary"><Megaphone className="h-5 w-5" /></span>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
                  <div><dt className="text-[11px] text-text-muted">Run dates</dt><dd className="mt-1 text-xs font-semibold">{formatDate(monthlyFlyer.startDate)} - {formatDate(monthlyFlyer.endDate)}</dd></div>
                  <div><dt className="text-[11px] text-text-muted">Owner</dt><dd className="mt-1 text-xs font-semibold">{monthlyFlyer.owner}</dd></div>
                  <div><dt className="text-[11px] text-text-muted">Products</dt><dd className="mt-1 text-xs font-semibold">{monthlyFlyer.products.length} featured SKUs</dd></div>
                  <div><dt className="text-[11px] text-text-muted">Priority</dt><dd className="mt-1 text-xs font-semibold">{humanize(monthlyFlyer.requirement.priority)}</dd></div>
                </dl>
              </Link>
            ) : <div className="p-5"><EmptyState title="No active monthly flyer" message="The current monthly program will appear here when scheduled." /></div>}
          </Card>

          <Card className="overflow-hidden p-0">
            <SectionHeading title="Displays due this week" action="Open store workspace" to={data?.stores[0] ? `/stores/${data.stores[0].id}/workspace` : "/"} />
            {dueThisWeek.length ? (
              <div className="divide-y divide-border">
                {dueThisWeek.map((execution) => {
                  const assignment = data?.assignments.find((item) => item.id === execution.assignmentId);
                  const campaign = data?.campaigns.find((item) => item.id === assignment?.campaignId);
                  const area = data?.displayAreas.find((item) => item.id === assignment?.displayAreaId);
                  return (
                    <Link key={execution.id} to={`/executions/${execution.id}`} className="flex min-w-0 items-center justify-between gap-4 px-5 py-4 hover:bg-subtle/50">
                      <div className="min-w-0"><p className="truncate text-sm font-semibold text-text-primary">{campaign?.name}</p><p className="mt-1 truncate text-xs text-text-muted">Crown Isle / {area?.name} · Due {formatDate(execution.dueDate)}</p></div>
                      <Badge tone={execution.status === "issue" ? "error" : "warning"}>{humanize(execution.status)}</Badge>
                    </Link>
                  );
                })}
              </div>
            ) : <div className="p-5"><EmptyState title="No displays due this week" message="There are no incomplete display tasks due in the demo week." /></div>}
          </Card>

          <Card className="overflow-hidden p-0">
            <SectionHeading title="Seasonal programs" action="View campaigns" to="/campaigns" />
            <div className="divide-y divide-border">
              {seasonalPrograms.map((campaign) => (
                <Link key={campaign.id} to={`/campaigns/${campaign.id}`} className="flex min-w-0 items-center justify-between gap-4 px-5 py-4 hover:bg-subtle/50">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-text-primary">{campaign.name}</p><p className="mt-1 text-xs text-text-muted">{formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}</p></div>
                  <Badge tone={campaign.status === "completed" ? "neutral" : campaign.status === "active" ? "success" : "info"}>{humanize(campaign.status)}</Badge>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        <aside className="grid min-w-0 content-start gap-5">
          <Card className="overflow-hidden p-0">
            <SectionHeading title="Store execution progress" />
            <div className="p-5">
              {data?.stores.map((store) => {
                const assignmentIds = data.assignments.filter((assignment) => assignment.storeId === store.id).map((assignment) => assignment.id);
                const displayAssignmentIds = data.displayAssignments.filter((assignment) => assignment.storeId === store.id).map((assignment) => assignment.id);
                const storeExecutions = data.executions.filter((execution) =>
                  (execution.assignmentId ? assignmentIds.includes(execution.assignmentId) : false)
                  || (execution.displayAssignmentId ? displayAssignmentIds.includes(execution.displayAssignmentId) : false),
                );
                const storeCompleted = storeExecutions.filter((execution) => execution.status === "completed").length;
                const progress = storeExecutions.length ? Math.round((storeCompleted / storeExecutions.length) * 100) : 0;
                return (
                  <div key={store.id}>
                    <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold">{store.name}</span><span className="text-text-secondary">{progress}%</span></div>
                    <div className="mt-3 h-2 overflow-hidden rounded bg-subtle" aria-label={`${store.name} execution progress`} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded bg-success" style={{ width: `${progress}%` }} /></div>
                    <p className="mt-2 text-xs text-text-muted">{storeCompleted} of {storeExecutions.length} display tasks completed</p>
                    <Link className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary" to={`/stores/${store.id}/workspace`}>Open workspace <ArrowRight className="h-3.5 w-3.5" /></Link>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <SectionHeading title="Compliance requiring review" action={complianceExecutionId ? "Review compliance" : undefined} to={complianceExecutionId ? `/compliance/${complianceExecutionId}` : undefined} />
            <div className="p-5">
              {awaitingReview.length ? awaitingReview.map((execution) => (
                <Link key={execution.id} to={`/compliance/${execution.id}`} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 hover:bg-subtle"><span className="text-sm font-semibold">Submitted display</span><Badge tone="warning">Review</Badge></Link>
              )) : (
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-success-subtle text-success"><CheckCircle2 className="h-4 w-4" /></span>
                  <div><p className="text-sm font-semibold">Review queue is clear</p><p className="mt-1 text-xs leading-5 text-text-muted">All submitted displays have a recorded compliance decision.</p></div>
                </div>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <SectionHeading title="Recommendations requiring attention" action="View all" to="/performance?view=recommendations" />
            <div className="divide-y divide-border">
              {openRecommendations.slice(0, 3).map((recommendation) => {
                const area = data?.displayAreas.find((item) => item.id === recommendation.displayAreaId);
                return (
                  <Link key={recommendation.id} to="/performance?view=recommendations" className="block px-5 py-4 hover:bg-subtle/50">
                    <div className="flex items-start gap-3"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><div className="min-w-0"><p className="text-sm font-semibold leading-5 text-text-primary">{recommendation.title}</p><p className="mt-1 text-xs text-text-muted">Crown Isle / {area?.name} · Advisory only</p></div></div>
                  </Link>
                );
              })}
            </div>
          </Card>
        </aside>
      </div>

      <Card className="overflow-hidden p-0">
        <SectionHeading title="Top-performing display areas" action="View performance" to="/performance" />
        <div className="divide-y divide-border">
          {rankedAreas.slice(0, 3).map((record, index) => {
            const area = data?.displayAreas.find((item) => item.id === record.displayAreaId);
            const campaign = data?.campaigns.find((item) => item.id === record.campaignId);
            return (
              <Link key={record.id} to={`/display-areas/${record.displayAreaId}`} className="grid min-w-0 grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 hover:bg-subtle/50 sm:grid-cols-[32px_minmax(0,1fr)_120px_100px]">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-subtle text-xs font-semibold text-text-secondary">{index + 1}</span>
                <div className="min-w-0"><p className="truncate text-sm font-semibold">Crown Isle / {area?.name}</p><p className="mt-1 truncate text-xs text-text-muted">{campaign?.name} · Mock measured period</p></div>
                <div className="hidden sm:block"><p className="text-[11px] text-text-muted">Compliance</p><p className="mt-1 text-sm font-semibold">{record.compliancePercent}%</p></div>
                <div className="text-right"><p className="text-[11px] text-text-muted">Sales lift</p><p className="mt-1 text-sm font-semibold text-success">{record.salesLiftPercent > 0 ? "+" : ""}{record.salesLiftPercent}%</p></div>
              </Link>
            );
          })}
        </div>
        <p className="border-t border-border bg-subtle/50 px-5 py-3 text-[11px] leading-4 text-text-muted">Performance values are synthetic development data and do not represent Cascadia business results.</p>
      </Card>
    </DataState>
  );
}
