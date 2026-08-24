import { ArrowRight, BarChart3, CalendarClock, ClipboardCheck, Megaphone, Plus, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { usePlatform } from "../../services/PlatformProvider";
import { Badge, Card, DataState, EmptyState, PageHeader, formatDate, humanize } from "../../components/ui";

export function DashboardPage() {
  const { data, loading, error, role } = usePlatform();
  const canEdit = role === "admin" || role === "merchandising";
  const active = data?.campaigns.filter((campaign) => campaign.status === "active") ?? [];
  const openTasks = data?.executions.filter((execution) => execution.status !== "completed") ?? [];
  const awaitingReview = data?.executions.filter((execution) => execution.submission && !data.complianceReviews.some((review) => review.executionId === execution.id)) ?? [];
  return <DataState loading={loading} error={error}>
    <PageHeader eyebrow="Overview" title="Merchandising Dashboard" description="Campaign execution, compliance, and display performance across the merchandising program." actions={<>
      {canEdit && <Link className="inline-flex min-h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground" to="/campaigns/new"><Plus className="h-4 w-4" />New campaign</Link>}
      <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold" to="/performance"><BarChart3 className="h-4 w-4" />Performance</Link>
    </>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[{ label: "Active campaigns", value: active.length, icon: Megaphone }, { label: "Displays requiring action", value: openTasks.length, icon: CalendarClock }, { label: "Awaiting compliance", value: awaitingReview.length, icon: ClipboardCheck }, { label: "Open recommendations", value: data?.recommendations.filter((item) => item.status === "open").length ?? 0, icon: TriangleAlert }].map(({ label, value, icon: Icon }) => <Card key={label}><div className="flex items-start justify-between"><div><p className="text-sm text-text-muted">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div><span className="rounded-md bg-subtle p-2 text-text-secondary"><Icon className="h-5 w-5" /></span></div></Card>)}
    </div>
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2"><div className="flex items-center justify-between"><h2 className="font-semibold">Current programs</h2><Link className="text-sm font-semibold text-primary" to="/campaigns">View all</Link></div>
        <div className="mt-3 divide-y divide-border">{data?.campaigns.filter((campaign) => campaign.status === "active" || campaign.status === "scheduled").map((campaign) => <Link to={`/campaigns/${campaign.id}`} key={campaign.id} className="flex items-center justify-between gap-4 py-3 hover:bg-subtle/60"><div><div className="flex items-center gap-2"><p className="font-medium">{campaign.name}</p><Badge tone={campaign.status === "active" ? "success" : "info"}>{campaign.status}</Badge></div><p className="mt-1 text-sm text-text-muted">{campaign.type} · {formatDate(campaign.startDate)} to {formatDate(campaign.endDate)}</p></div><ArrowRight className="h-4 w-4 text-text-muted" /></Link>)}</div>
      </Card>
      <Card><h2 className="font-semibold">Store execution</h2><div className="mt-4 space-y-4"><div><div className="flex justify-between text-sm"><span>Crown Isle</span><span className="font-semibold">{data?.executions.filter((item) => item.status === "completed").length}/{data?.executions.length}</span></div><div className="mt-2 h-2 overflow-hidden rounded bg-subtle"><div className="h-full bg-success" style={{ width: `${((data?.executions.filter((item) => item.status === "completed").length ?? 0) / Math.max(data?.executions.length ?? 1, 1)) * 100}%` }} /></div></div><Link className="inline-flex items-center gap-1 text-sm font-semibold text-primary" to="/stores/10000000-0000-4000-8000-000000000001/workspace">Open workspace <ArrowRight className="h-4 w-4" /></Link></div></Card>
    </div>
    <div className="grid gap-4 xl:grid-cols-2"><Card><h2 className="font-semibold">Displays due</h2><div className="mt-3 divide-y divide-border">{openTasks.length ? openTasks.slice(0, 4).map((execution) => { const assignment = data?.assignments.find((item) => item.id === execution.assignmentId); const campaign = data?.campaigns.find((item) => item.id === assignment?.campaignId); const area = data?.displayAreas.find((item) => item.id === assignment?.displayAreaId); return <Link key={execution.id} to={`/executions/${execution.id}`} className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">{campaign?.name}</p><p className="text-xs text-text-muted">{area?.name} · Due {formatDate(execution.dueDate)}</p></div><Badge tone={execution.status === "issue" ? "error" : "warning"}>{humanize(execution.status)}</Badge></Link>; }) : <EmptyState title="No open display tasks" message="New assignments will appear here." />}</div></Card>
      <Card><h2 className="font-semibold">Top display areas</h2><div className="mt-3 space-y-3">{data?.performance.sort((a, b) => b.salesLiftPercent - a.salesLiftPercent).slice(0, 3).map((record) => { const area = data.displayAreas.find((item) => item.id === record.displayAreaId); return <Link key={record.id} to={`/display-areas/${record.displayAreaId}`} className="flex items-center justify-between rounded-md border border-border p-3"><div><p className="text-sm font-medium">Crown Isle / {area?.name}</p><p className="text-xs text-text-muted">Mock measured period</p></div><span className="font-semibold text-success">+{record.salesLiftPercent}%</span></Link>; })}<p className="text-xs text-text-muted">All performance values are synthetic development data.</p></div></Card>
    </div>
  </DataState>;
}
