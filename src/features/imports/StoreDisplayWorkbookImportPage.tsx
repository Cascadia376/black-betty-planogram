import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { StoreDisplayWorkbookImportAdapter, toApplyStoreDisplayWorkbookImport, type StoreDisplayWorkbookImportResult, type StoreDisplayWorkbookSheetMappings } from "../../adapters/import/StoreDisplayWorkbookImportAdapter";
import { Badge, Button, Card, DataState, Field, PageHeader, inputClass } from "../../components/ui";
import { usePlatform } from "../../services/PlatformProvider";

const adapter = new StoreDisplayWorkbookImportAdapter();

export function StoreDisplayWorkbookImportPage() {
  const location = useLocation(); const navigate = useNavigate();
  const handoff = location.state as { workbookFile?: File; sourceCampaignId?: string } | null;
  const consumedHandoff = useRef<string | undefined>(undefined);
  const { data, loading, error, productMaster, applyStoreDisplayWorkbook } = usePlatform();
  const [result, setResult] = useState<StoreDisplayWorkbookImportResult>();
  const [campaignId, setCampaignId] = useState("");
  const [file, setFile] = useState<File>();
  const [sheetMappings, setSheetMappings] = useState<StoreDisplayWorkbookSheetMappings>({});
  const [message, setMessage] = useState("");
  const [completedCampaignId, setCompletedCampaignId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const upload = useCallback(async (nextFile?: File, nextMappings: StoreDisplayWorkbookSheetMappings = {}) => {
    if (!nextFile || !data) return;
    setBusy(true); setMessage(""); setCompletedCampaignId(undefined); setResult(undefined);
    try { setResult(await adapter.parse(nextFile, { snapshot: data, productMaster }, nextMappings)); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to parse the store display workbook."); }
    finally { setBusy(false); }
  }, [data, productMaster]);
  useEffect(() => {
    if (!data || !(handoff?.workbookFile instanceof File) || consumedHandoff.current === location.key) return;
    consumedHandoff.current = location.key;
    setFile(handoff.workbookFile);
    setSheetMappings({});
    setCampaignId(handoff.sourceCampaignId ?? "");
    void upload(handoff.workbookFile);
    navigate(location.pathname, { replace: true, state: null });
  }, [data, handoff, location.key, location.pathname, navigate, upload]);
  if (!data) return null;
  const counts = result ? {
    ready: result.rows.filter((row) => row.status === "ready").length,
    pending: result.rows.filter((row) => row.productResolution === "PENDING").length,
    inactive: result.rows.filter((row) => row.productResolution === "MATCHED_INACTIVE").length,
    unresolved: result.rows.filter((row) => row.displayInterpretation === "UNRESOLVED").length,
    invalid: result.rows.filter((row) => row.status === "invalid").length,
    noteConflicts: result.displayNotes.filter((note) => note.hasConflict).length,
    temporaryMarkers: result.rows.filter((row) => row.temporaryDisplayMarker).length,
  } : undefined;
  const unmappedSheets = result?.sheetNames.filter((sheet) => result.rows.some((row) => row.sheet === sheet && !row.store)) ?? [];
  const setSheetMapping = (sheet: string, storeId: string) => {
    if (!file) return;
    const nextMappings = { ...sheetMappings, [sheet]: storeId };
    setSheetMappings(nextMappings);
    void upload(file, nextMappings);
  };
  const apply = async () => {
    if (!result || !campaignId) return;
    setBusy(true); setMessage(""); setCompletedCampaignId(undefined);
    try { await applyStoreDisplayWorkbook(toApplyStoreDisplayWorkbookImport(result, campaignId)); setMessage("Store display workbook saved to the shared campaign plan."); setCompletedCampaignId(campaignId); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to save the store display workbook."); }
    finally { setBusy(false); }
  };
  return <DataState loading={loading} error={error}><div className="space-y-5"><PageHeader eyebrow="Workbook → campaign" title="Import store display workbook" description="One worksheet per store. This format is detected automatically from the standard workbook upload." actions={<Link className="rounded border border-border px-3 py-2 text-sm font-semibold" to="/imports">Imports</Link>} />
    {message && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded border border-success/30 bg-success-subtle p-3 text-sm"><p>{message}</p>{completedCampaignId && <Link className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 font-semibold text-primary-foreground" to={`/campaigns/${completedCampaignId}/display`}>Review campaign displays</Link>}</div>}
    <Card><label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded border border-dashed border-border-strong bg-subtle"><input className="sr-only" type="file" accept=".xlsx" onChange={(event) => { const nextFile = event.target.files?.[0]; setFile(nextFile); setSheetMappings({}); void upload(nextFile); }} /><b>{busy ? "Reading workbook…" : "Choose OND store-display .xlsx workbook"}</b><span className="mt-1 text-xs text-text-muted">Unknown sheet names remain in review and never create stores.</span></label></Card>
    {result && counts && <><Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Import review</h2><p className="text-sm text-text-secondary">Sheets: {result.sheetNames.join(", ")}</p></div><div className="flex flex-wrap gap-2"><Badge tone="success">{counts.ready} ready</Badge><Badge tone="warning">{counts.pending} pending product</Badge><Badge tone="warning">{counts.unresolved} unresolved display</Badge><Badge tone="warning">{counts.invalid} invalid</Badge><Badge tone={counts.noteConflicts ? "error" : "neutral"}>{counts.noteConflicts} conflicting notes</Badge></div></div><p className="mt-3 text-sm text-text-secondary">{counts.inactive} exact inactive Product Master matches are retained for review. Raw <b>N</b> is never converted to shelf support or no-display.</p></Card>
      {unmappedSheets.length > 0 && <Card><h2 className="font-semibold">Map worksheet to canonical store</h2><p className="mt-1 text-sm text-text-secondary">This is an explicit buyer review decision. The workbook filename is never used to identify a store.</p>{unmappedSheets.map((sheet) => <div key={sheet} className="mt-3"><Field label={sheet}><select aria-label={`Map ${sheet} to store`} className={inputClass} value={sheetMappings[sheet] ?? ""} onChange={(event) => setSheetMapping(sheet, event.target.value)}><option value="">Choose canonical store…</option>{data.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></Field></div>)}</Card>}
      <Card><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"><Field label="Apply to shared campaign"><select aria-label="Campaign" className={inputClass} value={campaignId} onChange={(event) => setCampaignId(event.target.value)}><option value="">Choose a draft campaign…</option>{data.campaigns.filter((campaign) => campaign.status === "draft").map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></Field><Button disabled={!campaignId || busy || counts.temporaryMarkers > 0 || !result.rows.some((row) => row.store && row.status !== "invalid")} onClick={() => void apply()}>Apply store display plan</Button></div><p className="mt-2 text-xs text-text-muted">{counts.temporaryMarkers ? `${counts.temporaryMarkers} temporary N source marker${counts.temporaryMarkers === 1 ? " blocks" : "s block"} Apply. Replace or remove them in the workbook and re-import.` : "Invalid and unknown-store rows remain in the imported review record; applicable pending products are retained as campaign-only planning products."}</p></Card>
      <Card className="overflow-hidden p-0"><div className="border-b border-border p-4"><h2 className="font-semibold">Rows retained for review</h2></div><div className="max-h-[34rem] overflow-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="sticky top-0 bg-subtle text-xs uppercase text-text-muted"><tr><th className="p-3">Sheet / row</th><th className="p-3">Store</th><th className="p-3">SKU / product</th><th className="p-3">Product state</th><th className="p-3">Source display</th><th className="p-3">Physical display</th><th className="p-3">Cases</th><th className="p-3">Display notes</th></tr></thead><tbody>{result.rows.map((row) => <tr key={`${row.sheet}-${row.rowNumber}`} className="border-t border-border"><td className="p-3">{row.sheet} · {row.rowNumber}</td><td className="p-3">{row.store?.name ?? "Needs store mapping"}</td><td className="p-3"><b>{row.sku || "No INV_NUM"}</b><span className="block text-xs text-text-muted">{row.productName}</span></td><td className="p-3"><Badge tone={row.productResolution === "MATCHED_ACTIVE" ? "success" : "warning"}>{row.productResolution}</Badge></td><td className="p-3">{row.displaySourceValue || "Blank"}{row.temporaryDisplayMarker && <span className="ml-2 text-warning">temporary source marker — needs cleanup</span>}</td><td className="p-3">{row.displayArea ? `${row.displayArea.localCode ?? row.displayArea.displayNumber} · ${row.displayArea.name}` : row.displayLocalCode ? `${row.displayLocalCode} · unresolved` : "Unresolved"}</td><td className="p-3">{row.caseQuantity ?? "—"}</td><td className="p-3">{row.displayNotes ?? "—"}{row.issues.map((item) => <span key={item.code} className="block text-xs text-warning">{item.message}</span>)}</td></tr>)}</tbody></table></div></Card>
      <Card><h2 className="font-semibold">Display note review</h2>{result.displayNotes.length ? <ul className="mt-3 space-y-2 text-sm">{result.displayNotes.map((note) => <li key={`${note.store?.id}-${note.displayLocalCode}`}><b>{note.store?.name ?? "Unknown store"} · {note.displayLocalCode}</b>: {note.hasConflict ? <span className="text-warning">conflicting_display_notes — buyer review required</span> : note.executionNotes || "No display notes"}</li>)}</ul> : <p className="mt-2 text-sm text-text-muted">No display-level notes were supplied.</p>}</Card>
    </>}
  </div></DataState>;
}
