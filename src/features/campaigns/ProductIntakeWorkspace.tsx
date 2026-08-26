import { ClipboardList, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CampaignProduct, Product, ProductRole } from "../../domain/types";
import type { ApplyCampaignProductImportInput, CreatePendingProductInput } from "../../domain/repositories";
import { productMasterStatusLabel } from "../../domain/productMaster";
import { reviewSkus, type BulkSkuReview } from "./productIntake";
import { CampaignProductImportDialog } from "./CampaignProductImportDialog";
import { Badge, Button, Card, EmptyState, inputClass } from "../../components/ui";

interface ProductIntakeWorkspaceProps {
  products: Product[];
  assortment: CampaignProduct[];
  saving?: boolean;
  onAdd(productIds: string[]): Promise<void>;
  onUpdate(campaignProductId: string, patch: Pick<CampaignProduct, "role" | "required">): Promise<void>;
  onRemove(campaignProductId: string): Promise<void>;
  searchProducts(query: string): Promise<Product[]>;
  onCreatePendingProduct(input: CreatePendingProductInput): Promise<Product>;
  onApplyImport(products: ApplyCampaignProductImportInput["products"]): Promise<void>;
}

export function ProductIntakeWorkspace(props: ProductIntakeWorkspaceProps) {
  const { products, assortment, saving = false, onAdd, onUpdate, onRemove, searchProducts, onCreatePendingProduct, onApplyImport } = props;
  const [searchOpen, setSearchOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const verified = assortment.filter((item) => {
    const product = productById.get(item.productId);
    return product?.active && product.masterStatus === "verified";
  }).length;
  const needsReview = assortment.length - verified;

  return <Card className="overflow-hidden p-0">
    <div className="flex flex-col gap-3 border-b border-border px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="font-semibold">Campaign assortment</h2>
        <p className="mt-1 text-sm text-text-muted">Add existing Product Master records to this campaign.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" />Upload spreadsheet</Button>
        <Button type="button" variant="secondary" onClick={() => setBulkOpen(true)}><ClipboardList className="h-4 w-4" />Bulk add SKUs</Button>
        <Button type="button" onClick={() => setSearchOpen(true)}><Plus className="h-4 w-4" />Add products</Button>
      </div>
    </div>

    <dl className="grid gap-3 border-b border-border bg-subtle/40 px-4 py-3 text-sm sm:grid-cols-3">
      <Count label="Total products" value={assortment.length} />
      <Count label="Verified" value={verified} />
      <Count label="Needs review" value={needsReview} warning={needsReview > 0} />
    </dl>

    {assortment.length === 0 ? <div className="p-4">
      <EmptyState title="No campaign products yet" message="Search Product Master to add verified products to this campaign." />
    </div> : <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-subtle/60 text-xs uppercase text-text-muted">
          <tr>
            <th className="px-4 py-3">SKU</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Required / optional</th>
            <th className="px-4 py-3">Product status</th>
            <th className="w-12"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {assortment.map((item) => {
            const product = productById.get(item.productId);
            const productLabel = product?.sku ?? "product";
            return <tr key={item.id}>
              <td className="px-4 py-3 font-medium">{product?.sku ?? "Unknown"}</td>
              <td className="px-4 py-3 font-medium">{product?.name ?? "Product unavailable"}</td>
              <td className="px-4 py-3">{product?.category ?? "Uncategorized"}</td>
              <td className="px-4 py-3">
                <select
                  aria-label={`Role for ${productLabel}`}
                  className={inputClass}
                  disabled={saving}
                  value={item.role}
                  onChange={(event) => void onUpdate(item.id, { role: event.target.value as ProductRole, required: item.required })}
                >
                  {["Feature", "Core", "Supporting", "Optional"].map((role) => <option key={role}>{role}</option>)}
                </select>
              </td>
              <td className="px-4 py-3">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Required ${productLabel}`}
                    checked={item.required}
                    disabled={saving}
                    onChange={(event) => void onUpdate(item.id, { role: item.role, required: event.target.checked })}
                  />
                  <span>{item.required ? "Required" : "Optional"}</span>
                </label>
              </td>
              <td className="px-4 py-3"><ProductStatus product={product} /></td>
              <td className="pr-3">
                <button
                  type="button"
                  aria-label={`Remove ${productLabel}`}
                  className="grid h-9 w-9 place-items-center rounded-md text-error hover:bg-error-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={saving}
                  onClick={() => void onRemove(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>}

    {searchOpen && <ProductSearchDialog assortment={assortment} searchProducts={searchProducts} onAdd={async (productIds) => { await onAdd(productIds); setSearchOpen(false); }} onClose={() => setSearchOpen(false)} />}
    {bulkOpen && <BulkSkuDialog products={products} assortment={assortment} onAdd={onAdd} onCreatePendingProduct={onCreatePendingProduct} onClose={() => setBulkOpen(false)} />}
    {importOpen && <CampaignProductImportDialog products={products} assortment={assortment} onCreatePendingProduct={onCreatePendingProduct} onApply={onApplyImport} onClose={() => setImportOpen(false)} />}
  </Card>;
}

function BulkSkuDialog({ products, assortment, onAdd, onCreatePendingProduct, onClose }: { products: Product[]; assortment: CampaignProduct[]; onAdd(productIds: string[]): Promise<void>; onCreatePendingProduct(input: CreatePendingProductInput): Promise<Product>; onClose(): void }) {
  const [value, setValue] = useState("");
  const [review, setReview] = useState<BulkSkuReview>();
  const [pendingSku, setPendingSku] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addMatched = async () => {
    if (!review?.found.length) return;
    setSaving(true);
    setError("");
    try {
      await onAdd(review.found.map((product) => product.id));
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Matched products could not be added.");
      setSaving(false);
    }
  };

  const createPending = async (input: CreatePendingProductInput) => {
    setSaving(true);
    setError("");
    try {
      const product = await onCreatePendingProduct(input);
      await onAdd([product.id]);
      setPendingSku(undefined);
      setReview((current) => current && { ...current, unknown: current.unknown.filter((sku) => sku !== input.sku) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pending product could not be created.");
    } finally {
      setSaving(false);
    }
  };

  if (pendingSku) return <PendingProductDialog sku={pendingSku} saving={saving} error={error} onBack={() => { setPendingSku(undefined); setError(""); }} onCreate={createPending} onClose={onClose} />;

  return <Dialog title="Bulk add SKUs" description="Paste SKUs separated by new lines, commas, tabs, or spaces." onClose={onClose}>
    <div className="space-y-5 p-5">
      {error && <div role="alert" className="rounded-md border border-error/30 bg-error-subtle p-3 text-sm text-error">{error}</div>}
      {!review ? <>
        <label className="block text-sm font-medium" htmlFor="bulk-skus">Paste SKUs</label>
        <textarea id="bulk-skus" aria-label="Paste SKUs" className={`${inputClass} min-h-56 py-2`} value={value} onChange={(event) => setValue(event.target.value)} placeholder={"MOCK-1001\nMOCK-1002\n001234"} />
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" disabled={!value.trim()} onClick={() => setReview(reviewSkus(value, products, assortment))}>Review SKUs</Button></div>
      </> : <>
        <BulkReviewSummary review={review} />
        <div className="space-y-3 text-sm">
          <ReviewList title="MATCHED" items={review.found.map((product) => `${product.sku} · ${product.name}`)} />
          <ReviewList title="ALREADY ADDED" items={review.alreadyAdded.map((product) => `${product.sku} · ${product.name}`)} />
          <ReviewList title="NEW / UNKNOWN" items={review.unknown} />
          <ReviewList title="INVALID" items={review.invalid} tone="error" />
        </div>
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>{review.unknown.length > 0 && <Button type="button" variant="secondary" onClick={() => setPendingSku(review.unknown[0])}>Resolve new products</Button>}<Button type="button" disabled={!review.found.length || saving} onClick={() => void addMatched()}>{saving ? "Adding..." : "Add matched products"}</Button></div>
      </>}
    </div>
  </Dialog>;
}

function BulkReviewSummary({ review }: { review: BulkSkuReview }) {
  const counts = [["Submitted", review.submitted.length], ["Matched", review.found.length], ["Already added", review.alreadyAdded.length], ["New", review.unknown.length], ["Invalid", review.invalid.length]];
  return <div className="grid gap-2 rounded-md border border-border bg-subtle/40 p-3 text-sm sm:grid-cols-5">{counts.map(([label, value]) => <div key={label}><p className="text-xs text-text-muted">{label}</p><p className="font-semibold">{value}</p></div>)}</div>;
}

function ReviewList({ title, items, tone }: { title: string; items: string[]; tone?: "error" }) {
  return <div><p className={tone === "error" ? "font-semibold text-error" : "font-semibold"}>{title}</p><p className="mt-1 text-text-secondary">{items.length ? items.join(", ") : "None"}</p></div>;
}

function ProductSearchDialog({ assortment, searchProducts, onAdd, onClose }: { assortment: CampaignProduct[]; searchProducts(query: string): Promise<Product[]>; onAdd(productIds: string[]): Promise<void>; onClose(): void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void searchProducts(query).then((items) => {
      if (active) setResults(items);
    });
    return () => { active = false; };
  }, [query, searchProducts]);

  const added = new Set(assortment.map((item) => item.productId));
  const selectedIds = [...selected].filter((productId) => !added.has(productId));

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await onAdd(selectedIds);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Products could not be added.");
      setSaving(false);
    }
  };

  return <Dialog title="Add products" description="Search Product Master by SKU, product name, or category." onClose={onClose}>
    <div className="p-5">
      {error && <div role="alert" className="mb-4 rounded-md border border-error/30 bg-error-subtle p-3 text-sm text-error">{error}</div>}
      <label className="relative block">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
        <input
          autoFocus
          aria-label="Search Product Master"
          className={`${inputClass} pl-9`}
          placeholder="Search SKU, product, or category"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="mt-4 max-h-[48vh] divide-y divide-border overflow-y-auto rounded-md border border-border">
        {results.map((product) => {
          const alreadyAdded = added.has(product.id);
          return <label key={product.id} className={`flex cursor-pointer items-start gap-3 p-3 ${alreadyAdded ? "bg-subtle opacity-60" : "hover:bg-subtle/50"}`}>
            <input
              className="mt-1"
              type="checkbox"
              disabled={alreadyAdded || saving}
              checked={selected.has(product.id)}
              onChange={(event) => setSelected((current) => {
                const next = new Set(current);
                if (event.target.checked) next.add(product.id);
                else next.delete(product.id);
                return next;
              })}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{product.sku}</span>
                <ProductStatus product={product} />
                {alreadyAdded && <Badge>Already added</Badge>}
              </div>
              <p className="mt-1 font-medium">{product.name}</p>
              <p className="text-xs text-text-muted">{[product.category, product.casePack ? `Case pack: ${product.casePack}` : "Case pack: not set"].join(" · ")}</p>
            </div>
          </label>;
        })}
        {results.length === 0 && <p className="p-4 text-sm text-text-muted">No Product Master records match this search.</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="button" disabled={!selectedIds.length || saving} onClick={() => void submit()}>{saving ? "Adding..." : "Add selected products"}</Button>
      </div>
    </div>
  </Dialog>;
}

function PendingProductDialog({ sku, saving, error, onBack, onCreate, onClose }: { sku: string; saving: boolean; error: string; onBack(): void; onCreate(input: CreatePendingProductInput): Promise<void>; onClose(): void }) {
  const [form, setForm] = useState<CreatePendingProductInput>({ sku, name: "", category: "", brand: "", packageSize: "", casePack: undefined, supplierName: "", notes: "" });
  const update = <K extends keyof CreatePendingProductInput>(key: K, value: CreatePendingProductInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  return <Dialog title="Create pending product" description="This product can be planned now and will remain pending Product Master review." onClose={onClose}>
    <form className="space-y-4 p-5" onSubmit={(event) => { event.preventDefault(); void onCreate({ ...form, sku: form.sku.trim(), name: form.name.trim(), category: form.category.trim() }); }}>
      {error && <div role="alert" className="rounded-md border border-error/30 bg-error-subtle p-3 text-sm text-error">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">SKU<input aria-label="Pending product SKU" className={`${inputClass} mt-1`} value={form.sku} readOnly /></label>
        <label className="text-sm font-medium">Product name<input aria-label="Pending product name" className={`${inputClass} mt-1`} value={form.name} onChange={(event) => update("name", event.target.value)} required /></label>
        <label className="text-sm font-medium">Category<input aria-label="Pending product category" className={`${inputClass} mt-1`} value={form.category} onChange={(event) => update("category", event.target.value)} required /></label>
        <label className="text-sm font-medium">Brand<input aria-label="Pending product brand" className={`${inputClass} mt-1`} value={form.brand ?? ""} onChange={(event) => update("brand", event.target.value)} /></label>
        <label className="text-sm font-medium">Size<input aria-label="Pending product size" className={`${inputClass} mt-1`} value={form.packageSize ?? ""} onChange={(event) => update("packageSize", event.target.value)} /></label>
        <label className="text-sm font-medium">Case pack<input aria-label="Pending product case pack" type="number" min="1" className={`${inputClass} mt-1`} value={form.casePack ?? ""} onChange={(event) => update("casePack", event.target.value ? Number(event.target.value) : undefined)} /></label>
        <label className="text-sm font-medium sm:col-span-2">Supplier<input aria-label="Pending product supplier" className={`${inputClass} mt-1`} value={form.supplierName ?? ""} onChange={(event) => update("supplierName", event.target.value)} /></label>
        <label className="text-sm font-medium sm:col-span-2">Note<textarea aria-label="Pending product note" className={`${inputClass} mt-1 min-h-20 py-2`} value={form.notes ?? ""} onChange={(event) => update("notes", event.target.value)} /></label>
      </div>
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onBack}>Back</Button><Button disabled={saving}>{saving ? "Creating..." : "Create pending product"}</Button></div>
    </form>
  </Dialog>;
}

function Dialog({ title, description, children, onClose }: { title: string; description: string; children: ReactNode; onClose(): void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-overlay p-0 sm:items-center sm:p-6" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="product-dialog-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-md border border-border bg-surface shadow-xl sm:rounded-md">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4">
        <div>
          <h2 id="product-dialog-title" className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-text-muted">{description}</p>
        </div>
        <button type="button" aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-md hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </header>
      {children}
    </section>
  </div>;
}

function ProductStatus({ product }: { product?: Product }) {
  const label = productMasterStatusLabel(product);
  if (!product || product.masterStatus === "unresolved") return <Badge tone="error">{label}</Badge>;
  if (!product.active || product.masterStatus === "pending") return <Badge tone="warning">{label}</Badge>;
  return <Badge tone="success">{label}</Badge>;
}

function Count({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <div className="rounded-md border border-border bg-surface px-3 py-2">
    <dt className="text-xs text-text-muted">{label}</dt>
    <dd className={`mt-1 text-lg font-semibold ${warning ? "text-warning" : "text-text-primary"}`}>{value}</dd>
  </div>;
}
