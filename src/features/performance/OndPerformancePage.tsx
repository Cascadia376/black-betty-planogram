import { ArrowRight, BarChart3, Check, Lightbulb, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { OndPerformanceRecord, PlatformSnapshot, RecommendationStatus } from "../../domain/types";
import { Badge, Button, Card, DataState, EmptyState, Field, PageHeader, formatDate, humanize, inputClass } from "../../components/ui";
import { usePlatform } from "../../services/PlatformProvider";
import { productDetails } from "../programs/allocationPlanner";
import { buildOndLearningInsights, filterOndPerformance, type OndLearningCategory, type OndPerformanceFilters } from "./ondLearning";

const emptyFilters: OndPerformanceFilters = { programId: "", storeId: "", displayAreaId: "", displayAssignmentId: "", productId: "", periodId: "" };
const questions: { category: OndLearningCategory; question: string }[] = [
  { category: "best_display", question: "Which display areas worked best?" },
  { category: "repeated_stockout", question: "Which products repeatedly stocked out?" },
  { category: "allocation_high", question: "Which allocations were too high?" },
  { category: "allocation_low", question: "Which allocations were too low?" },
  { category: "bridge_value", question: "Which bridge buys created value?" },
  { category: "bridge_excess", question: "Which bridge buys left excess inventory?" },
  { category: "reset_issue", question: "Which reset periods caused issues?" },
];

export function PerformancePage() {
  const { data, loading, error, updateRecommendation, role } = usePlatform();
  const [filters, setFilters] = useState<OndPerformanceFilters>(emptyFilters);
  const [selectedId, setSelectedId] = useState("");
  const records = useMemo(() => data ? filterOndPerformance(data.ondPerformance, filters) : [], [data, filters]);
  const insights = useMemo(() => data ? buildOndLearningInsights(records, data) : [], [data, records]);
  const selected = records.find((item) => item.id === selectedId) ?? records[0];
  const setFilter = (key: keyof OndPerformanceFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const action = (id: string, status: RecommendationStatus) => void updateRecommendation(id, status);

  return <DataState loading={loading} error={error}>{!data ? null : <>
    <PageHeader eyebrow="OND learning · Synthetic demo" title="Performance & Recommendations" description="Program-to-product outcomes and transparent rule-based learning. Results are synthetic observations, not causal claims." actions={<Button variant="secondary" onClick={() => setFilters(emptyFilters)}><RotateCcw className="h-4 w-4" />Reset filters</Button>} />
    <PerformanceFilters data={data} filters={filters} setFilter={setFilter} />
    <Summary records={records} insights={insights.length} />
    <LearningAnswers insights={insights} />
    {selected && <RecordDrilldown record={selected} data={data} />}
    <ResultsTable records={records} data={data} select={setSelectedId} selectedId={selected?.id} />
    <LegacyRecommendations data={data} canAct={role !== "read_only"} action={action} />
    <p className="text-xs text-text-muted">All OND values are synthetic development data and must not be interpreted as Cascadia business results.</p>
  </>}</DataState>;
}

function PerformanceFilters({ data, filters, setFilter }: { data: PlatformSnapshot; filters: OndPerformanceFilters; setFilter(key: keyof OndPerformanceFilters, value: string): void }) {
  const productIds = [...new Set(data.ondPerformance.map((item) => item.productId))];
  return <Card className="p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
    <Filter label="Program" value={filters.programId} onChange={(value) => setFilter("programId", value)} options={data.programs.map((item) => [item.id, item.name])} all="All programs" />
    <Filter label="Store" value={filters.storeId} onChange={(value) => setFilter("storeId", value)} options={data.stores.map((item) => [item.id, item.name])} all="All stores" />
    <Filter label="Display area" value={filters.displayAreaId} onChange={(value) => setFilter("displayAreaId", value)} options={data.displayAreas.map((item) => [item.id, `${item.displayNumber} · ${item.name}`])} all="All displays" />
    <Filter label="Assignment" value={filters.displayAssignmentId} onChange={(value) => setFilter("displayAssignmentId", value)} options={data.displayAssignments.map((item) => { const area = data.displayAreas.find((candidate) => candidate.id === item.displayAreaId); return [item.id, `${area?.displayNumber ?? "-"} · ${formatDate(item.startDate)}`]; })} all="All assignments" />
    <Filter label="Product" value={filters.productId} onChange={(value) => setFilter("productId", value)} options={productIds.map((id) => [id, productLabel(id, data)])} all="All products" />
    <Filter label="Period / reset" value={filters.periodId} onChange={(value) => setFilter("periodId", value)} options={data.programPeriods.map((item) => [item.id, item.resetDate ? `${item.name} · reset ${formatDate(item.resetDate)}` : item.name])} all="All periods" />
  </div></Card>;
}

function Filter({ label, value, onChange, options, all }: { label: string; value: string; onChange(value: string): void; options: string[][]; all: string }) {
  return <Field label={label}><select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{all}</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></Field>;
}

function Summary({ records, insights }: { records: OndPerformanceRecord[]; insights: number }) {
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const metrics = [
    ["Sales", currency(records.reduce((sum, item) => sum + item.salesDollars, 0))],
    ["Units", records.reduce((sum, item) => sum + item.units, 0).toLocaleString()],
    ["Gross margin", currency(records.reduce((sum, item) => sum + item.grossMarginDollars, 0))],
    ["Avg. compliance", records.length ? `${average(records.map((item) => item.compliancePercent)).toFixed(0)}%` : "-"],
    ["Opening-fill readiness", records.length ? `${average(records.map((item) => item.openingFillReadinessPercent)).toFixed(0)}%` : "-"],
    ["Bridge margin", currency(records.reduce((sum, item) => sum + (item.incrementalBridgeMargin ?? 0), 0))],
    ["Learning signals", insights.toString()],
  ];
  return <section aria-label="OND performance summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">{metrics.map(([label, value]) => <Card key={label} className="p-4"><p className="text-xs text-text-muted">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></Card>)}</section>;
}

function LearningAnswers({ insights }: { insights: ReturnType<typeof buildOndLearningInsights> }) {
  return <section aria-labelledby="ond-learning"><div className="mb-3 flex items-center gap-2"><Lightbulb className="h-5 w-5 text-warning" /><div><h2 id="ond-learning" className="font-semibold">OND learning answers</h2><p className="mt-0.5 text-xs text-text-muted">Each signal states the threshold that produced it.</p></div></div><div className="grid gap-3 lg:grid-cols-2">{questions.map(({ category, question }) => { const matches = insights.filter((item) => item.category === category); return <Card key={category} className="p-4"><h3 className="text-sm font-semibold">{question}</h3>{matches.length ? <div className="mt-3 space-y-3">{matches.slice(0, 2).map((insight, index) => <div key={`${insight.subject}-${index}`} className={index ? "border-t border-border pt-3" : ""}><div className="flex flex-wrap items-center gap-2"><Badge tone={insight.tone}>{insight.title}</Badge><span className="text-sm font-semibold">{insight.subject}</span></div><p className="mt-2 text-sm leading-5 text-text-secondary">{insight.explanation}</p><p className="mt-2 text-xs text-text-muted">Rule: {insight.rule}</p></div>)}</div> : <p className="mt-3 text-sm text-text-muted">No signal in the filtered synthetic results.</p>}</Card>; })}</div></section>;
}

function RecordDrilldown({ record, data }: { record: OndPerformanceRecord; data: PlatformSnapshot }) {
  const area = data.displayAreas.find((item) => item.id === record.displayAreaId);
  const store = data.stores.find((item) => item.id === record.storeId);
  const program = data.programs.find((item) => item.id === record.programId);
  const period = data.programPeriods.find((item) => item.id === record.periodId);
  const metrics = [["Sales", currency(record.salesDollars)], ["Units", record.units], ["Gross margin", currency(record.grossMarginDollars)], ["Sales lift", record.salesLiftPercent === undefined ? "No baseline" : `${record.salesLiftPercent}%`], ["Stockout rate", percent(record.stockoutRate)], ["Compliance", `${record.compliancePercent}%`], ["Opening-fill readiness", `${record.openingFillReadinessPercent}%`], ["Recommended / actual order", `${record.recommendedOrderCases} / ${record.actualOrderCases} cases`], ["Projected / actual residual", `${record.projectedResidualCases} / ${record.actualResidualCases} cases`], ["Bridge inventory", `${record.bridgeInventoryCases} cases`], ["Bridge sell-through", record.bridgeInventoryCases ? `${record.bridgeSoldThroughCases} of ${record.bridgeInventoryCases} cases` : "Not a bridge buy"], ["Incremental bridge margin", record.incrementalBridgeMargin === undefined ? "Not calculable" : currency(record.incrementalBridgeMargin)]];
  return <Card className="p-0"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4"><div><p className="text-xs font-semibold uppercase text-primary">Selected result</p><h2 className="mt-1 font-semibold">{productLabel(record.productId, data)}</h2><p className="mt-1 text-xs text-text-muted">{program?.name} · {store?.name} · Display {area?.displayNumber} · {period?.name ?? `${formatDate(record.periodStart)} - ${formatDate(record.periodEnd)}`}</p></div><div className="flex flex-wrap gap-2"><Link className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border bg-surface px-3 text-sm font-semibold" to={`/display-areas/${record.displayAreaId}`}>{store?.name} / {area?.name} <ArrowRight className="h-4 w-4" /></Link><Link className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border bg-surface px-3 text-sm font-semibold" to={`/programs/${record.programId}/allocations`}>Assignment <ArrowRight className="h-4 w-4" /></Link></div></div><dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{metrics.map(([label, value]) => <div key={label} className="bg-surface p-4"><dt className="text-[10px] font-semibold uppercase text-text-muted">{label}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>)}</dl></Card>;
}

function ResultsTable({ records, data, select, selectedId }: { records: OndPerformanceRecord[]; data: PlatformSnapshot; select(id: string): void; selectedId?: string }) {
  return <Card className="overflow-hidden p-0"><div className="flex items-center gap-2 border-b border-border px-4 py-3"><BarChart3 className="h-4 w-4 text-primary" /><h2 className="font-semibold">OND measured results</h2><Badge>{records.length}</Badge></div>{records.length ? <div className="overflow-x-auto"><table className="min-w-[1180px] w-full text-left text-sm"><thead className="bg-subtle/60 text-xs uppercase text-text-muted"><tr><th className="px-3 py-3">Program / store</th><th className="px-3 py-3">Display / assignment</th><th className="px-3 py-3">Product</th><th className="px-3 py-3">Sales</th><th className="px-3 py-3">Units</th><th className="px-3 py-3">GM</th><th className="px-3 py-3">Lift</th><th className="px-3 py-3">OOS</th><th className="px-3 py-3">Compliance</th><th className="px-3 py-3">Opening fill</th><th className="px-3 py-3">Order rec. / actual</th><th className="px-3 py-3">Residual proj. / actual</th><th className="px-3 py-3"></th></tr></thead><tbody className="divide-y divide-border">{records.map((record) => { const area = data.displayAreas.find((item) => item.id === record.displayAreaId); const store = data.stores.find((item) => item.id === record.storeId); const program = data.programs.find((item) => item.id === record.programId); return <tr key={record.id} className={selectedId === record.id ? "bg-primary-subtle" : ""}><td className="px-3 py-3"><p className="font-medium">{program?.name}</p><p className="text-xs text-text-muted">{store?.name}</p></td><td className="px-3 py-3"><p className="font-medium">{area?.displayNumber} · {area?.name}</p><p className="text-xs text-text-muted">{formatDate(record.periodStart)} - {formatDate(record.periodEnd)}</p></td><td className="px-3 py-3 font-medium">{productLabel(record.productId, data)}</td><td className="px-3 py-3">{currency(record.salesDollars)}</td><td className="px-3 py-3">{record.units}</td><td className="px-3 py-3">{currency(record.grossMarginDollars)}</td><td className="px-3 py-3">{record.salesLiftPercent === undefined ? "-" : `${record.salesLiftPercent}%`}</td><td className="px-3 py-3">{percent(record.stockoutRate)}</td><td className="px-3 py-3">{record.compliancePercent}%</td><td className="px-3 py-3">{record.openingFillReadinessPercent}%</td><td className="px-3 py-3">{record.recommendedOrderCases} / {record.actualOrderCases}</td><td className="px-3 py-3">{record.projectedResidualCases} / {record.actualResidualCases}</td><td className="px-3 py-3"><Button variant="secondary" onClick={() => select(record.id)}>Drill down</Button></td></tr>; })}</tbody></table></div> : <EmptyState title="No measured results" message="No synthetic OND performance records match the selected filters." />}</Card>;
}

function LegacyRecommendations({ data, canAct, action }: { data: PlatformSnapshot; canAct: boolean; action(id: string, status: RecommendationStatus): void }) {
  return <section aria-labelledby="campaign-recommendations"><div className="mb-3"><h2 id="campaign-recommendations" className="font-semibold">Campaign recommendations</h2><p className="mt-1 text-xs text-text-muted">Existing explainable campaign rules remain available alongside OND learning.</p></div><div className="grid gap-3 lg:grid-cols-2">{data.recommendations.map((recommendation) => { const area = data.displayAreas.find((item) => item.id === recommendation.displayAreaId); return <Card key={recommendation.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><Badge tone={recommendation.status === "open" ? "warning" : "neutral"}>{humanize(recommendation.status)}</Badge><h3 className="mt-2 font-semibold">{recommendation.title}</h3><p className="mt-1 text-sm text-text-muted">{area?.name}</p></div><Lightbulb className="h-5 w-5 text-primary" /></div><p className="mt-3 text-sm leading-5 text-text-secondary">{recommendation.rationale}</p><p className="mt-2 text-xs text-text-muted">Rule: {humanize(recommendation.rule)}.</p>{canAct && recommendation.status === "open" && <div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => action(recommendation.id, "accepted")}><Check className="h-4 w-4" />Accept</Button><Button variant="secondary" onClick={() => action(recommendation.id, "addressed")}>Already addressed</Button><Button variant="secondary" onClick={() => action(recommendation.id, "dismissed")}><X className="h-4 w-4" />Dismiss</Button></div>}</Card>; })}</div></section>;
}

function productLabel(productId: string, data: PlatformSnapshot) {
  const product = data.displayAssignmentProducts.find((item) => item.productId === productId);
  return product ? productDetails(product, data).name : productId;
}

function currency(value: number) { return `$${value.toLocaleString("en-CA")}`; }
function percent(value: number) { return `${Math.round(value * 100)}%`; }
