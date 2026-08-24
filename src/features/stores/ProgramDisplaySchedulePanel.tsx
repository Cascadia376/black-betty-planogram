import { ArrowRight, CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Card, formatDate, humanize } from "../../components/ui";
import type { DisplayArea, PlatformSnapshot } from "../../domain/types";
import { displayOrderStatusLabels, orderStatusForAssignment, type DisplayOrderStatus } from "./programSchedule";

function orderTone(status: DisplayOrderStatus): "success" | "warning" | "error" | "info" {
  if (status === "covered") return "success";
  if (status === "at_risk" || status === "order_required") return "error";
  if (status === "bridge_planned") return "info";
  return "warning";
}

function ProductList({ assignmentId, data }: { assignmentId: string; data: PlatformSnapshot }) {
  const products = data.displayAssignmentProducts.filter((product) => product.assignmentId === assignmentId);
  return <ul className="mt-3 divide-y divide-border rounded-md border border-border">{products.map((product) => <li key={product.id} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
    <div className="min-w-0"><p className="truncate font-semibold">{product.sku}</p>{product.note && <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-text-muted">{product.note}</p>}</div>
    <span className="shrink-0 font-semibold">{product.caseQuantity} cases</span>
  </li>)}</ul>;
}

export function ProgramDisplaySchedulePanel({ area, programId, data }: { area: DisplayArea; programId: string; data: PlatformSnapshot }) {
  const program = data.programs.find((item) => item.id === programId);
  const zone = data.zones.find((item) => item.id === area.zoneId);
  const fixture = data.fixtures.find((item) => item.id === area.fixtureId);
  const schedule = data.displayAssignments
    .filter((assignment) => assignment.programId === programId && assignment.displayAreaId === area.id && assignment.status !== "cancelled")
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
  const current = schedule[0];
  const next = schedule[1];
  const currentPeriod = data.programPeriods.find((period) => period.id === current?.periodId);
  const resetDate = currentPeriod?.resetDate ?? next?.startDate;
  const currentOrderStatus = current ? orderStatusForAssignment(current, data) : undefined;

  return <Card className="overflow-hidden p-0 xl:sticky xl:top-24">
    <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div className="min-w-0"><p className="text-[11px] font-semibold uppercase text-text-muted">Display {area.displayNumber} · {area.code}</p><h2 className="mt-1 truncate text-lg font-semibold">{area.name}</h2></div>
      <Badge tone={schedule.length ? "info" : "neutral"}>{schedule.length ? "OND scheduled" : "Available"}</Badge>
    </div>

    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-border px-5 py-4 text-xs">
      <div><dt className="text-text-muted">Type</dt><dd className="mt-1 font-semibold">{humanize(area.type)}</dd></div>
      <div><dt className="text-text-muted">Capacity</dt><dd className="mt-1 font-semibold">{area.capacity}</dd></div>
      <div><dt className="text-text-muted">Zone</dt><dd className="mt-1 font-semibold">{zone?.name ?? "Not mapped"}</dd></div>
      <div><dt className="text-text-muted">Fixture</dt><dd className="mt-1 font-semibold">{fixture?.name ?? "Not mapped"}</dd></div>
    </dl>

    {current ? <div className="border-b border-border px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] font-semibold uppercase text-text-muted">Current assignment</p><Badge tone="info">{humanize(current.status)}</Badge></div>
      <p className="mt-2 text-sm font-semibold">{program?.name}</p>
      <p className="mt-1 text-xs text-text-muted">{formatDate(current.startDate)} - {formatDate(current.endDate)}</p>
      <ProductList assignmentId={current.id} data={data} />
      {currentOrderStatus && <div className="mt-3 flex items-center justify-between gap-3 text-xs"><span className="text-text-muted">Order status</span><Badge tone={orderTone(currentOrderStatus)}>{displayOrderStatusLabels[currentOrderStatus]}</Badge></div>}
    </div> : <div className="border-b border-border px-5 py-6 text-sm font-semibold">No OND assignment</div>}

    {next && <div className="border-b border-border px-5 py-4">
      <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold uppercase text-text-muted">Next assignment</p>{resetDate && <Badge tone="warning">Reset {formatDate(resetDate)}</Badge>}</div>
      <p className="mt-2 text-xs font-semibold">{formatDate(next.startDate)} - {formatDate(next.endDate)}</p>
      <ProductList assignmentId={next.id} data={data} />
      <p className="mt-3 text-xs leading-5 text-text-muted">{next.notes}</p>
    </div>}

    {schedule.length > 0 && <div className="border-b border-border px-5 py-4">
      <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /><p className="text-[11px] font-semibold uppercase text-text-muted">Timeline</p></div>
      <ol className="mt-3 space-y-3 border-l-2 border-border pl-4">{schedule.map((assignment) => {
        const status = orderStatusForAssignment(assignment, data);
        return <li key={assignment.id} className="relative"><i className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-primary bg-surface" /><p className="text-xs font-semibold">{formatDate(assignment.startDate)} - {formatDate(assignment.endDate)}</p><p className="mt-1 text-[11px] text-text-muted">{data.displayAssignmentProducts.filter((product) => product.assignmentId === assignment.id).map((product) => product.sku).join(" · ")}</p><Badge tone={orderTone(status)}>{displayOrderStatusLabels[status]}</Badge></li>;
      })}</ol>
    </div>}

    <div className="bg-subtle/50 p-4">
      <Link className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover" to={`/display-areas/${area.id}`}>Display Area Profile <ArrowRight className="h-4 w-4" /></Link>
    </div>
  </Card>;
}
