import { useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { Check, ClipboardCopy, CopyPlus, MoveRight, Plus, RotateCcw, Save, SlidersHorizontal, X } from "lucide-react";
import { Button, Card, Field, humanize, inputClass } from "../../components/ui";
import type { CreateDisplayAssignmentInput } from "../../domain/repositories";
import type { DisplayAssignmentProduct, DisplayAssignmentStatus, PlatformSnapshot } from "../../domain/types";
import { productDetails } from "./allocationPlanner";

type ProductDraft = Omit<DisplayAssignmentProduct, "id" | "assignmentId">;

export function AssignmentEditor({ data, draft, assignmentId, defaultQuantity, onDefaultQuantity, onChange, onSave, onClose }: {
  data: PlatformSnapshot;
  draft: CreateDisplayAssignmentInput;
  assignmentId?: string;
  defaultQuantity: number;
  onDefaultQuantity(value: number): void;
  onChange(value: CreateDisplayAssignmentInput): void;
  onSave(value: CreateDisplayAssignmentInput, assignmentId?: string): Promise<void>;
  onClose(): void;
}) {
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyStoreIds, setCopyStoreIds] = useState<string[]>([]);
  const [copyAreaId, setCopyAreaId] = useState("");
  const quantityRef = useRef<HTMLInputElement>(null);
  const program = data.programs.find((item) => item.id === draft.assignment.programId)!;
  const periods = data.programPeriods.filter((item) => item.programId === program.id);
  const catalog: ProductDraft[] = data.products.filter((product) => product.active).map((product) => ({
    productId: product.id,
    sku: product.sku,
    caseQuantity: defaultQuantity,
    required: true,
    preferredSupplierId: data.supplierProductOptions.find((option) => option.productId === product.id && option.preferred)?.supplierId,
  }));

  const assignmentPatch = (patch: Partial<CreateDisplayAssignmentInput["assignment"]>) => onChange({ ...draft, assignment: { ...draft.assignment, ...patch } });
  const productPatch = (index: number, patch: Partial<ProductDraft>) => onChange({ ...draft, products: draft.products.map((product, itemIndex) => itemIndex === index ? { ...product, ...patch } : product) });
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setFormError(""); setMessage("");
    try { await onSave(draft, assignmentId); setMessage("Assignment saved to mock storage."); }
    catch (cause) { setFormError(cause instanceof Error ? cause.message : "Unable to save the assignment."); }
  };
  const addProduct = () => {
    const available = catalog.find((product) => !draft.products.some((item) => item.productId === product.productId));
    if (!available) return;
    const product = { productId: available.productId, sku: available.sku, caseQuantity: defaultQuantity, required: available.required, minimumFacings: available.minimumFacings, preferredSupplierId: available.preferredSupplierId, note: available.note };
    onChange({ ...draft, products: [...draft.products, product] });
  };
  const toggleCopyStore = (storeId: string) => {
    setCopyStoreIds((current) => current.includes(storeId) ? current.filter((id) => id !== storeId) : [...current, storeId]);
    setCopyAreaId("");
  };
  const copyAssignments = async () => {
    setFormError(""); setMessage("");
    try {
      for (const storeId of copyStoreIds) {
        const source = data.displayAreas.find((area) => area.id === draft.assignment.displayAreaId);
        const compatible = data.displayAreas.filter((area) => area.storeId === storeId && area.type === source?.type && area.capacity === source?.capacity);
        const destination = copyStoreIds.length === 1 && copyAreaId
          ? data.displayAreas.find((area) => area.id === copyAreaId && area.storeId === storeId)
          : compatible.length === 1 ? compatible[0] : undefined;
        if (!destination) throw new Error("Choose a compatible destination display for each store; display numbers are not assumed to mean the same asset across stores.");
        await onSave({ ...draft, assignment: { ...draft.assignment, storeId, displayAreaId: destination.id, status: "draft" } });
      }
      setMessage(`Assignment copied to ${copyStoreIds.length} store${copyStoreIds.length === 1 ? "" : "s"}.`); setCopyOpen(false);
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : "Unable to copy the assignment."); }
  };

  return <form onSubmit={submit} className="mt-4" aria-label="Assignment editor"><Card className="p-0">
    <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4"><div><p className="text-xs font-semibold uppercase text-primary">Assignment editor</p><h2 className="mt-1 text-lg font-semibold">{assignmentId ? "Edit display assignment" : "New display assignment"}</h2></div><Button type="button" variant="secondary" aria-label="Close assignment editor" onClick={onClose}><X className="h-4 w-4" /></Button></div>
    <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_280px]"><div className="min-w-0 space-y-6">
      {formError && <div role="alert" className="rounded-md border border-error/20 bg-error-subtle p-3 text-sm text-error">{formError}</div>}
      {message && <div role="status" className="flex items-center gap-2 rounded-md border border-success/20 bg-success-subtle p-3 text-sm text-success"><Check className="h-4 w-4" />{message}</div>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Store"><select className={inputClass} value={draft.assignment.storeId} onChange={(event) => assignmentPatch({ storeId: event.target.value, displayAreaId: data.displayAreas.find((area) => area.storeId === event.target.value)?.id ?? "" })}>{data.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></Field>
        <Field label="Display area"><select data-testid="display-area" className={inputClass} value={draft.assignment.displayAreaId} onChange={(event) => assignmentPatch({ displayAreaId: event.target.value })}>{data.displayAreas.filter((area) => area.storeId === draft.assignment.storeId).map((area) => <option key={area.id} value={area.id}>Display {area.displayNumber} · {area.name}</option>)}</select></Field>
        <Field label="Program period"><select className={inputClass} value={draft.assignment.periodId ?? ""} onChange={(event) => { const period = periods.find((item) => item.id === event.target.value); assignmentPatch({ periodId: event.target.value || undefined, ...(period ? { startDate: period.startDate, endDate: period.endDate } : {}) }); }}><option value="">Full program / custom</option>{periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select></Field>
        <Field label="Start date"><input className={inputClass} type="date" value={draft.assignment.startDate} onChange={(event) => assignmentPatch({ startDate: event.target.value })} /></Field>
        <Field label="End date"><input className={inputClass} type="date" value={draft.assignment.endDate} onChange={(event) => assignmentPatch({ endDate: event.target.value })} /></Field>
        <Field label="Status"><select className={inputClass} value={draft.assignment.status} onChange={(event) => assignmentPatch({ status: event.target.value as DisplayAssignmentStatus })}>{["draft", "planned", "ready", "active", "completed", "cancelled"].map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select></Field>
        <Field label="Notes"><textarea className={`${inputClass} min-h-20 py-2`} value={draft.assignment.notes} onChange={(event) => assignmentPatch({ notes: event.target.value })} /></Field>
        <label className="flex min-h-9 items-center gap-2 self-end text-sm font-semibold"><input type="checkbox" checked={draft.assignment.resetRequired} onChange={(event) => assignmentPatch({ resetRequired: event.target.checked })} />Reset required</label>
      </div>
      <div><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Products</h3><p className="mt-1 text-xs text-text-muted">Case quantity is specific to this store and display assignment.</p></div><Button type="button" variant="secondary" disabled={draft.products.length >= catalog.length} onClick={addProduct}><Plus className="h-4 w-4" />Add product</Button></div>
        <div className="mt-3 space-y-3">{draft.products.map((product, index) => <ProductRow key={`${product.productId}-${index}`} data={data} product={product} inputRef={index === 0 ? quantityRef : undefined} onChange={(patch) => productPatch(index, patch)} onRemove={() => onChange({ ...draft, products: draft.products.filter((_, itemIndex) => itemIndex !== index) })} />)}</div>
      </div>
    </div><aside className="space-y-3 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
      <h3 className="text-sm font-semibold">Allocation actions</h3><Field label="Default case quantity"><input className={inputClass} type="number" min="1" step="1" value={defaultQuantity} onChange={(event) => onDefaultQuantity(Number(event.target.value))} /></Field>
      <Action icon={<CopyPlus className="h-4 w-4" />} label="Apply default case quantity" onClick={() => onChange({ ...draft, products: draft.products.map((product) => ({ ...product, caseQuantity: defaultQuantity })) })} />
      <Action icon={<SlidersHorizontal className="h-4 w-4" />} label="Edit store-specific quantity" onClick={() => { quantityRef.current?.focus(); setMessage("Store-specific quantities are editable by product."); }} />
      <Action icon={<MoveRight className="h-4 w-4" />} label="Move assignment to another display" onClick={() => document.querySelector<HTMLSelectElement>('[data-testid="display-area"]')?.focus()} />
      <Action icon={<RotateCcw className="h-4 w-4" />} label="Schedule reset" onClick={() => assignmentPatch({ resetRequired: true })} />
      <Action icon={<ClipboardCopy className="h-4 w-4" />} label="Copy assignment to another store" onClick={() => setCopyOpen(!copyOpen)} />
      <Action icon={<ClipboardCopy className="h-4 w-4" />} label="Copy assignment to selected stores" onClick={() => setCopyOpen(true)} />
      {copyOpen && <div className="space-y-3 rounded-md border border-border bg-subtle p-3"><p className="text-xs font-semibold">Destination stores</p>{data.stores.filter((store) => store.id !== draft.assignment.storeId).map((store) => <label key={store.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={copyStoreIds.includes(store.id)} onChange={() => toggleCopyStore(store.id)} />{store.name}</label>)}
        {copyStoreIds.length === 1 && <Field label="Destination display"><select className={inputClass} value={copyAreaId} onChange={(event) => setCopyAreaId(event.target.value)}><option value="">Match display number</option>{data.displayAreas.filter((area) => area.storeId === copyStoreIds[0]).map((area) => <option key={area.id} value={area.id}>Display {area.displayNumber} · {area.name}</option>)}</select></Field>}
        <Button type="button" className="w-full" disabled={copyStoreIds.length === 0} onClick={() => void copyAssignments()}>Create {copyStoreIds.length > 1 ? "copies" : "copy"}</Button>
      </div>}
      <div className="rounded-md border border-dashed border-border p-3 text-xs text-text-muted"><p className="font-semibold text-text-secondary">Adjust by store volume</p><p className="mt-1">Reserved for a future workflow. No automatic scaling is applied.</p></div>
      <Button className="w-full" type="submit"><Save className="h-4 w-4" />Save assignment</Button>
    </aside></div>
  </Card></form>;
}

function ProductRow({ data, product, inputRef, onChange, onRemove }: { data: PlatformSnapshot; product: ProductDraft; inputRef?: RefObject<HTMLInputElement | null>; onChange(patch: Partial<ProductDraft>): void; onRemove(): void }) {
  const options = data.supplierProductOptions.filter((option) => option.productId === product.productId);
  return <div className="grid gap-3 rounded-md border border-border bg-subtle/40 p-3 md:grid-cols-2 lg:grid-cols-[120px_minmax(140px,1fr)_minmax(150px,1fr)_110px_90px_auto] lg:items-end">
    <Field label="SKU"><input className={inputClass} value={product.sku} readOnly /></Field><Field label="Product"><input className={inputClass} value={productDetails({ ...product, id: "draft", assignmentId: "draft" }, data).name} readOnly /></Field>
    <Field label="Supplier"><select className={inputClass} value={product.preferredSupplierId ?? ""} onChange={(event) => onChange({ preferredSupplierId: event.target.value || undefined })}><option value="">Default supplier</option>{options.map((option) => <option key={option.supplierId} value={option.supplierId}>{option.supplierName}{option.preferred ? " (preferred)" : ""}</option>)}</select></Field>
    <Field label="Case quantity"><input ref={inputRef} className={inputClass} type="number" min="0" step="1" value={product.caseQuantity} onChange={(event) => onChange({ caseQuantity: Number(event.target.value) })} /></Field>
    <label className="flex min-h-9 items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={product.required} onChange={(event) => onChange({ required: event.target.checked })} />Required</label><Button type="button" variant="secondary" aria-label={`Remove ${product.sku}`} onClick={onRemove}><X className="h-4 w-4" /></Button>
    <Field label="Product note"><input className={`${inputClass} lg:col-span-6`} value={product.note ?? ""} onChange={(event) => onChange({ note: event.target.value || undefined })} /></Field>
  </div>;
}

function Action({ icon, label, onClick }: { icon: ReactNode; label: string; onClick(): void }) { return <Button type="button" variant="secondary" className="w-full" onClick={onClick}>{icon}{label}</Button>; }
