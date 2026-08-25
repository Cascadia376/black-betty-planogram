import { useMemo, useState } from "react";
import { ArrowLeft, Plus, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, DataState, EmptyState, Field, PageHeader, formatDate, humanize, inputClass } from "../../components/ui";
import type { CreateDisplayAssignmentInput } from "../../domain/repositories";
import type { DisplayAssignment, DisplayAssignmentProduct, DisplayAssignmentStatus, PlatformSnapshot } from "../../domain/types";
import { usePlatform } from "../../services/PlatformProvider";
import { AssignmentEditor } from "./AssignmentEditor";
import { assignmentMatchesFilters, productDetails, resetDateForAssignment, type AllocationFilters } from "./allocationPlanner";

const emptyFilters: AllocationFilters = { storeId: "", periodId: "", displayType: "", supplierId: "", category: "", status: "" };

function statusTone(status: DisplayAssignmentStatus) {
  if (["ready", "active", "completed"].includes(status)) return "success" as const;
  if (status === "cancelled") return "error" as const;
  if (status === "planned") return "info" as const;
  return "warning" as const;
}

export function AllocationPlannerPage() {
  const { programId } = useParams();
  const { data, loading, error, createDisplayAssignment, updateDisplayAssignment } = usePlatform();
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState<CreateDisplayAssignmentInput>();
  const [defaultQuantity, setDefaultQuantity] = useState(6);
  const program = data?.programs.find((item) => item.id === programId);
  const periods = data?.programPeriods.filter((item) => item.programId === programId) ?? [];
  const assignments = data?.displayAssignments.filter((item) => item.programId === programId) ?? [];
  const productsFor = (id: string) => data?.displayAssignmentProducts.filter((item) => item.assignmentId === id) ?? [];
  const rows = data ? assignments.filter((assignment) => assignmentMatchesFilters(assignment, productsFor(assignment.id), filters, data)) : [];
  const displayTypes = [...new Set(data?.displayAreas.map((area) => area.type) ?? [])].sort();
  const suppliers = [...new Map((data?.supplierProductOptions ?? []).map((option) => [option.supplierId, option])).values()];
  const categories = [...new Set((data?.products ?? []).filter((product) => product.active).map((product) => product.category))].filter(Boolean).sort();
  const catalog = useMemo(() => (data?.products ?? []).filter((product) => product.active).map((product) => ({ id: `catalog-${product.id}`, assignmentId: "catalog", productId: product.id, sku: product.sku, caseQuantity: 1, required: true, preferredSupplierId: data?.supplierProductOptions.find((option) => option.productId === product.id && option.preferred)?.supplierId })), [data]);

  const openEditor = (assignment: DisplayAssignment) => {
    setSelectedId(assignment.id);
    setDraft({ assignment: toAssignmentDraft(assignment), products: productsFor(assignment.id).map(toProductDraft) });
  };
  const newAssignment = () => {
    if (!program || !data) return;
    const store = data.stores[0]; const period = periods[0]; const area = data.displayAreas.find((item) => item.storeId === store?.id); const product = catalog[0];
    if (!store || !area || !product) return;
    setSelectedId(undefined);
    setDraft({ assignment: { programId: program.id, periodId: period?.id, storeId: store.id, displayAreaId: area.id, startDate: period?.startDate ?? program.startDate, endDate: period?.endDate ?? program.endDate, resetRequired: false, notes: "", status: "draft" }, products: [{ ...toProductDraft(product), caseQuantity: defaultQuantity }] });
  };

  return <DataState loading={loading} error={error}>{!program || !data ? <EmptyState title="Program not found" message="The allocation planner needs a valid merchandising program." /> : <>
    <PageHeader eyebrow="Display allocation planner" title={`${program.name} allocations`} description={`${formatDate(program.startDate)} - ${formatDate(program.endDate)} · Synthetic mock-backed planning data`} actions={<><Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-sm font-semibold hover:bg-subtle" to={`/programs/${program.id}`}><ArrowLeft className="h-4 w-4" />Program workspace</Link><Button onClick={newAssignment}><Plus className="h-4 w-4" />New assignment</Button></>} />
    <Card className="mt-6 p-0"><div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="text-sm font-semibold">Filters</h2><p className="mt-0.5 text-xs text-text-muted">Narrow the store-specific allocation schedule.</p></div><Button variant="secondary" onClick={() => setFilters(emptyFilters)}><RotateCcw className="h-4 w-4" />Reset</Button></div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Filter label="Store" value={filters.storeId} onChange={(value) => setFilters({ ...filters, storeId: value })} options={data.stores.map((store) => [store.id, store.name])} />
        <Filter label="Period" value={filters.periodId} onChange={(value) => setFilters({ ...filters, periodId: value })} options={periods.map((period) => [period.id, period.name])} />
        <Filter label="Display type" value={filters.displayType} onChange={(value) => setFilters({ ...filters, displayType: value })} options={displayTypes.map((type) => [type, humanize(type)])} />
        <Filter label="Supplier" value={filters.supplierId} onChange={(value) => setFilters({ ...filters, supplierId: value })} options={suppliers.map((supplier) => [supplier.supplierId, supplier.supplierName])} />
        <Filter label="Category" value={filters.category} onChange={(value) => setFilters({ ...filters, category: value })} options={categories.map((category) => [category, category])} />
        <Filter label="Assignment status" value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })} options={["draft", "planned", "ready", "active", "completed", "cancelled"].map((status) => [status, humanize(status)])} />
      </div>
    </Card>
    <Card className="mt-4 overflow-hidden p-0"><div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="text-sm font-semibold">Display assignments</h2><p className="mt-0.5 text-xs text-text-muted">{rows.length} of {assignments.length} assignments</p></div><SlidersHorizontal className="h-4 w-4 text-text-muted" /></div>
      <div className="max-w-full overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-xs"><thead className="bg-subtle text-[10px] uppercase text-text-muted"><tr>{["Store", "Display #", "Display name", "Start date", "End date", "Products", "Case quantity", "Preferred supplier", "Reset date", "Status", ""].map((heading) => <th key={heading} className="px-3 py-2.5 font-semibold">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{rows.map((assignment) => <AllocationRow key={assignment.id} assignment={assignment} data={data} products={productsFor(assignment.id)} onEdit={() => openEditor(assignment)} />)}</tbody></table></div>
      {rows.length === 0 && <div className="p-4"><EmptyState title="No matching assignments" message="Adjust the planner filters to see more display allocations." /></div>}
    </Card>
    {draft && <AssignmentEditor data={data} draft={draft} assignmentId={selectedId} defaultQuantity={defaultQuantity} onDefaultQuantity={setDefaultQuantity} onChange={setDraft} onClose={() => setDraft(undefined)} onSave={async (value, id) => { if (id) await updateDisplayAssignment(id, value); else await createDisplayAssignment(value); }} />}
  </>}</DataState>;
}

function AllocationRow({ assignment, data, products, onEdit }: { assignment: DisplayAssignment; data: PlatformSnapshot; products: DisplayAssignmentProduct[]; onEdit(): void }) {
  const store = data.stores.find((item) => item.id === assignment.storeId); const area = data.displayAreas.find((item) => item.id === assignment.displayAreaId); const resetDate = resetDateForAssignment(assignment, data);
  return <tr className="align-top hover:bg-subtle/60"><td className="px-3 py-3 font-semibold">{store?.name}</td><td className="px-3 py-3">{area?.displayNumber}</td><td className="px-3 py-3"><span className="font-semibold">{area?.name}</span><span className="block text-[10px] text-text-muted">{area?.code}</span></td><td className="whitespace-nowrap px-3 py-3">{formatDate(assignment.startDate)}</td><td className="whitespace-nowrap px-3 py-3">{formatDate(assignment.endDate)}</td>
    <td className="max-w-52 px-3 py-3">{products.map((product) => <span key={product.id} className="block"><span className="font-medium">{product.sku}</span> <span className="text-text-muted">{productDetails(product, data).name}</span></span>)}</td><td className="px-3 py-3">{products.reduce((sum, product) => sum + product.caseQuantity, 0)} total<span className="block text-[10px] text-text-muted">{products.map((product) => product.caseQuantity).join(" + ")}</span></td><td className="px-3 py-3">{[...new Set(products.map((product) => productDetails(product, data).supplierName))].join(", ")}</td><td className="whitespace-nowrap px-3 py-3">{resetDate ? formatDate(resetDate) : "-"}</td><td className="px-3 py-3"><Badge tone={statusTone(assignment.status)}>{humanize(assignment.status)}</Badge></td><td className="px-3 py-3 text-right"><Button variant="secondary" onClick={onEdit}>Edit</Button></td></tr>;
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange(value: string): void; options: string[][] }) { return <Field label={label}><select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}><option value="">All</option>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></Field>; }

function toAssignmentDraft(assignment: DisplayAssignment): CreateDisplayAssignmentInput["assignment"] {
  return { programId: assignment.programId, periodId: assignment.periodId, storeId: assignment.storeId, displayAreaId: assignment.displayAreaId, startDate: assignment.startDate, endDate: assignment.endDate, resetRequired: assignment.resetRequired, notes: assignment.notes, status: assignment.status };
}

function toProductDraft(product: DisplayAssignmentProduct): CreateDisplayAssignmentInput["products"][number] {
  return { productId: product.productId, sku: product.sku, caseQuantity: product.caseQuantity, required: product.required, minimumFacings: product.minimumFacings, preferredSupplierId: product.preferredSupplierId, note: product.note };
}
