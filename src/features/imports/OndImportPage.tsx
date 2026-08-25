import { AlertTriangle, ArrowLeft, Check, FileCheck2, Upload } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { CascadiaOndAllocationImportAdapter, CASCADIA_OND_HEADERS, type CascadiaOndImportResult } from "../../adapters/import/CascadiaOndAllocationImportAdapter";
import { Badge, Button, Card, DataState, EmptyState, PageHeader } from "../../components/ui";
import { usePlatform } from "../../services/PlatformProvider";

const adapter = new CascadiaOndAllocationImportAdapter();

export function OndImportPage() {
  const { programId } = useParams();
  const { data, loading, error, applyOndImport } = usePlatform();
  const program = data?.programs.find((item) => item.id === programId);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<CascadiaOndImportResult>();
  const [parseError, setParseError] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setResult(undefined); setApplied(false); setParseError(""); setFileName(file?.name ?? "");
    if (!file || !data || !programId) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) { setParseError("This adapter accepts .xlsx workbooks only."); return; }
    try { setResult(await adapter.parse(file, { programId, snapshot: data })); }
    catch (cause) { setParseError(cause instanceof Error ? cause.message : "The workbook could not be parsed."); }
  };
  const approve = async () => {
    if (!result || result.issues.length) return;
    setApplying(true); setParseError("");
    try { await applyOndImport(result.batch); setApplied(true); }
    catch (cause) { setParseError(cause instanceof Error ? cause.message : "The approved import could not be applied."); }
    finally { setApplying(false); }
  };

  return <DataState loading={loading} error={error}>{!program || !data ? <EmptyState title="Program not found" message="Select an existing program before importing allocations." /> : <>
    <PageHeader eyebrow="Known-format import" title={`${program.name} legacy allocation import`} description="Cascadia OND allocation workbook v1 · Mock repository only" actions={<Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold" to={`/programs/${program.id}`}><ArrowLeft className="h-4 w-4" />Program workspace</Link>} />
    <ol aria-label="Import progress" className="grid grid-cols-4 gap-px overflow-hidden rounded-md border border-border bg-border">{["Upload", "Validate", "Review", "Approve"].map((step, index) => { const active = applied ? 4 : result ? 3 : fileName ? 1 : 0; return <li key={step} className="bg-surface p-3"><p className="text-[10px] font-semibold uppercase text-text-muted">Step {index + 1}</p><p className={`mt-1 text-sm font-semibold ${index < active ? "text-success" : index === active ? "text-primary" : "text-text-muted"}`}>{step}</p></li>; })}</ol>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <Card><div className="flex items-center gap-2"><Upload className="h-4 w-4 text-primary" /><h2 className="font-semibold">Upload workbook</h2></div><label className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border-strong bg-subtle px-4 text-center focus-within:ring-2 focus-within:ring-focus"><input className="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void upload(event)} /><span className="text-sm font-semibold">Choose OND allocation workbook</span><span className="mt-1 text-xs text-text-muted">{fileName || ".xlsx only"}</span></label></Card>
        {parseError && <div role="alert" className="rounded-md border border-error/20 bg-error-subtle p-3 text-sm text-error">{parseError}</div>}
        {result && <ImportReview result={result} />}
      </div>
      <aside className="space-y-4"><Card><h2 className="text-sm font-semibold">Required columns</h2><ol className="mt-3 space-y-1 text-xs text-text-secondary">{CASCADIA_OND_HEADERS.map((header, index) => <li key={header}>{index + 1}. {header}</li>)}</ol><p className="mt-3 text-xs leading-5 text-text-muted">Headers and order must match exactly. Annotated Word floorplans are not imported.</p></Card>{result && <Card><h2 className="text-sm font-semibold">Approval</h2><dl className="mt-3 space-y-2 text-sm"><Summary label="Rows" value={result.rows.length} /><Summary label="Assignments" value={result.batch.assignments.length} /><Summary label="Products" value={result.batch.assignments.reduce((sum, item) => sum + item.products.length, 0)} /><Summary label="Issues" value={result.issues.length} /></dl>{result.issues.length > 0 ? <p className="mt-4 text-xs leading-5 text-error">Correct every flagged row in the workbook and upload it again. No ambiguous rows will be written.</p> : <Button className="mt-4 w-full" disabled={applying || applied} onClick={() => void approve()}><Check className="h-4 w-4" />{applied ? "Import applied" : applying ? "Applying..." : "Approve import"}</Button>}{applied && <Link className="mt-3 inline-flex text-sm font-semibold text-primary" to={`/programs/${program.id}/allocations`}>Open imported allocations</Link>}</Card>}</aside>
    </div>
  </>}</DataState>;
}

function ImportReview({ result }: { result: CascadiaOndImportResult }) {
  const ready = result.rows.filter((row) => row.status === "ready").length;
  const review = result.rows.filter((row) => row.status === "review").length;
  const errors = result.rows.filter((row) => row.status === "error").length;
  return <Card className="overflow-hidden p-0"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-primary" /><h2 className="font-semibold">Import review</h2></div><div className="flex gap-2"><Badge tone="success">{ready} ready</Badge><Badge tone="warning">{review} review</Badge><Badge tone="error">{errors} errors</Badge></div></div>{result.rows.length ? <div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left text-sm"><thead className="bg-subtle text-xs uppercase text-text-muted"><tr><th className="px-3 py-3">Row</th><th className="px-3 py-3">Store</th><th className="px-3 py-3">Display</th><th className="px-3 py-3">SKU / product</th><th className="px-3 py-3">Cases</th><th className="px-3 py-3">Vendor</th><th className="px-3 py-3">Dates / reset</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-border">{result.rows.map((row) => <tr key={row.rowNumber}><td className="px-3 py-3">{row.rowNumber}</td><td className="px-3 py-3">{row.store}</td><td className="px-3 py-3">{row.displayNumber}</td><td className="px-3 py-3"><p className="font-medium">{row.sku}</p><p className="text-xs text-text-muted">{row.product}</p></td><td className="px-3 py-3">{row.caseQuantity ?? "-"}</td><td className="px-3 py-3">{row.vendor}</td><td className="px-3 py-3"><p>{row.startDate ?? "?"} - {row.endDate ?? "?"}</p><p className="text-xs text-text-muted">Reset {row.resetDate ?? "not structured"}</p></td><td className="px-3 py-3"><Badge tone={row.status === "ready" ? "success" : row.status === "review" ? "warning" : "error"}>{row.status}</Badge></td></tr>)}</tbody></table></div> : <div className="p-4 text-sm text-text-muted">No rows could be reviewed.</div>}{result.issues.length > 0 && <div className="border-t border-border p-4"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-error" /><h3 className="text-sm font-semibold">Flagged issues</h3></div><ul className="mt-3 space-y-2">{result.issues.map((issue, index) => <li key={`${issue.row}-${issue.code}-${index}`} className="text-xs leading-5 text-text-secondary"><Badge tone={issue.severity === "error" ? "error" : "warning"}>Row {issue.row} · {issue.field}</Badge><span className="ml-2">{issue.message}</span></li>)}</ul></div>}</Card>;
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="flex items-center justify-between gap-3"><dt className="text-text-muted">{label}</dt><dd className="font-semibold">{value}</dd></div>; }
