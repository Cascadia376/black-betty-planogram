import type { LucideIcon } from "lucide-react";
import {
  ArrowRight, Building2, CalendarClock, CheckCircle2, ClipboardList,
  Layers3, PackageCheck, ShoppingCart, TriangleAlert,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge, Card, DataState, EmptyState, PageHeader, formatDate, humanize } from "../../components/ui";
import type { DisplayAssignmentProduct } from "../../domain/types";
import { usePlatform } from "../../services/PlatformProvider";

type OrderingStatus = "at risk" | "covered" | "bridge opportunity" | "exit risk";

const timeline = [
  ["October", "Opening allocations", "neutral"],
  ["Nov 12 reset", "Holiday changeover", "reset"],
  ["December", "Holiday execution", "neutral"],
  ["Dec 15-24 peak", "Peak readiness", "peak"],
  ["Dec 30-31 peak", "Year-end readiness", "peak"],
  ["Jan 1 exit / bridge", "Buying decision point", "reset"],
] as const;

function SummaryCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: number; detail: string }) {
  return <Card className="flex min-h-28 flex-col justify-between p-4">
    <div className="flex items-start justify-between gap-2"><p className="min-w-0 break-words text-[11px] font-medium leading-4 text-text-muted">{label}</p><span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-subtle text-text-secondary"><Icon className="h-3.5 w-3.5" /></span></div>
    <div className="mt-3"><p className="text-2xl font-semibold leading-7">{value}</p><p className="mt-1 text-[11px] leading-4 text-text-muted">{detail}</p></div>
  </Card>;
}

function statusTone(status: OrderingStatus): "error" | "success" | "warning" | "info" {
  if (status === "at risk") return "error";
  if (status === "covered") return "success";
  if (status === "bridge opportunity") return "info";
  return "warning";
}

export function ProgramWorkspacePage() {
  const { programId } = useParams();
  const { data, loading, error } = usePlatform();
  const program = data?.programs.find((item) => item.id === programId);
  const assignments = data?.displayAssignments.filter((item) => item.programId === programId && item.status !== "cancelled") ?? [];
  const periods = data?.programPeriods.filter((item) => item.programId === programId) ?? [];
  const storeIds = new Set(assignments.map((item) => item.storeId));
  const stores = data?.stores.filter((store) => storeIds.has(store.id)) ?? [];
  const assignedAreaIds = new Set(assignments.map((item) => item.displayAreaId));
  const programAreas = data?.displayAreas.filter((area) => storeIds.has(area.storeId)) ?? [];
  const unassignedAreas = programAreas.filter((area) => !assignedAreaIds.has(area.id));
  const productsFor = (assignmentId: string) => data?.displayAssignmentProducts.filter((product) => product.assignmentId === assignmentId) ?? [];
  const openingFillRisks = assignments.filter((assignment) => {
    const products = productsFor(assignment.id);
    return products.length === 0 || products.some((product) => product.required && product.caseQuantity <= 0);
  });

  const resets = assignments.filter((assignment) => assignment.resetRequired).map((assignment) => {
    const area = data?.displayAreas.find((item) => item.id === assignment.displayAreaId);
    const period = periods.find((item) => item.id === assignment.periodId);
    const nextAssignment = assignments
      .filter((item) => item.displayAreaId === assignment.displayAreaId && item.startDate > assignment.endDate)
      .sort((left, right) => left.startDate.localeCompare(right.startDate))[0];
    const nextPeriod = periods.find((item) => item.id === nextAssignment?.periodId);
    return { assignment, area, period, nextPeriod, resetDate: period?.resetDate ?? nextAssignment?.startDate };
  }).filter((item) => item.resetDate).sort((left, right) => left.resetDate!.localeCompare(right.resetDate!));

  const uniqueProducts = new Map<string, DisplayAssignmentProduct[]>();
  for (const assignment of assignments) {
    for (const product of productsFor(assignment.id)) {
      uniqueProducts.set(product.productId, [...(uniqueProducts.get(product.productId) ?? []), product]);
    }
  }
  const orderingExceptions = [...uniqueProducts.entries()].map(([productId, products]) => {
    const strategy = data?.bridgeStrategies.find((item) => item.productId === productId);
    const supplierCovered = products.some((product) => product.preferredSupplierId)
      || data?.supplierProductOptions.some((option) => option.productId === productId && option.preferred);
    let status: OrderingStatus = supplierCovered ? "covered" : "at risk";
    let rationale = supplierCovered ? "Preferred supplier coverage is recorded." : "No preferred supplier option is recorded.";
    if (strategy?.strategy === "BRIDGE_BUY" && strategy.eligibility === "yes") {
      status = "bridge opportunity";
      rationale = strategy.note ?? "Eligible for a limited bridge buy.";
    } else if (strategy?.strategy === "EXIT") {
      status = "exit risk";
      rationale = strategy.note ?? "Exit-oriented item is not eligible for bridging.";
    }
    return {
      productId,
      sku: products[0]?.sku ?? "Unknown SKU",
      caseQuantity: products.reduce((total, product) => total + product.caseQuantity, 0),
      status,
      rationale,
    };
  }).sort((left, right) => left.status.localeCompare(right.status));
  const bridgeOpportunities = orderingExceptions.filter((item) => item.status === "bridge opportunity");
  const primaryStore = stores[0];

  return <DataState loading={loading} error={error}>
    {!program ? <EmptyState title="Program not found" message="The requested merchandising program is unavailable." /> : <>
      <PageHeader eyebrow="Quarterly merchandising program" title={program.name} description={`${formatDate(program.startDate)} - ${formatDate(program.endDate)} · ${program.description}`} actions={primaryStore && <>
        <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle" to={`/stores/${primaryStore.id}/workspace`}>Open store <ArrowRight className="h-4 w-4" /></Link>
        <Link className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle" to={`/programs/${program.id}/allocations`}>Allocation planner</Link>
        <Link className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle" to={`/programs/${program.id}/import`}>Import legacy OND</Link>
        <Link className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle" to={`/stores/${primaryStore.id}/floorplan?program=${program.id}`}>Review display assignments</Link>
        <a className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover" href="#ordering-exceptions">Review orders</a>
      </>} />

      <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard icon={Building2} label="Stores" value={stores.length} detail={stores.map((store) => store.name).join(", ")} />
        <SummaryCard icon={ClipboardList} label="Active display assignments" value={assignments.length} detail="Planned OND allocations" />
        <SummaryCard icon={CalendarClock} label="Upcoming resets" value={resets.length} detail={resets[0]?.resetDate ? formatDate(resets[0].resetDate) : "No reset scheduled"} />
        <SummaryCard icon={Layers3} label="Unassigned display spaces" value={unassignedAreas.length} detail={unassignedAreas.map((area) => area.name).join(", ") || "All spaces assigned"} />
        <SummaryCard icon={TriangleAlert} label="Opening-fill risks" value={openingFillRisks.length} detail="Required quantities incomplete" />
        <SummaryCard icon={ShoppingCart} label="Bridge opportunities" value={bridgeOpportunities.length} detail="Buying review required" />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4"><h2 className="text-sm font-semibold">Program timeline</h2><p className="mt-1 text-xs text-text-muted">Operational milestones only; no forecasting calculations.</p></div>
        <ol className="grid grid-cols-2 gap-px bg-border md:grid-cols-3 xl:grid-cols-6">
          {timeline.map(([label, detail, tone], index) => <li key={label} className="min-h-24 bg-surface p-4">
            <div className="flex items-center gap-2">
              <span className={`grid h-6 w-6 place-items-center rounded text-[11px] font-semibold ${tone === "reset" ? "bg-primary-subtle text-primary" : tone === "peak" ? "bg-warning-subtle text-warning" : "bg-subtle text-text-secondary"}`}>{index + 1}</span>
              {tone !== "neutral" && <Badge tone={tone === "reset" ? "info" : "warning"}>{tone}</Badge>}
            </div>
            <p className="mt-3 text-sm font-semibold">{label}</p><p className="mt-1 text-[11px] leading-4 text-text-muted">{detail}</p>
          </li>)}
        </ol>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4"><h2 className="text-sm font-semibold">Store readiness</h2><p className="mt-1 text-xs text-text-muted">Synthetic readiness based on recorded assignments, quantities, and statuses.</p></div>
        <div className="overflow-hidden"><table className="w-full table-fixed text-left text-xs">
          <thead className="bg-subtle/70 text-[10px] uppercase text-text-muted"><tr>
            <th className="w-[24%] px-3 py-3 sm:px-4">Store</th><th className="px-2 py-3">Displays assigned</th><th className="px-2 py-3">Displays incomplete</th><th className="px-2 py-3">Next reset</th><th className="px-2 py-3">Ordering status</th><th className="px-2 py-3">Execution status</th>
          </tr></thead>
          <tbody className="divide-y divide-border">{stores.map((store) => {
            const storeAssignments = assignments.filter((assignment) => assignment.storeId === store.id);
            const storeAreaCount = new Set(storeAssignments.map((assignment) => assignment.displayAreaId)).size;
            const storeIncomplete = openingFillRisks.filter((assignment) => assignment.storeId === store.id).length;
            const storeReset = resets.find((reset) => reset.assignment.storeId === store.id);
            const orderingAtRisk = orderingExceptions.some((item) => item.status === "at risk" || item.status === "exit risk");
            return <tr key={store.id} className="align-top">
              <td className="px-3 py-4 sm:px-4"><p className="font-semibold">{store.name}</p><Link className="mt-1 inline-flex items-center gap-1 font-semibold text-primary" to={`/stores/${store.id}/workspace`}>Open store <ArrowRight className="h-3 w-3" /></Link></td>
              <td className="break-words px-2 py-4 font-semibold">{storeAreaCount} of {data?.displayAreas.filter((area) => area.storeId === store.id).length ?? 0}</td>
              <td className="break-words px-2 py-4">{storeIncomplete}</td><td className="break-words px-2 py-4">{storeReset?.resetDate ? formatDate(storeReset.resetDate) : "None"}</td>
              <td className="px-2 py-4"><Badge tone={orderingAtRisk ? "error" : "success"}>{orderingAtRisk ? "At risk" : "Covered"}</Badge></td>
              <td className="px-2 py-4"><Badge tone="info">{humanize(storeAssignments[0]?.status ?? "draft")}</Badge></td>
            </tr>;
          })}</tbody>
        </table></div>
      </Card>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4"><h2 className="text-sm font-semibold">Upcoming resets</h2><p className="mt-1 text-xs text-text-muted">Next recorded display changeovers.</p></div>
          <div className="divide-y divide-border">{resets.map((reset) => <div key={reset.assignment.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm font-semibold">Display {reset.area?.displayNumber} · {reset.area?.name}</p><p className="mt-1 text-xs text-text-muted">{reset.period?.name} → {reset.nextPeriod?.name ?? "Unassigned after reset"}</p></div>
              <Badge tone="info">{formatDate(reset.resetDate!)}</Badge>
            </div>
            {reset.area && <Link className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary" to={`/stores/${reset.assignment.storeId}/floorplan?program=${program.id}&area=${reset.area.id}`}>Review assignment <ArrowRight className="h-3.5 w-3.5" /></Link>}
          </div>)}</div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div id="ordering-exceptions" className="scroll-mt-24 border-b border-border px-5 py-4"><h2 className="text-sm font-semibold">Buying / ordering exceptions</h2><p className="mt-1 text-xs text-text-muted">Mock statuses from supplier coverage and buying-owned bridge decisions.</p></div>
          <div className="divide-y divide-border">{orderingExceptions.map((item) => <div key={item.productId} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{item.sku}</p><Badge tone={statusTone(item.status)}>{humanize(item.status)}</Badge></div><p className="mt-1 text-xs leading-5 text-text-muted">{item.rationale}</p></div>
            <div className="text-left sm:text-right"><p className="text-[10px] uppercase text-text-muted">Planned cases</p><p className="mt-1 text-sm font-semibold">{item.caseQuantity}</p></div>
          </div>)}</div>
          <div className="flex items-center gap-2 border-t border-border bg-subtle/50 px-5 py-3 text-[11px] text-text-muted"><PackageCheck className="h-3.5 w-3.5" /><span>Status review only. No demand forecast or order recommendation is calculated.</span></div>
        </Card>
      </div>

      {openingFillRisks.length === 0 && <div className="flex items-center gap-2 rounded-md border border-success/20 bg-success-subtle px-4 py-3 text-xs text-success"><CheckCircle2 className="h-4 w-4" />All required assignment products have a positive synthetic opening case quantity.</div>}
    </>}
  </DataState>;
}
