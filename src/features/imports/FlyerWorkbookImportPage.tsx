import { AlertTriangle, ArrowLeft, Check, FileCheck2, Upload } from "lucide-react";
import { useMemo, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FlyerWorkbookImportAdapter,
  toApplyCampaignWorkbookImport,
  type FlyerWorkbookImportResult,
  type FlyerWorkbookReviewRow,
} from "../../adapters/import/FlyerWorkbookImportAdapter";
import { Badge, Button, Card, DataState, Field, PageHeader, inputClass } from "../../components/ui";
import type { NewCampaignInput } from "../../domain/types";
import { validateCampaignDetails } from "../../domain/rules";
import { usePlatform } from "../../services/PlatformProvider";

const adapter = new FlyerWorkbookImportAdapter();
type CampaignFields = Pick<NewCampaignInput, "name" | "type" | "description" | "startDate" | "endDate" | "owner" | "supplier">;

export function FlyerWorkbookImportPage() {
  const navigate = useNavigate();
  const { data, loading, error, applyCampaignWorkbookImport } = usePlatform();
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<FlyerWorkbookImportResult>();
  const [campaign, setCampaign] = useState<CampaignFields>();
  const [parseError, setParseError] = useState("");
  const [applying, setApplying] = useState(false);
  const [confirmSkipped, setConfirmSkipped] = useState(false);
  const [rowFilter, setRowFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setResult(undefined); setCampaign(undefined); setParseError(""); setConfirmSkipped(false); setFileName(file?.name ?? "");
    if (!file || !data) return;
    if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) { setParseError("This importer accepts .xlsx workbooks only."); return; }
    try {
      const parsed = await adapter.parse(file, { snapshot: data });
      setResult(parsed); setCampaign(parsed.suggestedCampaign);
      if (data.campaignImports.some((item) => item.fingerprint === parsed.fingerprint)) setParseError("This exact workbook has already been applied.");
    } catch (cause) {
      setParseError(cause instanceof Error ? cause.message : "The workbook could not be parsed.");
    }
  };

  const readyRows = result?.rows.filter((row) => row.status === "ready") ?? [];
  const skippedRows = result?.rows.filter((row) => row.status !== "ready" && row.status !== "information") ?? [];
  const duplicateApplied = Boolean(result && data?.campaignImports.some((item) => item.fingerprint === result.fingerprint));
  const campaignErrors = campaign ? validateCampaignDetails(campaign) : [];
  const apply = async () => {
    if (!result || !campaign || !readyRows.length || result.fatal || duplicateApplied || campaignErrors.length || (skippedRows.length && !confirmSkipped)) return;
    setApplying(true); setParseError("");
    try {
      const applied = await applyCampaignWorkbookImport(toApplyCampaignWorkbookImport(result, campaign));
      navigate(result.placements.length ? `/campaigns/${applied.campaignId}/assign` : `/campaigns/${applied.campaignId}/products`);
    } catch (cause) {
      setParseError(cause instanceof Error ? cause.message : "The approved workbook could not be applied.");
    } finally {
      setApplying(false);
    }
  };

  const visibleRows = useMemo(() => result?.rows.filter((row) => {
    if (rowFilter !== "all" && row.status !== rowFilter) return false;
    if (storeFilter !== "all" && !row.allocations.some((allocation) => allocation.store.id === storeFilter)) return false;
    return true;
  }) ?? [], [result, rowFilter, storeFilter]);

  return <DataState loading={loading} error={error}>{!data ? null : <div className="space-y-5">
    <PageHeader eyebrow="Spreadsheet → Campaign" title="Import merchandising workbook" description="Known-format flyer and consolidated campaign-planning workbooks · Parse, review, then apply." actions={<Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold" to="/imports"><ArrowLeft className="h-4 w-4" />Imports</Link>} />
    <ImportProgress result={result} applying={applying} />
    {parseError && <div role="alert" className="rounded-md border border-error/30 bg-error-subtle p-3 text-sm text-error">{parseError}</div>}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-4">
        <Card><div className="flex items-center gap-2"><Upload className="h-4 w-4 text-primary" /><h2 className="font-semibold">Upload source workbook</h2></div><label className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border-strong bg-subtle px-4 text-center focus-within:ring-2 focus-within:ring-focus"><input className="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void upload(event)} /><span className="text-sm font-semibold">Choose Jeremy’s .xlsx workbook</span><span className="mt-1 text-xs text-text-muted">{fileName || "September flyer or consolidated campaign-planning format"}</span></label></Card>
        {result && campaign && <>
          <CampaignDetails campaign={campaign} setCampaign={setCampaign} errors={campaignErrors} />
          <ImportSummary result={result} />
          <div className="flex flex-wrap gap-2"><select aria-label="Row status filter" className={inputClass} value={rowFilter} onChange={(event) => setRowFilter(event.target.value)}><option value="all">All product rows</option><option value="ready">Ready</option><option value="unmatched">Unmatched</option><option value="duplicate">Duplicate</option><option value="invalid">Invalid</option><option value="information">Information only</option></select>{result.workbookKind === "campaign_planning" && <select aria-label="Store allocation filter" className={inputClass} value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)}><option value="all">All stores</option>{data.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select>}</div>
          <ProductReview rows={visibleRows} />
          {result.placements.length > 0 && <PlacementReview result={result} />}
        </>}
      </div>
      <ApprovalPanel result={result} campaignErrors={campaignErrors} duplicateApplied={duplicateApplied} applying={applying} confirmSkipped={confirmSkipped} setConfirmSkipped={setConfirmSkipped} apply={apply} />
    </div>
  </div>}</DataState>;
}

function ImportProgress({ result, applying }: { result?: FlyerWorkbookImportResult; applying: boolean }) {
  const active = applying ? 3 : result ? 2 : 0;
  return <ol aria-label="Import progress" className="grid grid-cols-4 gap-px overflow-hidden rounded-md border border-border bg-border">{["Upload", "Validate", "Review", "Apply"].map((step, index) => <li key={step} className="bg-surface p-3"><p className="text-[10px] font-semibold uppercase text-text-muted">Step {index + 1}</p><p className={`mt-1 text-sm font-semibold ${index <= active ? "text-primary" : "text-text-muted"}`}>{step}</p></li>)}</ol>;
}

function CampaignDetails({ campaign, setCampaign, errors }: { campaign: CampaignFields; setCampaign(value: CampaignFields): void; errors: string[] }) {
  const set = <K extends keyof CampaignFields>(key: K, value: CampaignFields[K]) => setCampaign({ ...campaign, [key]: value });
  return <Card><h2 className="font-semibold">Draft campaign details</h2><p className="mt-1 text-sm text-text-secondary">Dates inferred from a monthly flyer remain editable before Apply.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="Campaign name"><input className={inputClass} value={campaign.name} onChange={(event) => set("name", event.target.value)} /></Field><Field label="Owner"><input className={inputClass} value={campaign.owner} onChange={(event) => set("owner", event.target.value)} /></Field><Field label="Start date"><input type="date" className={inputClass} value={campaign.startDate} onChange={(event) => set("startDate", event.target.value)} /></Field><Field label="End date"><input type="date" className={inputClass} value={campaign.endDate} onChange={(event) => set("endDate", event.target.value)} /></Field><Field label="Supplier / partner"><input className={inputClass} value={campaign.supplier} onChange={(event) => set("supplier", event.target.value)} /></Field><Field label="Description"><input className={inputClass} value={campaign.description} onChange={(event) => set("description", event.target.value)} /></Field></div>{errors.length > 0 && <p className="mt-3 text-sm text-error">{errors.join(" ")}</p>}</Card>;
}

function ImportSummary({ result }: { result: FlyerWorkbookImportResult }) {
  const ready = result.rows.filter((row) => row.status === "ready").length;
  const unmatched = result.rows.filter((row) => row.status === "unmatched").length;
  const skipped = result.rows.filter((row) => ["duplicate", "invalid"].includes(row.status)).length;
  const stores = new Set(result.rows.flatMap((row) => row.allocations.map((allocation) => allocation.store.id))).size;
  const quantities = result.rows.reduce((sum, row) => sum + row.allocations.length, 0);
  return <Card><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Import review</h2><p className="text-sm text-text-secondary">{result.sourceFileName} · {result.sourceSheet} · {result.workbookKind === "flyer" ? "Flyer product workbook" : "Consolidated campaign-planning workbook"}</p></div><Badge tone={result.fatal ? "error" : unmatched || skipped ? "warning" : "success"}>{result.fatal ? "Unsupported" : `${ready} ready`}</Badge></div><dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6"><Metric label="Product rows" value={result.rows.filter((row) => row.status !== "information").length} /><Metric label="Matched" value={ready} /><Metric label="Unmatched" value={unmatched} /><Metric label="Skipped" value={skipped} /><Metric label="Stores" value={stores} /><Metric label="Quantities" value={quantities} /></dl></Card>;
}

function ProductReview({ rows }: { rows: FlyerWorkbookReviewRow[] }) {
  return <Card className="overflow-hidden p-0"><div className="border-b border-border p-4"><div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-primary" /><h2 className="font-semibold">Products and source metadata</h2></div></div>{rows.length ? <div className="max-h-[34rem] overflow-auto"><table className="min-w-[900px] w-full text-left text-sm"><thead className="sticky top-0 bg-subtle text-xs uppercase text-text-muted"><tr><th className="px-3 py-3">Row</th><th className="px-3 py-3">SKU / product</th><th className="px-3 py-3">Category / vendor</th><th className="px-3 py-3">Promotion</th><th className="px-3 py-3">Display</th><th className="px-3 py-3">Allocation</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.rowNumber}><td className="px-3 py-3">{row.rowNumber}</td><td className="px-3 py-3"><b>{row.sku || "—"}</b><span className="block text-xs text-text-muted">{row.productName}</span></td><td className="px-3 py-3">{row.source.category ?? "—"}<span className="block text-xs text-text-muted">{row.source.vendor ?? "—"}</span></td><td className="px-3 py-3">{row.source.salePrice !== undefined ? `$${row.source.salePrice.toFixed(2)}` : "—"}<span className="block text-xs text-text-muted">{row.source.ltoCode ?? row.source.wholesaleLtoAmount ?? row.source.loyaltyPointsMultiplier ? [row.source.ltoCode, row.source.wholesaleLtoAmount !== undefined ? `$${row.source.wholesaleLtoAmount} LTO` : "", row.source.loyaltyPointsMultiplier ? `${row.source.loyaltyPointsMultiplier}x points` : ""].filter(Boolean).join(" · ") : "Metadata only"}</span></td><td className="px-3 py-3">{row.displayLocalCode ?? (row.displayRequired ? "Required, unassigned" : "Shelf")}</td><td className="px-3 py-3">{row.allocations.length ? `${row.allocations.length} stores · ${row.allocations.reduce((sum, item) => sum + item.quantityCases, 0)} cases` : "—"}</td><td className="px-3 py-3"><Badge tone={row.status === "ready" ? "success" : row.status === "information" ? "info" : "warning"}>{row.status.replace("_", " ")}</Badge>{row.issues.map((issue) => <span key={`${issue.code}-${issue.field}`} className="mt-1 block max-w-64 text-xs text-text-muted">{issue.message}</span>)}</td></tr>)}</tbody></table></div> : <p className="p-4 text-sm text-text-muted">No rows match these filters.</p>}</Card>;
}

function PlacementReview({ result }: { result: FlyerWorkbookImportResult }) {
  const grouped = result.placements.reduce<Map<string, typeof result.placements>>((map, placement) => map.set(placement.store.id, [...(map.get(placement.store.id) ?? []), placement]), new Map());
  return <div className="space-y-3"><div><h2 className="font-semibold">Store placement preview</h2><p className="text-sm text-text-secondary">Exact codes map automatically. Missing areas remain store-specific exceptions.</p></div>{[...grouped.values()].map((placements) => { const store = placements[0].store; const exceptions = placements.filter((item) => item.status === "SUGGESTED" || item.status === "NEEDS_REVIEW").length; return <Card key={store.id}><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{store.name}</h3><Badge tone={exceptions ? "warning" : "success"}>{exceptions ? `${exceptions} exceptions` : "All mapped"}</Badge></div><div className="mt-3 grid gap-2">{placements.map((placement) => <div key={placement.displayLocalCode} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-3 text-sm"><span><b>{placement.displayLocalCode}</b> · {placement.productCount} SKUs · {placement.caseQuantity} cases<span className="block text-xs text-text-muted">{placement.displayArea ? `Mapped to ${placement.displayArea.code}` : placement.suggestion ? `Suggested ${placement.suggestion.code}` : placement.reasons.join(" ")}</span></span><Badge tone={placement.status === "ASSIGNED" || placement.status === "EXCLUDED" ? "success" : "warning"}>{placement.status.replace("_", " ")}</Badge></div>)}</div></Card>; })}</div>;
}

function ApprovalPanel({ result, campaignErrors, duplicateApplied, applying, confirmSkipped, setConfirmSkipped, apply }: { result?: FlyerWorkbookImportResult; campaignErrors: string[]; duplicateApplied: boolean; applying: boolean; confirmSkipped: boolean; setConfirmSkipped(value: boolean): void; apply(): Promise<void> }) {
  const ready = result?.rows.filter((row) => row.status === "ready").length ?? 0;
  const skipped = result?.rows.filter((row) => !["ready", "information"].includes(row.status)).length ?? 0;
  const disabled = !result || result.fatal || !ready || duplicateApplied || campaignErrors.length > 0 || (skipped > 0 && !confirmSkipped) || applying;
  return <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start"><Card><h2 className="font-semibold">Supported source fields</h2><p className="mt-2 text-sm leading-5 text-text-secondary">Flyer pricing and promotion metadata, or consolidated SKU/store case allocations with an optional Display Area column.</p><p className="mt-3 text-xs leading-5 text-text-muted">SKU is authoritative. Product names are supporting evidence. Blank store cells mean zero. Display codes resolve within each store.</p></Card>{result && <Card><h2 className="font-semibold">Apply draft campaign</h2><dl className="mt-3 space-y-2 text-sm"><MetricInline label="Ready products" value={ready} /><MetricInline label="Rows skipped" value={skipped} /><MetricInline label="Exact placements" value={result.placements.filter((item) => item.status === "ASSIGNED").length} /><MetricInline label="Placement exceptions" value={result.placements.filter((item) => ["SUGGESTED", "NEEDS_REVIEW"].includes(item.status)).length} /></dl>{skipped > 0 && <label className="mt-4 flex gap-2 rounded border border-warning/30 bg-warning-subtle p-3 text-xs leading-5 text-warning"><input type="checkbox" checked={confirmSkipped} onChange={(event) => setConfirmSkipped(event.target.checked)} /><span>I reviewed the {skipped} unresolved or duplicate rows. Apply only the matched rows and retain the skipped rows in this review.</span></label>}{duplicateApplied && <p className="mt-4 text-sm text-error">This fingerprint was already applied.</p>}<Button className="mt-4 w-full" disabled={disabled} onClick={() => void apply()}><Check className="h-4 w-4" />{applying ? "Applying…" : "Apply and create draft campaign"}</Button><p className="mt-3 text-xs leading-5 text-text-muted">Apply is transactional. It does not publish the campaign.</p></Card>}{result?.issues.length ? <Card><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /><h2 className="font-semibold">Review notes</h2></div><p className="mt-2 text-sm text-text-secondary">{result.issues.length} warnings or row issues are preserved with source provenance.</p></Card> : null}</aside>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded bg-subtle p-3"><dt className="text-xs text-text-muted">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>; }
function MetricInline({ label, value }: { label: string; value: number }) { return <div className="flex justify-between gap-3"><dt className="text-text-muted">{label}</dt><dd className="font-semibold">{value}</dd></div>; }
