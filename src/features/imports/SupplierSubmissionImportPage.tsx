import { AlertTriangle, Check, FileSpreadsheet, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SupplierSubmissionImportAdapter, toApplySupplierSubmissionImport, type SupplierSubmissionImportResult } from "../../adapters/import/SupplierSubmissionImportAdapter";
import { Badge, Button, Card, DataState, Field, PageHeader, inputClass } from "../../components/ui";
import { usePlatform } from "../../services/PlatformProvider";

const adapter = new SupplierSubmissionImportAdapter();

export function SupplierSubmissionImportPage() {
  const { loading, error, productMaster, applySupplierSubmissionImport } = usePlatform();
  const navigate = useNavigate();
  const [result, setResult] = useState<SupplierSubmissionImportResult>();
  const [parseError, setParseError] = useState<string>();
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [filters, setFilters] = useState({ supplier: "", category: "", status: "", month: "", flyer: "", display: "" });
  const rows = useMemo(() => (result?.rows ?? []).filter((row) => {
    const opportunity = row.opportunity;
    return (!filters.supplier || opportunity.supplier.toLocaleLowerCase().includes(filters.supplier.toLocaleLowerCase()))
      && (!filters.category || (opportunity.authoritativeCategory ?? opportunity.supplierCategory ?? "").toLocaleLowerCase().includes(filters.category.toLocaleLowerCase()))
      && (!filters.status || row.status === filters.status)
      && (!filters.month || [opportunity.proposedStartDate, opportunity.proposedEndDate, opportunity.promotionEvidence.flyerRequest].some((value) => value?.toLocaleLowerCase().includes(filters.month.toLocaleLowerCase())))
      && (!filters.flyer || String(Boolean(opportunity.promotionEvidence.flyerRequest)) === filters.flyer)
      && (!filters.display || String(Boolean(opportunity.merchandisingRequest.displayRequested)) === filters.display);
  }), [filters, result]);

  async function parse(file?: File) {
    if (!file) return;
    setParsing(true); setParseError(undefined); setResult(undefined); setConfirmed(false);
    try { setResult(await adapter.parse(file, { productMaster })); }
    catch (cause) { setParseError(cause instanceof Error ? cause.message : "The supplier workbook could not be read."); }
    finally { setParsing(false); }
  }

  async function apply() {
    if (!result) return;
    setApplying(true); setParseError(undefined);
    try {
      await applySupplierSubmissionImport(toApplySupplierSubmissionImport(result));
      navigate("/opportunities");
    } catch (cause) { setParseError(cause instanceof Error ? cause.message : "The supplier submission could not be applied."); }
    finally { setApplying(false); }
  }

  const needsReview = result?.rows.filter((row) => row.status === "needs_review").length ?? 0;
  const eligible = result?.rows.filter((row) => row.status === "ready" && row.product).length ?? 0;
  return <DataState loading={loading} error={error}>
    <PageHeader eyebrow="Supplier intake" title="Import supplier submission" description="Parse a known Cascadia XLSX template, reconcile exact SKUs, then review every opportunity before Apply." actions={<Badge tone="info">Local prototype persistence</Badge>} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-5">
        <Card>
          <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border-strong bg-subtle p-6 text-center">
            <UploadCloud className="h-7 w-7 text-primary" /><span className="mt-2 text-sm font-semibold">Choose supplier submission workbook</span>
            <span className="mt-1 text-xs text-text-muted">XLSX using SupplierSubmissionImportV1</span>
            <input className="sr-only" type="file" accept=".xlsx" disabled={parsing} onChange={(event) => void parse(event.target.files?.[0])} />
          </label>
          {parsing && <p role="status" className="mt-3 text-sm text-text-secondary">Parsing workbook and reconciling exact SKUs…</p>}
          {parseError && <p role="alert" className="mt-3 rounded bg-error-subtle p-3 text-sm text-error">{parseError}</p>}
        </Card>

        {result && <>
          <Card>
            <div className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" /><h2 className="font-semibold">Submission</h2></div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Supplier" value={result.supplier || "Missing"} /><Metric label="Source" value={`${result.sourceFileName} · ${result.sourceSheet}`} />
              <Metric label="Proposed period" value={result.proposedStartDate ? `${result.proposedStartDate} – ${result.proposedEndDate ?? "open"}` : "Not supplied"} />
              <Metric label="Rows" value={`${result.rows.length} source · ${eligible} eligible · ${needsReview} skipped`} />
            </dl>
          </Card>
          <Card>
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Field label="Supplier"><input className={inputClass} value={filters.supplier} onChange={(event) => setFilters({ ...filters, supplier: event.target.value })} /></Field>
              <Field label="Category"><input className={inputClass} value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })} /></Field>
              <Field label="Review status"><select className={inputClass} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All</option><option value="ready">Ready</option><option value="needs_review">Needs review</option></select></Field>
              <Field label="Promotion month"><input className={inputClass} placeholder="2026-10" value={filters.month} onChange={(event) => setFilters({ ...filters, month: event.target.value })} /></Field>
              <Field label="Flyer requested"><select className={inputClass} value={filters.flyer} onChange={(event) => setFilters({ ...filters, flyer: event.target.value })}><option value="">All</option><option value="true">Yes</option><option value="false">No</option></select></Field>
              <Field label="Display requested"><select className={inputClass} value={filters.display} onChange={(event) => setFilters({ ...filters, display: event.target.value })}><option value="">All</option><option value="true">Yes</option><option value="false">No</option></select></Field>
            </div>
          </Card>
          <Card className="overflow-hidden p-0">
            <div className="overflow-auto"><table className="min-w-[1200px] w-full text-left text-sm"><thead className="bg-subtle text-xs uppercase text-text-muted"><tr>{["Row", "SKU / authoritative product", "Supplier description", "Promotion", "LTO / TPR", "Retail", "Commitment", "Preorder", "Display", "Marketing", "Status / issues"].map((header) => <th key={header} className="px-3 py-3">{header}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">{rows.map((row) => { const item = row.opportunity; return <tr key={row.rowNumber}>
                <td className="px-3 py-3">{row.rowNumber}</td><td className="px-3 py-3"><b>{row.sku || "—"}</b><span className="block text-xs text-text-muted">{row.product ? `${row.product.name} · ${row.product.category}` : "No Product Master match"}</span></td>
                <td className="px-3 py-3">{row.productName || "—"}<span className="block text-xs text-text-muted">{item.supplierCategory ?? "—"}</span></td><td className="px-3 py-3">{item.proposedStartDate ?? "—"}<span className="block text-xs text-text-muted">{item.proposedEndDate ?? "—"} · {item.promotionEvidence.flyerRequest ?? "No flyer request"}</span></td>
                <td className="px-3 py-3">{item.promotionEvidence.wholesaleLto !== undefined ? `$${item.promotionEvidence.wholesaleLto}` : "—"}<span className="block text-xs text-text-muted">{item.promotionEvidence.tpr ?? "No TPR"}</span></td><td className="px-3 py-3">{item.promotionEvidence.proposedRetail !== undefined ? `$${item.promotionEvidence.proposedRetail}` : "—"}</td>
                <td className="px-3 py-3">{item.commercialTerms.caseCommitment ?? "—"}<span className="block text-xs text-text-muted">Min {item.commercialTerms.minimumOrder ?? "—"}</span></td><td className="px-3 py-3">{yesNo(item.commercialTerms.preorderRequired)}</td><td className="px-3 py-3">{yesNo(item.merchandisingRequest.displayRequested)}<span className="block text-xs text-text-muted">{item.merchandisingRequest.requestedDisplayFamily ?? "—"} · {item.merchandisingRequest.requestedDisplayCount ?? "—"}</span></td>
                <td className="px-3 py-3">{item.commercialTerms.marketingSupport ?? "—"}</td><td className="px-3 py-3"><Badge tone={row.status === "ready" ? "success" : "warning"}>{row.opportunityStatus.replaceAll("_", " ")}</Badge>{row.issues.map((issue) => <span key={issue.code} className="mt-1 block max-w-72 text-xs text-text-muted">{issue.message}</span>)}</td>
              </tr>; })}</tbody></table></div>
            {!rows.length && <p className="p-4 text-sm text-text-muted">No rows match these filters.</p>}
          </Card>
        </>}
      </div>
      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <Card><h2 className="font-semibold">Authority</h2><p className="mt-2 text-sm leading-5 text-text-secondary">Exact SKU links Product Master identity. Supplier names, categories, descriptions, and claims remain source evidence.</p></Card>
        {result && <Card><h2 className="font-semibold">Apply opportunities</h2><p className="mt-2 text-sm text-text-secondary">Creates one SupplierSubmission retaining all {result.rows.length} source rows and {eligible} eligible PromotionOpportunity records. It creates no campaign, placement, allocation, order, or execution data.</p>
          {needsReview > 0 && <label className="mt-4 flex gap-2 rounded border border-warning/30 bg-warning-subtle p-3 text-xs leading-5 text-warning"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I reviewed the {needsReview} issue rows. Skip them as actionable opportunities while retaining their source evidence.</span></label>}
          <Button className="mt-4 w-full" disabled={result.fatal || !result.rows.length || (needsReview > 0 && !confirmed) || applying} onClick={() => void apply()}><Check className="h-4 w-4" />{applying ? "Applying…" : "Apply supplier submission"}</Button>
          <p className="mt-3 text-xs text-text-muted">Apply is explicit and transactional. No campaign is created.</p>
        </Card>}
        {result?.issues.length ? <Card><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /><h2 className="font-semibold">Issues retained</h2></div><p className="mt-2 text-sm text-text-secondary">{result.issues.length} issues remain linked to their workbook rows.</p></Card> : null}
      </aside>
    </div>
  </DataState>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded bg-subtle p-3"><dt className="text-xs text-text-muted">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value}</dd></div>; }
function yesNo(value?: boolean) { return value === undefined ? "—" : value ? "Yes" : "No"; }
