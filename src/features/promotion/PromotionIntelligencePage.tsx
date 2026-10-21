import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Field, PageHeader, inputClass } from "../../components/ui";
import { usePlatform } from "../../services/PlatformProvider";
import { DEMO_SOURCE } from "../../services/promotion/demoExtractor";
import { ingestSource, sourceFingerprint, deleteSource } from "../../domain/promotion/intake";
import { sourceInputSchema, type SourceInput, type WorkspaceRevision, type IntelligenceWorkspace } from "../../domain/promotion/schema";
import { OpportunityReview } from "./OpportunityReview";
import { currentCommercialReceipt } from "../../domain/promotion/decision";
import { rankComparableReceipts } from "../../domain/promotion/ranking";
const blank: SourceInput = { kind: "email", title: "", text: "", supplier: "", representative: "", date: "" };
export function PromotionIntelligencePage() {
  const platform = usePlatform();
  const [revision, setRevision] = useState<WorkspaceRevision>();
  const [source, setSource] = useState(blank);
  const [selected, setSelected] = useState<string>();
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const actor = platform.userEmail ?? "Jeremy (demo)";
  const reload = useCallback(async () => { try { setRevision(await platform.intelligenceRepository.load()); setError(undefined); } catch (cause) { setError(cause instanceof Error ? cause.message : "Inbox unavailable"); } }, [platform.intelligenceRepository]);
  useEffect(() => { let active = true; void platform.intelligenceRepository.load().then((result) => { if (active) setRevision(result); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Inbox unavailable"); }); return () => { active = false; }; }, [platform.intelligenceRepository]);
  async function save(workspace: IntelligenceWorkspace) {
    if (!revision) throw new Error("Reload the inbox first.");
    const saved = await platform.intelligenceRepository.save(workspace, revision.version);
    setRevision(saved);
  }
  async function run(operation: () => Promise<void>) {
    setBusy(true); setError(undefined); setMessage(undefined);
    try { await operation(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Operation failed. Draft retained."); } finally { setBusy(false); }
  }
  const canReview = platform.authEnabled ? ["buyer", "admin"].includes(platform.blackBettyRole ?? "") : ["admin", "merchandising"].includes(platform.role);
  const current = revision?.workspace.opportunities.find((o) => o.id === selected);
  const comparisonItems = revision?.workspace.opportunities.filter((item) => !item.intelligence.associatedWith && item.status !== "REJECTED").map((item) => ({ id: item.id, name: item.productName, receipt: currentCommercialReceipt(item) }));
  const comparison = revision && comparisonItems && rankComparableReceipts(comparisonItems, revision.workspace.priorities);
  return <>
    <PageHeader eyebrow="Betty · Buyer review" title="Promotion Intelligence" description="Capture supplier information, review the evidence, and feed approved products into campaign drafts." actions={<Badge tone="info">{platform.authEnabled ? "Authenticated shared inbox" : "DEMO · literal extraction · browser storage"}</Badge>} />
    {error && <p role="alert" className="rounded-md bg-error-subtle p-3 text-sm text-error">{error}</p>}
    {message && <p role="status" className="text-sm text-success">{message}</p>}
    {!canReview ? <Card>Buyer or admin access is required to review opportunities.</Card> : <>
      <Card><details open={!revision?.workspace.sources.length}><summary className="cursor-pointer font-semibold">Capture a communication</summary><form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void run(async () => {
        if (!revision) throw new Error("Inbox not loaded.");
        const input = sourceInputSchema.parse(source);
        const fingerprint = await sourceFingerprint(input.text, input);
        if (revision.workspace.sources.some((s) => s.fingerprint === fingerprint)) { setMessage("This source is already captured. No duplicates created."); return; }
        const { extraction, mode } = await platform.extractPromotion(input);
        const next = await ingestSource(revision.workspace, input, extraction, mode, actor);
        await save(next); setSelected(next.opportunities.at(-1)?.id); setSource(blank); setMessage("Captured. Review the source-linked claims before approval.");
      }); }}>
        <div className="grid gap-3 sm:grid-cols-3"><Field label="Source type"><select className={inputClass} value={source.kind} onChange={(e) => setSource({ ...source, kind: e.target.value as SourceInput["kind"] })}>{["email", "transcript", "notes", "observation", "offer"].map((v) => <option key={v}>{v}</option>)}</select></Field><Field label="Document title"><input maxLength={200} className={inputClass} value={source.title} onChange={(e) => setSource({ ...source, title: e.target.value })} /></Field><Field label="Source date"><input type="date" className={inputClass} value={source.date} onChange={(e) => setSource({ ...source, date: e.target.value })} /></Field><Field label="Supplier (optional)"><input maxLength={200} className={inputClass} value={source.supplier} onChange={(e) => setSource({ ...source, supplier: e.target.value })} /></Field><Field label="Representative (optional)"><input maxLength={200} className={inputClass} value={source.representative} onChange={(e) => setSource({ ...source, representative: e.target.value })} /></Field></div>
        <Field label="Communication content" hint={platform.authEnabled ? "Include only necessary business information. Model processing requires approved server configuration." : "Demo accepts labelled lines (Product:, SKU:, Dates:, Price:, Cost:, Jeremy:). Separate offers with a line containing --- ."}><textarea required maxLength={30000} className={`${inputClass} min-h-40 py-2`} value={source.text} onChange={(e) => setSource({ ...source, text: e.target.value })} /></Field>
        <div className="flex flex-wrap gap-2"><Button disabled={busy || !revision}>Extract and capture</Button>{!platform.authEnabled && <Button type="button" variant="secondary" onClick={() => setSource({ ...blank, title: "Synthetic November supplier email", text: DEMO_SOURCE })}>Load synthetic example</Button>}<Button type="button" variant="secondary" disabled={busy} onClick={() => void reload()}>Reload inbox</Button></div>
      </form></details></Card>
      {revision && <>
        <Card><details><summary className="cursor-pointer font-semibold">Ranking priorities</summary><p className="mt-2 text-sm text-text-secondary">Buyer-selected linear weights: units, margin dollars, observed lift %. Zero disables a signal. Defaults are unset. Compare the same source period and store scope.</p><form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget); void run(() => save({ ...revision.workspace, priorities: { volume: Number(form.get("volume")), margin: Number(form.get("margin")), lift: Number(form.get("lift")) } })); }}>{Object.entries(revision.workspace.priorities).map(([key, value]) => <Field key={key} label={`${key} weight`}><input name={key} type="number" min={0} max={100} step="any" defaultValue={value} className={inputClass} /></Field>)}<Button disabled={busy}>Save priorities</Button></form></details></Card>
        {comparison && <Card><details><summary className="cursor-pointer font-semibold">Compare retained commercial evidence</summary><p className="mt-2 text-sm">{comparison.state} · {comparison.reason}</p><p className="mt-2 text-xs text-text-secondary">Historical receipts from all non-rejected, unassociated opportunities. Comparison uses current buyer weights; original decision weights remain retained.</p><ol className="mt-2 list-inside list-decimal text-sm">{comparison.items.map((row) => {
          const item = comparisonItems?.find((candidate) => candidate.id === row.id), receipt = item?.receipt;
          return <li key={row.id} className="mb-3 break-words"><span>{item?.name}: {row.score === undefined ? "No comparable score" : row.score.toFixed(2)}</span><p className="text-xs text-text-secondary">{receipt ? `SKU ${receipt.sku} · ${receipt.scope.start} to ${receipt.scope.end} · Stores ${receipt.scope.storeIds.join(", ")} · ${receipt.mode.toUpperCase()} / ${receipt.qualification} · source revision ${receipt.sourceContract?.sourceRevision ?? "unverified"}` : "No retained receipt matches the current product identity."}</p></li>;
        })}</ol></details></Card>}
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]"><Card><Field label="Review status filter"><select className={inputClass} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All statuses</option>{["NEW", "NEEDS_REVIEW", "UNDER_CONSIDERATION", "APPROVED", "REJECTED", "ADDED_TO_CAMPAIGN"].map((s) => <option key={s}>{s}</option>)}</select></Field><ul className="mt-4 space-y-2">{revision.workspace.opportunities.filter((o) => !filter || o.status === filter).map((o) => <li key={o.id}><button className="w-full rounded-md border border-border p-3 text-left" aria-pressed={selected === o.id} onClick={() => setSelected(o.id)}><span className="block break-words font-semibold">{o.productName}</span><span className="block text-xs text-text-secondary">{o.supplierSku || "SKU unresolved"} · {o.status.replaceAll("_", " ")}{o.intelligence.associatedWith ? " · Associated evidence" : ""}</span></button></li>)}</ul>{!revision.workspace.opportunities.length && <p className="mt-3 text-sm text-text-muted">Capture a source to begin.</p>}</Card>
        {current ? <OpportunityReview key={`${current.id}:${current.updatedAt}:${revision.version}`} item={current} workspace={revision.workspace} save={save} run={run} busy={busy} actor={actor} /> : <Card>Select an opportunity to review its source and commercial evidence.</Card>}</div>
        <Card><details><summary className="cursor-pointer font-semibold">Source retention and deletion</summary><p className="my-3 text-sm text-text-secondary">Delete source text, excerpts and derived correspondence from this inbox. Fingerprints and campaign references remain for replay safety. Existing campaigns and historical packs are separate business records. Backup retention follows company policy.</p>{revision.workspace.sources.map((s) => <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2" key={s.id}><span className="break-all text-sm">{s.title || s.kind} · {s.deletedAt ? "Deleted" : s.createdAt.slice(0, 10)}</span><Button variant="secondary" disabled={busy || Boolean(s.deletedAt)} onClick={() => { if (window.confirm("Delete this source and its derived correspondence from the inbox? This cannot be undone here.")) void run(() => save(deleteSource(revision.workspace, s.id, actor))); }}>Delete source</Button></div>)}</details></Card>
      </>}
      {!platform.authEnabled && <Link className="text-sm text-primary underline" to="/opportunities/workbooks">Legacy workbook opportunities (demo)</Link>}
    </>}
  </>;
}
