import { Check, FileSpreadsheet, Pencil, Upload, X } from "lucide-react";
import { useState, type ChangeEvent, type ReactNode } from "react";
import { CampaignProductImportAdapter, CAMPAIGN_PRODUCT_IMPORT_HEADERS, type CampaignProductImportResult, type CampaignProductImportRow } from "../../adapters/import/CampaignProductImportAdapter";
import type { ApplyCampaignProductImportInput, CreatePendingProductInput } from "../../domain/repositories";
import type { CampaignProduct, Product } from "../../domain/types";
import { Badge, Button, Card, inputClass } from "../../components/ui";

const adapter = new CampaignProductImportAdapter();

interface Props {
  products: Product[];
  assortment: CampaignProduct[];
  onCreatePendingProduct(input: CreatePendingProductInput): Promise<Product>;
  onApply(products: ApplyCampaignProductImportInput["products"]): Promise<void>;
  onClose(): void;
}

export function CampaignProductImportDialog({ products, assortment, onCreatePendingProduct, onApply, onClose }: Props) {
  const [result, setResult] = useState<CampaignProductImportResult>();
  const [fileName, setFileName] = useState("");
  const [omitted, setOmitted] = useState<Set<number>>(new Set());
  const [resolved, setResolved] = useState<Map<number, Product>>(new Map());
  const [editing, setEditing] = useState<CampaignProductImportRow>();
  const [resolving, setResolving] = useState<CampaignProductImportRow>();
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setResult(undefined); setOmitted(new Set()); setResolved(new Map()); setError(""); setFileName(file?.name ?? "");
    if (!file) return;
    if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) { setError("This import accepts .xlsx workbooks only."); return; }
    try { setResult(await adapter.parse(file, { products, campaignProducts: assortment })); } catch (cause) { setError(cause instanceof Error ? cause.message : "The workbook could not be parsed."); }
  };

  const apply = async () => {
    if (!result) return;
    const entries = result.rows.flatMap((row) => {
      if (omitted.has(row.rowNumber)) return [];
      const product = row.status === "matched" ? row.product : resolved.get(row.rowNumber);
      return product && row.role !== undefined && row.required !== undefined ? [{ productId: product.id, role: row.role, required: row.required, note: row.note }] : [];
    });
    setApplying(true); setError("");
    try { await onApply(entries); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Approved products could not be applied."); } finally { setApplying(false); }
  };

  const correct = (row: CampaignProductImportRow, values: string[]) => {
    if (!result) return;
    const sourceRows = result.sourceRows.map((cells, index) => index === row.rowNumber - 1 ? values : [...cells]);
    setResult(adapter.parseRows(sourceRows, { products, campaignProducts: assortment }));
    setEditing(undefined);
  };

  const activeRows = result?.rows.filter((row) => !omitted.has(row.rowNumber)) ?? [];
  const unresolved = activeRows.filter((row) => row.status === "pending" && !resolved.has(row.rowNumber));
  const invalid = activeRows.filter((row) => row.status === "invalid");
  const eligible = activeRows.filter((row) => row.status === "matched" || (row.status === "pending" && resolved.has(row.rowNumber)));

  if (editing) return <CorrectRowDialog row={editing} onSave={(values) => correct(editing, values)} onClose={() => setEditing(undefined)} />;
  if (resolving) return <ResolvePendingDialog row={resolving} onCreate={async (input) => { const product = await onCreatePendingProduct(input); setResolved((current) => new Map(current).set(resolving.rowNumber, product)); setResolving(undefined); }} onClose={() => setResolving(undefined)} />;

  return <Dialog title="Upload campaign products" description="Known-format campaign product import · .xlsx only" onClose={onClose}>
    <div className="space-y-5 p-5">
      <Progress parsed={Boolean(result)} ready={Boolean(result && !unresolved.length && !invalid.length)} />
      {error && <div role="alert" className="rounded-md border border-error/30 bg-error-subtle p-3 text-sm text-error">{error}</div>}
      {!result ? <><Card><label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border-strong bg-subtle px-4 text-center"><input className="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void upload(event)} /><Upload className="h-5 w-5 text-primary" /><span className="mt-2 text-sm font-semibold">Choose campaign product workbook</span><span className="mt-1 text-xs text-text-muted">{fileName || ".xlsx only"}</span></label></Card><FormatCard /></> : <>
        <Summary rows={result.rows} omitted={omitted} resolved={resolved} />
        <div className="max-h-[45vh] space-y-3 overflow-y-auto">{result.rows.map((row) => <ImportRow key={row.rowNumber} row={row} omitted={omitted.has(row.rowNumber)} resolved={resolved.has(row.rowNumber)} onOmit={() => setOmitted((current) => new Set(current).add(row.rowNumber))} onEdit={() => setEditing(row)} onResolve={() => setResolving(row)} />)}</div>
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" disabled={!eligible.length || unresolved.length > 0 || invalid.length > 0 || applying} onClick={() => void apply()}><Check className="h-4 w-4" />{applying ? "Applying..." : "Apply approved products"}</Button></div>
      </>}
    </div>
  </Dialog>;
}

function Progress({ parsed, ready }: { parsed: boolean; ready: boolean }) {
  const active = ready ? 4 : parsed ? 2 : 0;
  return <ol aria-label="Campaign product import progress" className="grid grid-cols-5 gap-px overflow-hidden rounded-md border border-border bg-border">{["Upload", "Validate", "Review", "Resolve", "Apply"].map((step, index) => <li key={step} className="bg-surface p-2"><p className={`text-xs font-semibold ${index <= active ? "text-primary" : "text-text-muted"}`}>{step}</p></li>)}</ol>;
}

function FormatCard() { return <Card><div className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" /><h3 className="font-semibold">Supported format</h3></div><p className="mt-2 text-sm text-text-secondary">Product details are resolved from Product Master by SKU.</p><p className="mt-3 font-mono text-sm">{CAMPAIGN_PRODUCT_IMPORT_HEADERS.join(" | ")}</p></Card>; }

function Dialog({ title, description, children, onClose }: { title: string; description: string; children: ReactNode; onClose(): void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-overlay p-0 sm:items-center sm:p-6" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="campaign-product-import-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-md border border-border bg-surface shadow-xl sm:rounded-md"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4"><div><h2 id="campaign-product-import-title" className="font-semibold">{title}</h2><p className="mt-1 text-sm text-text-muted">{description}</p></div><button type="button" aria-label="Close" className="grid h-9 w-9 place-items-center rounded-md hover:bg-subtle" onClick={onClose}><X className="h-4 w-4" /></button></header>{children}</section></div>;
}

function Summary({ rows, omitted, resolved }: { rows: CampaignProductImportRow[]; omitted: Set<number>; resolved: Map<number, Product> }) {
  const active = rows.filter((row) => !omitted.has(row.rowNumber));
  const counts = [["Matched", active.filter((row) => row.status === "matched").length], ["Duplicate", active.filter((row) => row.status === "duplicate").length], ["Pending new", active.filter((row) => row.status === "pending" && !resolved.has(row.rowNumber)).length], ["Invalid", active.filter((row) => row.status === "invalid").length]];
  return <div className="grid gap-2 rounded-md border border-border bg-subtle/40 p-3 text-sm sm:grid-cols-4">{counts.map(([label, value]) => <div key={label as string}><p className="text-xs text-text-muted">{label}</p><p className="font-semibold">{value}</p></div>)}</div>;
}

function ImportRow({ row, omitted, resolved, onOmit, onEdit, onResolve }: { row: CampaignProductImportRow; omitted: boolean; resolved: boolean; onOmit(): void; onEdit(): void; onResolve(): void }) {
  return <Card className={omitted ? "opacity-50" : ""}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">Row {row.rowNumber} · {row.sku || "Blank SKU"}</p><Badge tone={row.status === "matched" ? "success" : row.status === "invalid" ? "error" : "warning"}>{omitted ? "Omitted" : resolved ? "Pending resolved" : row.status === "pending" ? "Pending new" : row.status}</Badge></div><p className="mt-1 text-sm text-text-secondary">{row.product?.name ?? row.note ?? "No Product Master match"}</p>{row.issues.map((issue) => <p key={issue.code} className="mt-1 text-xs text-error">{issue.message}</p>)}</div>{!omitted && <div className="flex gap-2">{row.status === "pending" && !resolved && <Button type="button" variant="secondary" onClick={onResolve}>Resolve pending</Button>}{row.status === "invalid" && <Button type="button" variant="secondary" aria-label={`Correct row ${row.rowNumber}`} onClick={onEdit}><Pencil className="h-4 w-4" />Correct</Button>}{(row.status === "invalid" || row.status === "pending") && <Button type="button" variant="secondary" aria-label={`Omit row ${row.rowNumber}`} onClick={onOmit}>Omit</Button>}</div>}</div></Card>;
}

function CorrectRowDialog({ row, onSave, onClose }: { row: CampaignProductImportRow; onSave(values: string[]): void; onClose(): void }) {
  const [sku, setSku] = useState(row.sku); const [role, setRole] = useState<string>(row.role ?? "Supporting"); const [required, setRequired] = useState(row.required === false ? "No" : "Yes"); const [note, setNote] = useState(row.note ?? "");
  return <Dialog title={`Correct row ${row.rowNumber}`} description="Correct the campaign-product fields and validate again." onClose={onClose}><form className="space-y-4 p-5" onSubmit={(event) => { event.preventDefault(); onSave([sku, role, required, note]); }}><label className="block text-sm font-medium">SKU<input aria-label="Corrected SKU" className={`${inputClass} mt-1`} value={sku} onChange={(event) => setSku(event.target.value)} /></label><label className="block text-sm font-medium">Role<select aria-label="Corrected role" className={`${inputClass} mt-1`} value={role} onChange={(event) => setRole(event.target.value)}>{["Feature", "Core", "Supporting", "Optional"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="block text-sm font-medium">Required<select aria-label="Corrected required" className={`${inputClass} mt-1`} value={required} onChange={(event) => setRequired(event.target.value)}><option>Yes</option><option>No</option></select></label><label className="block text-sm font-medium">Notes<textarea aria-label="Corrected notes" className={`${inputClass} mt-1 min-h-20 py-2`} value={note} onChange={(event) => setNote(event.target.value)} /></label><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button>Validate correction</Button></div></form></Dialog>;
}

function ResolvePendingDialog({ row, onCreate, onClose }: { row: CampaignProductImportRow; onCreate(input: CreatePendingProductInput): Promise<void>; onClose(): void }) {
  const [name, setName] = useState(""); const [category, setCategory] = useState(""); const [error, setError] = useState("");
  return <Dialog title="Resolve pending product" description="Create a pending Product Master record for this valid, unknown SKU." onClose={onClose}><form className="space-y-4 p-5" onSubmit={(event) => { event.preventDefault(); void onCreate({ sku: row.sku, name, category }).catch((cause) => setError(cause instanceof Error ? cause.message : "Pending product could not be created.")); }}><label className="block text-sm font-medium">SKU<input aria-label="Pending import SKU" className={`${inputClass} mt-1`} value={row.sku} readOnly /></label><label className="block text-sm font-medium">Product name<input aria-label="Pending import product name" className={`${inputClass} mt-1`} value={name} onChange={(event) => setName(event.target.value)} required /></label><label className="block text-sm font-medium">Category<input aria-label="Pending import category" className={`${inputClass} mt-1`} value={category} onChange={(event) => setCategory(event.target.value)} required /></label>{error && <div role="alert" className="text-sm text-error">{error}</div>}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button>Create pending product</Button></div></form></Dialog>;
}
