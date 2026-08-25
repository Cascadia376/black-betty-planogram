import readXlsxFile from "read-excel-file";
import { AlertTriangle, FileSpreadsheet, ListPlus, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import type { CreatePendingProductInput } from "../../domain/repositories";
import type { CampaignProduct, Product, ProductRole } from "../../domain/types";
import { Badge, Button, Card, EmptyState, Field, inputClass } from "../../components/ui";
import { campaignProductFromMaster, extractSkuColumn, reviewSkus, type BulkSkuReview } from "./productIntake";

interface ProductIntakeWorkspaceProps {
  products: Product[];
  assortment: CampaignProduct[];
  onChange(products: CampaignProduct[]): void;
  searchProducts(query: string): Promise<Product[]>;
  createPendingProduct(input: CreatePendingProductInput): Promise<Product>;
}

type Workspace = "search" | "bulk" | "new" | null;

export function ProductIntakeWorkspace(props: ProductIntakeWorkspaceProps) {
  const { products, assortment, onChange, searchProducts, createPendingProduct } = props;
  const [workspace, setWorkspace] = useState<Workspace>(null);
  const [newSku, setNewSku] = useState("");
  const [uploadedSkus, setUploadedSkus] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const productById = new Map(products.map((product) => [product.id, product]));
  const verified = assortment.filter((item) => productById.get(item.productId)?.masterStatus === "verified").length;
  const pending = assortment.length - verified;

  const addProducts = (selected: Product[]) => {
    const existing = new Set(assortment.map((item) => item.productId));
    onChange([...assortment, ...selected.filter((product) => !existing.has(product.id)).map(campaignProductFromMaster)]);
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const rows = await readXlsxFile(file);
      const skus = extractSkuColumn(rows);
      setUploadedSkus(skus.join("\n"));
      setUploadError("");
    } catch (cause) {
      setUploadedSkus("");
      setUploadError(cause instanceof Error ? cause.message : "The workbook could not be parsed.");
    }
    setWorkspace("bulk");
  };

  return <Card className="overflow-hidden p-0">
    <div className="flex flex-col gap-3 border-b border-border px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div><h2 className="font-semibold">Product intake</h2><p className="mt-1 text-sm text-text-muted">Build the campaign assortment from Product Master.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => setWorkspace("bulk")}><ListPlus className="h-4 w-4" />Bulk add SKUs</Button>
        <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}><FileSpreadsheet className="h-4 w-4" />Upload spreadsheet</Button>
        <Button type="button" onClick={() => setWorkspace("search")}><Plus className="h-4 w-4" />Add products</Button>
        <input ref={fileRef} className="sr-only" type="file" accept=".xlsx" aria-label="Upload product spreadsheet" onChange={upload} />
      </div>
    </div>
    <div className="flex flex-wrap gap-4 border-b border-border bg-subtle/40 px-4 py-3 text-sm"><strong>Products: {assortment.length}</strong><span>Verified: {verified}</span><span className={pending ? "font-semibold text-warning" : "text-text-muted"}>New / pending: {pending}</span></div>
    {assortment.length === 0 ? <div className="p-4"><EmptyState title="No products added" message="Search Product Master, paste a SKU list, or upload a workbook to establish the campaign assortment." /></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-subtle/60 text-xs uppercase text-text-muted"><tr><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Product</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Package / size</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Required</th><th className="px-4 py-3">Product status</th><th className="w-12"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-border">{assortment.map((item) => {
      const product = productById.get(item.productId);
      return <tr key={item.id}><td className="px-4 py-3 font-medium">{product?.sku ?? "Unknown"}</td><td className="px-4 py-3"><p className="font-medium">{product?.name ?? "Product unavailable"}</p>{product?.brand && <p className="text-xs text-text-muted">{product.brand}</p>}</td><td className="px-4 py-3">{product?.category ?? "-"}</td><td className="px-4 py-3">{product?.packageSize ?? "-"}</td><td className="px-4 py-3"><select aria-label={`Role for ${product?.sku}`} className={inputClass} value={item.role} onChange={(event) => onChange(assortment.map((candidate) => candidate.id === item.id ? { ...candidate, role: event.target.value as ProductRole } : candidate))}>{["Feature", "Core", "Supporting", "Optional"].map((role) => <option key={role}>{role}</option>)}</select></td><td className="px-4 py-3"><input aria-label={`Required ${product?.sku}`} type="checkbox" checked={item.required} onChange={(event) => onChange(assortment.map((candidate) => candidate.id === item.id ? { ...candidate, required: event.target.checked } : candidate))} /></td><td className="px-4 py-3"><ProductStatus product={product} /></td><td className="pr-3"><button type="button" aria-label={`Remove ${product?.sku ?? "product"}`} className="grid h-9 w-9 place-items-center rounded-md text-error hover:bg-error-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" onClick={() => onChange(assortment.filter((candidate) => candidate.id !== item.id))}><Trash2 className="h-4 w-4" /></button></td></tr>;
    })}</tbody></table></div>}
    {workspace === "search" && <ProductSearchDialog assortment={assortment} searchProducts={searchProducts} onAdd={(selected) => { addProducts(selected); setWorkspace(null); }} onClose={() => setWorkspace(null)} />}
    {workspace === "bulk" && <BulkSkuDialog products={products} assortment={assortment} initialValue={uploadedSkus} initialError={uploadError} onAdd={addProducts} onNew={(sku) => { setNewSku(sku); setUploadedSkus(sku); setWorkspace("new"); }} onClose={() => { setUploadedSkus(""); setUploadError(""); setWorkspace(null); }} />}
    {workspace === "new" && <NewProductDialog sku={newSku} onBack={() => setWorkspace("bulk")} onCreate={async (input) => { const product = await createPendingProduct(input); addProducts([product]); setWorkspace("bulk"); }} onClose={() => setWorkspace(null)} />}
  </Card>;
}

function Dialog({ title, description, children, onClose }: { title: string; description: string; children: ReactNode; onClose(): void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-overlay p-0 sm:items-center sm:p-6" role="presentation" onSubmit={(event) => event.stopPropagation()}><section role="dialog" aria-modal="true" aria-labelledby="product-dialog-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-md border border-border bg-surface shadow-xl sm:rounded-md"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4"><div><h2 id="product-dialog-title" className="font-semibold">{title}</h2><p className="mt-1 text-sm text-text-muted">{description}</p></div><button type="button" aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-md hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" onClick={onClose}><X className="h-4 w-4" /></button></header>{children}</section></div>;
}

function ProductSearchDialog({ assortment, searchProducts, onAdd, onClose }: { assortment: CampaignProduct[]; searchProducts(query: string): Promise<Product[]>; onAdd(products: Product[]): void; onClose(): void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewedInactive, setReviewedInactive] = useState(false);
  useEffect(() => { let active = true; void searchProducts(query).then((items) => { if (active) setResults(items); }); return () => { active = false; }; }, [query, searchProducts]);
  const added = new Set(assortment.map((item) => item.productId));
  const chosen = results.filter((product) => selected.has(product.id));
  const hasInactive = chosen.some((product) => !product.active);
  return <Dialog title="Add products" description="Search Product Master by SKU, product name, brand, or category." onClose={onClose}><div className="p-5"><label className="relative block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" /><input autoFocus className={`${inputClass} pl-9`} placeholder="Search SKU, product, brand, or category" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="mt-4 max-h-[48vh] divide-y divide-border overflow-y-auto rounded-md border border-border">{results.map((product) => <label key={product.id} className={`flex cursor-pointer items-start gap-3 p-3 ${added.has(product.id) ? "bg-subtle opacity-60" : "hover:bg-subtle/50"}`}><input className="mt-1" type="checkbox" disabled={added.has(product.id)} checked={selected.has(product.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(product.id); else next.delete(product.id); return next; })} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{product.sku}</span><ProductStatus product={product} />{added.has(product.id) && <Badge>Already added</Badge>}</div><p className="mt-1 font-medium">{product.name}</p><p className="text-xs text-text-muted">{[product.brand, product.category, product.packageSize, product.casePack ? `Case pack: ${product.casePack}` : undefined].filter(Boolean).join(" · ")}</p></div></label>)}</div>{hasInactive && <label className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning-subtle p-3 text-sm"><input className="mt-1" type="checkbox" checked={reviewedInactive} onChange={(event) => setReviewedInactive(event.target.checked)} /><span><strong>Review inactive products.</strong> I understand the selected inactive product requires explicit campaign review.</span></label>}<div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" disabled={!chosen.length || (hasInactive && !reviewedInactive)} onClick={() => onAdd(chosen)}>Add selected products</Button></div></div></Dialog>;
}

function BulkSkuDialog({ products, assortment, initialValue, initialError, onAdd, onNew, onClose }: { products: Product[]; assortment: CampaignProduct[]; initialValue: string; initialError: string; onAdd(products: Product[]): void; onNew(sku: string): void; onClose(): void }) {
  const [value, setValue] = useState(initialValue);
  const [review, setReview] = useState<BulkSkuReview | undefined>(() => initialValue ? reviewSkus(initialValue, products, assortment) : undefined);
  const [error, setError] = useState(initialError);
  const [reviewedInactive, setReviewedInactive] = useState(false);
  const inactive = review?.found.filter((product) => !product.active) ?? [];
  return <Dialog title="Bulk add SKUs" description="Paste SKUs separated by new lines, commas, spaces, or tabs." onClose={onClose}><div className="p-5">{error && <div role="alert" className="mb-4 rounded-md border border-error/30 bg-error-subtle p-3 text-sm text-error">{error}</div>}<textarea autoFocus className={`${inputClass} min-h-40 py-3 font-mono`} value={value} onChange={(event) => { setValue(event.target.value); setReview(undefined); setError(""); }} placeholder={"123456\n234567\n345678"} />{!review ? <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" disabled={!value.trim()} onClick={() => setReview(reviewSkus(value, products, assortment))}>Review SKUs</Button></div> : <><div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5"><Summary value={review.submitted.length} label="Submitted" /><Summary value={review.found.length} label="Matched" /><Summary value={review.alreadyAdded.length} label="Already added" /><Summary value={review.unknown.length} label="Unknown" /><Summary value={review.invalid.length} label="Invalid" /></div><ReviewGroup title="Found">{review.found.map((product) => <ProductLine key={product.id} product={product} />)}</ReviewGroup><ReviewGroup title="Already added">{review.alreadyAdded.map((product) => <ProductLine key={product.id} product={product} />)}</ReviewGroup><ReviewGroup title="Not found">{review.unknown.map((sku) => <div key={sku} className="flex items-center justify-between gap-3 py-2 text-sm"><span><strong>{sku}</strong> <span className="text-text-muted">Product not found</span></span><Button type="button" variant="secondary" onClick={() => onNew(sku)}>Mark as new product</Button></div>)}</ReviewGroup><ReviewGroup title="Invalid">{review.invalid.map((sku) => <p key={sku} className="py-2 font-mono text-sm text-error">{sku}</p>)}</ReviewGroup>{inactive.length > 0 && <label className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning-subtle p-3 text-sm"><input className="mt-1" type="checkbox" checked={reviewedInactive} onChange={(event) => setReviewedInactive(event.target.checked)} /><span>I reviewed {inactive.length} inactive matched product{inactive.length === 1 ? "" : "s"}.</span></label>}<div className="mt-5 flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" disabled={!review.found.length || (inactive.length > 0 && !reviewedInactive)} onClick={() => { onAdd(review.found); setReview(reviewSkus(value, products, [...assortment, ...review.found.map(campaignProductFromMaster)])); }}>Add matched products</Button></div></>}</div></Dialog>;
}

function NewProductDialog({ sku, onCreate, onBack, onClose }: { sku: string; onCreate(input: CreatePendingProductInput): Promise<void>; onBack(): void; onClose(): void }) {
  const [input, setInput] = useState<CreatePendingProductInput>({ sku, name: "", category: "", brand: "", packageSize: "", supplierName: "", supplierProductCode: "", notes: "" });
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const set = <K extends keyof CreatePendingProductInput>(key: K, value: CreatePendingProductInput[K]) => setInput((current) => ({ ...current, [key]: value }));
  const submit = async () => { setSaving(true); setError(""); try { await onCreate(input); } catch (cause) { setError(cause instanceof Error ? cause.message : "The pending product could not be created."); } finally { setSaving(false); } };
  return <Dialog title="Create new product record" description="Collect only what is needed for planning. This record requires Product Master review." onClose={onClose}><div className="p-5">{error && <div role="alert" className="mb-4 rounded-md border border-error/30 bg-error-subtle p-3 text-sm text-error">{error}</div>}<div className="mb-4 flex items-start gap-3 rounded-md border border-warning/30 bg-warning-subtle p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>New / Product Master review required.</strong> Local details are temporary and are not authoritative master data.</span></div><div className="grid gap-4 sm:grid-cols-2"><Field label="SKU"><input className={inputClass} value={input.sku} onChange={(event) => set("sku", event.target.value)} required /></Field><Field label="Product name"><input autoFocus className={inputClass} value={input.name} onChange={(event) => set("name", event.target.value)} required /></Field><Field label="Category"><input className={inputClass} value={input.category} onChange={(event) => set("category", event.target.value)} required /></Field><Field label="Brand"><input className={inputClass} value={input.brand} onChange={(event) => set("brand", event.target.value)} /></Field><Field label="Package / size"><input className={inputClass} value={input.packageSize} onChange={(event) => set("packageSize", event.target.value)} /></Field><Field label="Case pack"><input type="number" min="1" className={inputClass} value={input.casePack ?? ""} onChange={(event) => set("casePack", event.target.value ? Number(event.target.value) : undefined)} /></Field><Field label="Supplier"><input className={inputClass} value={input.supplierName} onChange={(event) => set("supplierName", event.target.value)} /></Field><Field label="Supplier product code"><input className={inputClass} value={input.supplierProductCode} onChange={(event) => set("supplierProductCode", event.target.value)} /></Field><div className="sm:col-span-2"><Field label="Notes"><textarea className={`${inputClass} min-h-20 py-2`} value={input.notes} onChange={(event) => set("notes", event.target.value)} /></Field></div></div><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onBack}>Back</Button><Button type="button" disabled={saving || !input.sku.trim() || !input.name.trim() || !input.category.trim()} onClick={() => void submit()}>{saving ? "Creating..." : "Create and add product"}</Button></div></div></Dialog>;
}

function ProductStatus({ product }: { product?: Product }) {
  if (!product) return <Badge tone="error">Unresolved</Badge>;
  if (!product.active) return <Badge tone="warning">Inactive · Review</Badge>;
  if (product.masterStatus === "pending") return <Badge tone="warning">New · Needs product-master review</Badge>;
  if (product.masterStatus === "unresolved") return <Badge tone="error">Unresolved</Badge>;
  return <Badge tone="success">Verified</Badge>;
}

function ProductLine({ product }: { product: Product }) { return <div className="flex flex-wrap items-center gap-2 py-2 text-sm"><strong>{product.sku}</strong><span>{product.name}</span><ProductStatus product={product} /></div>; }
function ReviewGroup({ title, children }: { title: string; children: ReactNode }) { return <section className="mt-4 rounded-md border border-border px-3 py-2"><h3 className="text-xs font-semibold uppercase text-text-muted">{title}</h3>{children}</section>; }
function Summary({ value, label }: { value: number; label: string }) { return <div className="rounded-md border border-border bg-subtle/50 p-2"><strong className="block text-base">{value}</strong><span className="text-xs text-text-muted">{label}</span></div>; }
