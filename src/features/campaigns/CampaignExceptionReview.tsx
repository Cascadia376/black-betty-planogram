import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Field, inputClass } from "../../components/ui";
import { buildStoreExecutionPack, executionMonths, type ExecutionException, type ExecutionMonth } from "../../domain/storeExecutionPack";
import { campaignDisplayAreaCompatibility } from "../../domain/campaignDisplayAllocation";
import type { CampaignDisplay, PlatformSnapshot } from "../../domain/types";
import { usePlatform } from "../../services/PlatformProvider";

export function CampaignExceptionReview({ data, campaignId }: { data: PlatformSnapshot; campaignId: string }) {
  const stores = data.stores.filter((store) => data.campaignStores.some((item) => item.campaignId === campaignId && item.storeId === store.id && item.included));
  const [storeId, setStoreId] = useState(stores.find((item) => item.name === "Crown Isle")?.id ?? stores[0]?.id ?? "");
  const pack = buildStoreExecutionPack(data, campaignId, storeId);
  return <Card><h2 className="font-semibold">Exceptions and store execution pack</h2><p className="my-2 text-sm">1. Review exceptions. 2. Approve store placement changes. 3. Open the printable store pack. Saved in this browser only; no production writes.</p>
    <Field label="Execution pack store"><select className={inputClass} value={storeId} onChange={(e) => setStoreId(e.target.value)}>{stores.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    {!pack ? <p>No participating stores yet. Import store case allocations to begin.</p> : <>
      <div className="my-3 flex flex-wrap gap-2">
        {executionMonths.map((month) => <Link key={month} className="inline-block rounded bg-primary px-4 py-2 font-semibold text-primary-foreground" to={`/campaigns/${campaignId}/stores/${storeId}/pack?month=${month}`}>Open {pack.store.name} {monthLabel(month)} pack</Link>)}
        <Link className="inline-block rounded border border-border px-4 py-2 font-semibold" to={`/campaigns/${campaignId}/stores/${storeId}/pack`}>Open all OND pack</Link>
      </div>
      <p className="text-sm">{pack.exceptions.length} unresolved exceptions · {pack.builds.length} assigned displays · {pack.shelf.length} shelf-support products</p>
      {pack.exceptions.length === 0 && <p role="status">No unresolved exceptions for this store.</p>}
      {pack.exceptions.map((item) => <ExceptionAction key={`${storeId}-${item.id}`} item={item} data={data} campaignId={campaignId} />)}
      <details className="mt-3"><summary className="cursor-pointer font-semibold">No-display / shelf-support ({pack.shelf.length})</summary><p>Keep in regular shelf locations; no alternate floor display is implied.</p>{pack.shelf.map((item) => <p key={item.id}>{item.sku} · {item.name} · {item.cases ?? "Unresolved"} cases</p>)}</details>
    </>}
  </Card>;
}

function monthLabel(month: ExecutionMonth) {
  return { OCT: "October", NOV: "November", DEC: "December" }[month];
}

function ExceptionAction({ item, data, campaignId }: { item: ExecutionException; data: PlatformSnapshot; campaignId: string }) {
  const { updateCampaignDisplayAssignment } = usePlatform();
  const [areaId, setAreaId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const assignment = item.assignment;
  const display = data.campaignDisplays.find((candidate) => candidate.id === assignment?.campaignDisplayId);
  const suggestion = data.displayAreas.find((area) => area.id === assignment?.suggestionDisplayAreaId);
  const placementException = item.kind === "Suggested alternative requiring approval" || item.kind === "Missing store display";
  const save = async (id?: string) => {
    if (!assignment) return;
    setBusy(true); setError("");
    try { await updateCampaignDisplayAssignment({ campaignDisplayAssignmentId: assignment.id, displayAreaId: id ?? null, status: id ? "ASSIGNED" : "EXCLUDED", placementSource: "BUYER_SELECTED", note: id ? assignment.note : "Buyer approved no display / shelf support for this store." }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Approval failed."); }
    finally { setBusy(false); }
  };
  return <article className="mt-3 rounded border border-warning/40 p-3 text-sm"><h3 className="font-semibold">{item.kind}</h3><p className="my-2">{item.message}</p><p>{item.action}</p>
    {placementException && assignment && display && <div className="mt-3 space-y-2">
      {suggestion && <div><p>Proposed: {suggestion.localCode ?? suggestion.displayNumber} · {suggestion.name}. This has NOT been assigned.</p><Button disabled={busy || campaignDisplayAreaCompatibility(display, suggestion, data).status === "incompatible"} onClick={() => void save(suggestion.id)}>Approve suggested area</Button></div>}
      <Field label={`Alternative area for ${display.name}`}><select className={inputClass} value={areaId} onChange={(e) => setAreaId(e.target.value)}><option value="">Choose an alternative explicitly</option>{data.displayAreas.filter((area) => area.storeId === assignment.storeId && area.active).map((area) => <option key={area.id} value={area.id} disabled={campaignDisplayAreaCompatibility(display, area, data).status === "incompatible"}>{area.localCode ?? area.displayNumber} · {area.name}</option>)}</select></Field>
      <div className="flex flex-wrap gap-2"><Button disabled={busy || !areaId} onClick={() => void save(areaId)}>Approve chosen area</Button><Button disabled={busy} onClick={() => void save()}>Approve shelf support for this store</Button></div>
    </div>}
    {item.kind === "Execution details missing" && display && <DisplayInstructions display={display} />}
    {(!placementException || !assignment) && <Link className="mt-2 inline-block font-semibold text-primary underline" to={`/campaigns/${campaignId}/${item.campaignProductId ? "display" : "assign"}`}>Review display products / store quantities</Link>}
    {["Unmatched SKU", "Inactive SKU", "Source row requires correction"].includes(item.kind) && <Link className="ml-3 font-semibold text-primary underline" to="/imports/flyer">Import corrected consolidated workbook</Link>}
    {error && <p role="alert" className="text-error">{error}</p>}
  </article>;
}

function DisplayInstructions({ display }: { display: CampaignDisplay }) {
  const { updateCampaignDisplay } = usePlatform();
  const [signage, setSignage] = useState(display.signage ?? "");
  const [notes, setNotes] = useState(display.executionNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true); setError("");
    try { await updateCampaignDisplay({ campaignDisplayId: display.id, patch: { signage: signage.trim(), executionNotes: notes.trim() } }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Instructions could not be saved."); }
    finally { setBusy(false); }
  };
  return <div className="my-3 grid gap-2"><p>These display instructions apply across stores. Enter “No signage required” only if that is the approved instruction.</p><Field label={`Signage for ${display.name}`}><input className={inputClass} value={signage} onChange={(e) => setSignage(e.target.value)} /></Field><Field label={`Execution notes for ${display.name}`}><textarea className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field><Button disabled={busy || !signage.trim()} onClick={() => void save()}>Save display instructions</Button>{error && <p role="alert">{error}</p>}</div>;
}
