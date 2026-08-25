import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock3, MapPin, PackageCheck, RotateCcw, ShoppingCart, TrendingDown } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge, Card, DataState, EmptyState, PageHeader, formatDate, humanize } from "../../components/ui";
import type { PlatformSnapshot } from "../../domain/types";
import { usePlatform } from "../../services/PlatformProvider";
import { productDetails } from "../programs/allocationPlanner";
import { displayOrderStatusLabels, orderStatusForAssignment } from "./programSchedule";
import { mockBusinessClock } from "../../services/clock";
import { buildStoreWorkspaceModel } from "./storeWorkspaceModel";

const workspaceDate = mockBusinessClock.today();

const linkClass = "inline-flex min-h-9 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-sm font-semibold hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

export function StoreWorkspacePage() {
  const { storeId } = useParams();
  const { data, loading, error } = usePlatform();
  const store = data?.stores.find((item) => item.id === storeId);
  const model = data && storeId ? buildStoreWorkspaceModel(data, storeId) : undefined;
  const programQuery = model?.program ? `?program=${model.program.id}` : "";

  return <DataState loading={loading} error={error}>{!store || !data || !model ? <EmptyState title="Store not found" message="The requested store is not available." /> : <>
    <PageHeader eyebrow={`${model.program?.name ?? "Store program"} · Synthetic demo`} title={`${store.name} merchandising workspace`} description="What needs my attention? Review execution, ordering, resets, and inventory strategy from one operational view." actions={<><Link className={linkClass} to={`/stores/${store.id}/orders${programQuery}`}><ShoppingCart className="h-4 w-4" />Open orders</Link><Link className={linkClass} to={`/stores/${store.id}/floorplan${programQuery}`}><MapPin className="h-4 w-4" />View floorplan</Link></>} />
    <div className="space-y-5">
      <AttentionSection title="Execution" items={[
        ["Displays to set", model.attention.displaysToSet, PackageCheck], ["Resets due", model.attention.resetsDue, RotateCcw],
        ["Overdue tasks", model.attention.overdueTasks, Clock3], ["Issues", model.attention.issues, AlertTriangle],
      ]} />
      <AttentionSection title="Ordering" items={[
        ["Orders required today", model.attention.ordersRequiredToday, ShoppingCart], ["Products at risk", model.attention.productsAtRisk, AlertTriangle],
        ["Upcoming opening fills", model.attention.upcomingOpeningFills, PackageCheck], ["Bridge actions", model.attention.bridgeActions, CheckCircle2],
        ["Exit-risk products", model.attention.exitRiskProducts, TrendingDown],
      ]} />
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <TaskList data={data} storeId={store.id} model={model} />
        <OperationalTimeline data={data} storeId={store.id} programId={model.program?.id} programEnd={model.program?.endDate} majorDemandPhaseStart={model.majorDemandPhaseStart} />
      </div>
    </div>
  </>}</DataState>;
}

function AttentionSection({ title, items }: { title: string; items: [string, number, typeof Clock3][] }) {
  return <section aria-labelledby={`${title.toLowerCase()}-attention`}><div className="mb-2 flex items-center justify-between"><h2 id={`${title.toLowerCase()}-attention`} className="text-sm font-semibold">{title}</h2><span className="text-xs text-text-muted">As of {formatDate(workspaceDate)}</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">{items.map(([label, value, Icon]) => <Card key={label} className="flex items-center gap-3 p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-subtle text-primary"><Icon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-xl font-semibold leading-6">{value}</p><p className="text-xs leading-4 text-text-muted">{label}</p></div></Card>)}</div></section>;
}

function TaskList({ data, storeId, model }: { data: PlatformSnapshot; storeId: string; model: ReturnType<typeof buildStoreWorkspaceModel> }) {
  const executionTasks = model.executions.filter((item) => item.status !== "completed");
  const resetTasks = model.assignments.filter((item) => item.resetRequired && !model.executions.some((execution) => {
    const executionAssignment = data.displayAssignments.find((assignment) => assignment.id === execution.displayAssignmentId);
    const resetDate = data.programPeriods.find((period) => period.id === item.periodId)?.resetDate;
    return execution.taskType === "reset" && executionAssignment?.displayAreaId === item.displayAreaId && execution.dueDate === resetDate;
  }));
  const orderTasks = model.orders.filter((item) => ["order_today", "at_risk", "potential_residual", "intentional_bridge"].includes(item.group));
  return <section aria-labelledby="attention-tasks" className="min-w-0"><div className="mb-3 flex items-end justify-between gap-3"><div><h2 id="attention-tasks" className="text-base font-semibold">Attention queue</h2><p className="mt-1 text-xs text-text-muted">Highest-priority execution and ordering work for this store.</p></div><Badge tone="warning">{executionTasks.length + resetTasks.length + orderTasks.length} open</Badge></div><div className="space-y-3">
    {executionTasks.map((execution) => {
      const assignment = data.assignments.find((item) => item.id === execution.assignmentId);
      const displayAssignment = data.displayAssignments.find((item) => item.id === execution.displayAssignmentId);
      const campaign = data.campaigns.find((item) => item.id === assignment?.campaignId);
      const program = data.programs.find((item) => item.id === displayAssignment?.programId);
      const area = data.displayAreas.find((item) => item.id === (displayAssignment?.displayAreaId ?? assignment?.displayAreaId));
      const title = campaign?.name ?? `${program?.name ?? "Display"} ${execution.taskType === "reset" ? "reset" : "execution"}`;
      const floorplanParams = new URLSearchParams();
      if (program) floorplanParams.set("program", program.id);
      if (area) floorplanParams.set("area", area.id);
      return <TaskCard key={execution.id} type={execution.taskType === "reset" ? "RESET" : "EXECUTION"} tone={execution.status === "issue" ? "error" : "warning"} icon={execution.taskType === "reset" ? <RotateCcw className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />} title={title} meta={`Display ${area?.displayNumber ?? "-"} · Due ${formatDate(execution.dueDate)}`} detail={execution.issue ?? `${humanize(execution.status)} · Complete the display and submit evidence.`} actions={<><Link className={linkClass} to={`/executions/${execution.id}`}>Open task <ArrowRight className="h-4 w-4" /></Link><Link className={linkClass} to={`/stores/${storeId}/floorplan?${floorplanParams}`}><MapPin className="h-4 w-4" />Locate display</Link><Link className={linkClass} to={`/executions/${execution.id}`}>Report issue</Link></>} />;
    })}
    {resetTasks.map((assignment) => {
      const area = data.displayAreas.find((item) => item.id === assignment.displayAreaId);
      const period = data.programPeriods.find((item) => item.id === assignment.periodId);
      const next = model.assignments.find((item) => item.displayAreaId === assignment.displayAreaId && item.startDate > assignment.endDate);
      const nextProducts = data.displayAssignmentProducts.filter((item) => item.assignmentId === next?.id).map((item) => productDetails(item, data).name);
      const status = orderStatusForAssignment(assignment, data);
      return <TaskCard key={assignment.id} type="RESET" tone={status === "at_risk" ? "error" : "warning"} icon={<RotateCcw className="h-4 w-4" />} title={`Display ${area?.displayNumber ?? "-"}`} meta={`Reset ${formatDate(period?.resetDate ?? assignment.endDate)}`} detail={`${nextProducts.length ? `New assortment ready: ${nextProducts.join(", ")}.` : "Changeover details require review."} Order coverage: ${displayOrderStatusLabels[status]}.`} actions={<><Link className={linkClass} to={`/stores/${storeId}/orders?program=${assignment.programId}`}><ShoppingCart className="h-4 w-4" />Open orders</Link><Link className={linkClass} to={`/stores/${storeId}/floorplan?program=${assignment.programId}&area=${assignment.displayAreaId}`}><MapPin className="h-4 w-4" />Locate display</Link></>} />;
    })}
    {orderTasks.map((item) => <OrderTaskCard key={item.recommendation.id} data={data} storeId={storeId} item={item} />)}
  </div></section>;
}

function OrderTaskCard({ data, storeId, item }: { data: PlatformSnapshot; storeId: string; item: ReturnType<typeof buildStoreWorkspaceModel>["orders"][number] }) {
  const details = item.assignmentProduct ? productDetails(item.assignmentProduct, data) : { name: item.recommendation.productId };
  const isBridge = item.group === "intentional_bridge";
  const isExit = item.group === "potential_residual";
  const type = isBridge ? "BRIDGE" : isExit ? "EXIT" : "ORDER";
  const detail = isBridge ? "Intentional bridge position approved by Buying." : isExit ? "Do not reorder. Projected residual exceeds the exit target." : `${item.recommendation.recommendedCases} cases recommended · Required by ${formatDate(item.recommendation.requiredByDate)}.`;
  return <TaskCard type={type} tone={item.group === "at_risk" || isExit ? "error" : isBridge ? "info" : "warning"} icon={isExit ? <TrendingDown className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />} title={details.name} meta={`Display ${item.area?.displayNumber ?? "-"} · ${humanize(item.recommendation.recommendationType)}`} detail={detail} actions={<><Link className={linkClass} to={`/stores/${storeId}/orders?program=${item.assignment?.programId ?? ""}`}><ShoppingCart className="h-4 w-4" />Open orders</Link>{item.area && <Link className={linkClass} to={`/stores/${storeId}/floorplan?program=${item.assignment?.programId}&area=${item.area.id}`}><MapPin className="h-4 w-4" />Locate display</Link>}</>} />;
}

function TaskCard({ type, tone, icon, title, meta, detail, actions }: { type: string; tone: "warning" | "error" | "info"; icon: ReactNode; title: string; meta: string; detail: string; actions: ReactNode }) {
  return <Card className="p-0"><div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"><div className="flex min-w-0 gap-3"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-subtle text-primary">{icon}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={tone}>{type}</Badge><h3 className="break-words text-sm font-semibold">{title}</h3></div><p className="mt-1 text-xs text-text-muted">{meta}</p><p className="mt-2 text-sm leading-5 text-text-secondary">{detail}</p></div></div><div className="flex flex-wrap gap-2 lg:max-w-72 lg:justify-end">{actions}</div></div></Card>;
}

function OperationalTimeline({ data, storeId, programId, programEnd, majorDemandPhaseStart }: { data: PlatformSnapshot; storeId: string; programId?: string; programEnd?: string; majorDemandPhaseStart?: string }) {
  const assignments = data.displayAssignments.filter((item) => item.storeId === storeId && item.programId === programId);
  const resets = data.programPeriods.filter((item) => item.programId === programId && item.resetDate).map((item) => item.resetDate!).sort();
  const deliveries = data.inboundOrders.filter((item) => item.storeId === storeId && item.expectedArrivalDate >= workspaceDate).map((item) => item.expectedArrivalDate).sort();
  const milestones = [["Next display reset", resets[0], `${assignments.filter((item) => item.resetRequired).length} displays change`], ["Next required delivery", deliveries[0], "Confirmed inbound order"], ["Major holiday demand phase", majorDemandPhaseStart, "Christmas acceleration begins"], ["Program end", programEnd, "Exit and bridge positions take effect"]];
  return <aside aria-labelledby="operational-timeline" className="min-w-0"><Card className="p-0 xl:sticky xl:top-6"><div className="border-b border-border p-4"><div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /><h2 id="operational-timeline" className="text-sm font-semibold">Operational timeline</h2></div></div><ol className="divide-y divide-border">{milestones.map(([label, date, note]) => <li key={label} className="relative px-4 py-4 pl-8 before:absolute before:left-4 before:top-5 before:h-2 before:w-2 before:rounded-full before:bg-primary"><p className="text-xs font-semibold">{label}</p><p className="mt-1 text-sm font-semibold text-primary">{date ? formatDate(date) : "Not scheduled"}</p><p className="mt-1 text-xs leading-4 text-text-muted">{note}</p></li>)}</ol></Card></aside>;
}
