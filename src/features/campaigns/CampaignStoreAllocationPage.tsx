import { ExternalLink, Lightbulb, MapPin, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, DataState, EmptyState, Field, PageHeader, formatDate, humanize, inputClass } from "../../components/ui";
import { campaignDisplayAreaCompatibility } from "../../domain/campaignDisplayAllocation";
import type { CampaignDisplayAssignmentProduct } from "../../domain/types";
import { usePlatform } from "../../services/PlatformProvider";
import { campaignTerminology } from "./campaignTerminology";
import { CampaignWorkflowStepper, campaignStoreReadiness } from "./campaignWorkflow";

export function CampaignStoreAllocationPage() {
  const { campaignId } = useParams();
  const platform = usePlatform();
  const { data, loading, error } = platform;
  const campaign = data?.campaigns.find((item) => item.id === campaignId);
  const [view, setView] = useState<"display" | "store">("display");
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState<string>();
  const [updatingStores, setUpdatingStores] = useState(false);
  const included = useMemo(() => data?.campaignStores.filter((item) => item.campaignId === campaign?.id && item.included) ?? [], [campaign?.id, data?.campaignStores]);
  const readiness = campaignStoreReadiness(campaign, data);

  const act = async (work: () => Promise<unknown>) => {
    try { setMessage(undefined); await work(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to update store allocation."); }
  };

  const updateStores = async (storeIds: string[]) => {
    if (!campaign || updatingStores) return;
    setUpdatingStores(true);
    await act(() => platform.setCampaignStores({ campaignId: campaign.id, storeIds }));
    setUpdatingStores(false);
  };

  return <DataState loading={loading} error={error}>{!campaign || !data ? <EmptyState title="Campaign not found" message="Unable to open store allocation." /> : <div className="space-y-5">
    <PageHeader eyebrow="Stores" title={campaign.name} description={`${formatDate(campaign.startDate)} to ${formatDate(campaign.endDate)} · Choose where each campaign display will go.`} actions={readiness.complete ? <Link className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground" to={`/campaigns/${campaign.id}/review`}>Continue to Review</Link> : undefined} />
    <CampaignWorkflowStepper campaign={campaign} data={data} current="stores" />
    <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Store allocation readiness</h2><p className="mt-1 text-sm text-text-secondary">{readiness.included} included · {readiness.ready} ready · {readiness.needsReview} need review · {readiness.notStarted} not started</p><p className="text-sm text-text-muted">{readiness.completePlacements} / {readiness.totalPlacements} placements complete</p></div><Badge tone={readiness.complete ? "success" : "warning"}>{readiness.complete ? "Ready for review" : `${readiness.needsReview} exceptions`}</Badge></div></Card>
    {message && <div role="alert" className="rounded-md border border-error/30 bg-error-subtle p-3 text-sm text-error">{message}</div>}
    <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Participating stores</h2><p className="text-sm text-text-secondary">Include stores before making store placement choices.</p></div><Button variant="secondary" disabled={updatingStores || included.length === data.stores.length} onClick={() => void updateStores(data.stores.map((store) => store.id))}>{updatingStores ? "Saving stores..." : "Include all stores"}</Button></div><div className="mt-3 grid gap-2 md:grid-cols-2">{data.stores.map((store) => { const checked = included.some((item) => item.storeId === store.id); return <label key={store.id} className="flex gap-2 rounded border border-border p-3 text-sm"><input type="checkbox" checked={checked} disabled={updatingStores} onChange={() => void updateStores(checked ? included.filter((item) => item.storeId !== store.id).map((item) => item.storeId) : [...included.map((item) => item.storeId), store.id])} /><span><b>{store.name}</b><span className="block text-xs text-text-muted">{store.code}</span></span></label>; })}</div></Card>
    <Card className="bg-subtle/40"><h2 className="font-semibold">How store quantities work</h2><dl className="mt-3 grid gap-3 text-sm md:grid-cols-3"><div><dt className="font-semibold">Campaign default</dt><dd className="text-text-secondary">Used by every store unless it is adjusted.</dd></div><div><dt className="font-semibold">{campaignTerminology.adjustedByStore}</dt><dd className="text-text-secondary">Changes only the selected store.</dd></div><div><dt className="font-semibold">Reset</dt><dd className="text-text-secondary">Returns one store to the current campaign default.</dd></div></dl></Card>
    <div className="flex flex-wrap gap-2"><Button variant={view === "display" ? "primary" : "secondary"} onClick={() => setView("display")}>By display</Button><Button variant={view === "store" ? "primary" : "secondary"} onClick={() => setView("store")}>By store</Button><select aria-label="Allocation filter" className={inputClass} value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All placements</option><option value="attention">Needs attention</option><option value="ready">Ready</option></select></div>
    {view === "display" ? <div className="space-y-4">{data.campaignDisplays.filter((item) => item.campaignId === campaign.id).map((display) => <DisplayAllocations key={display.id} displayId={display.id} campaignId={campaign.id} filter={filter} onError={setMessage} />)}</div> : <div className="space-y-4">{included.map((scope) => <StoreAllocations key={scope.id} storeId={scope.storeId} campaignId={campaign.id} filter={filter} onError={setMessage} />)}</div>}
  </div>}</DataState>;
}

function DisplayAllocations({ displayId, campaignId, filter, onError }: { displayId: string; campaignId: string; filter: string; onError(message?: string): void }) {
  const platform = usePlatform(); const { data } = platform; if (!data) return null;
  const display = data.campaignDisplays.find((item) => item.id === displayId)!;
  const scopes = data.campaignStores.filter((item) => item.campaignId === campaignId && item.included);
  const rows = scopes.map((scope) => data.campaignDisplayAssignments.find((item) => item.campaignDisplayId === displayId && item.storeId === scope.storeId)).filter((item) => showAllocation(item?.status, filter));
  return <Card><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">{display.name}</h2><p className="text-sm text-text-secondary">{display.placementMode === "STANDARD" ? "Standard display — review each suggested store placement." : "Store-specific display — choose a location for every store."}</p></div>{display.placementMode === "STANDARD" && <Button onClick={() => void runAllocationAction(() => platform.suggestCampaignDisplay({ campaignId, campaignDisplayId: displayId }), onError)}><Lightbulb className="h-4 w-4" />Suggest for all stores</Button>}</div><div className="mt-3 space-y-2">{rows.length ? rows.map((assignment) => assignment ? <AllocationRow key={assignment.id} assignmentId={assignment.id} onError={onError} /> : null) : scopes.filter((scope) => !data.campaignDisplayAssignments.some((item) => item.campaignDisplayId === displayId && item.storeId === scope.storeId)).map((scope) => <UnplannedRow key={scope.id} displayId={displayId} campaignId={campaignId} storeId={scope.storeId} onError={onError} />)}</div></Card>;
}

function StoreAllocations({ storeId, campaignId, filter, onError }: { storeId: string; campaignId: string; filter: string; onError(message?: string): void }) {
  const { data } = usePlatform(); if (!data) return null;
  const store = data.stores.find((item) => item.id === storeId)!;
  const displays = data.campaignDisplays.filter((item) => item.campaignId === campaignId);
  return <Card><h2 className="font-semibold">{store.name}</h2><div className="mt-3 space-y-2">{displays.map((display) => { const allocation = data.campaignDisplayAssignments.find((item) => item.campaignDisplayId === display.id && item.storeId === storeId); return allocation && showAllocation(allocation.status, filter) ? <AllocationRow key={allocation.id} assignmentId={allocation.id} onError={onError} /> : !allocation && filter !== "ready" ? <UnplannedRow key={display.id} displayId={display.id} campaignId={campaignId} storeId={storeId} onError={onError} /> : null; })}</div></Card>;
}

function UnplannedRow({ displayId, campaignId, storeId, onError }: { displayId: string; campaignId: string; storeId: string; onError(message?: string): void }) {
  const { data, suggestCampaignDisplay } = usePlatform(); if (!data) return null;
  const display = data.campaignDisplays.find((item) => item.id === displayId)!;
  const store = data.stores.find((item) => item.id === storeId)!;
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-warning/30 p-3 text-sm"><span><b>{store.name}</b> · {display.name}<span className="block text-text-warning">No store placement</span></span><Button variant="secondary" onClick={() => void runAllocationAction(() => suggestCampaignDisplay({ campaignId, campaignDisplayId: displayId, storeIds: [storeId] }), onError)}>{display.placementMode === "STANDARD" ? "Suggest placement" : "Start placement"}</Button></div>;
}

function AllocationRow({ assignmentId, onError }: { assignmentId: string; onError(message?: string): void }) {
  const platform = usePlatform(); const { data } = platform; const [expanded, setExpanded] = useState(false); if (!data) return null;
  const assignment = data.campaignDisplayAssignments.find((item) => item.id === assignmentId)!;
  const display = data.campaignDisplays.find((item) => item.id === assignment.campaignDisplayId)!;
  const store = data.stores.find((item) => item.id === assignment.storeId)!;
  const candidates = data.displayAreas.filter((item) => item.storeId === store.id && item.active);
  const area = data.displayAreas.find((item) => item.id === assignment.displayAreaId);
  const update = (input: Parameters<typeof platform.updateCampaignDisplayAssignment>[0]) => runAllocationAction(() => platform.updateCampaignDisplayAssignment(input), onError);
  const floorplan = `/stores/${store.id}/floorplan?campaign=${assignment.campaignId}${area ? `&area=${area.id}` : ""}`;
  return <div className="rounded border border-border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><b>{store.name}</b> · {display.name}<span className="block text-text-muted">{area ? `${area.name} (${area.displayNumber})${area.active ? "" : " · inactive historical area"}` : assignment.suggestionDisplayAreaId ? `Suggested: ${data.displayAreas.find((item) => item.id === assignment.suggestionDisplayAreaId)?.name}` : "Choose a physical location"}</span>{assignment.suggestionReasons?.map((reason) => <span key={reason} className="block text-xs text-text-muted">• {reason}</span>)}</div><div className="flex flex-wrap gap-2"><Badge tone={assignment.status === "ASSIGNED" || assignment.status === "EXCLUDED" ? "success" : "warning"}>{humanize(assignment.status)}</Badge>{assignment.status === "SUGGESTED" && <Button onClick={() => void update({ campaignDisplayAssignmentId: assignment.id, displayAreaId: assignment.suggestionDisplayAreaId, status: "ASSIGNED" })}>Accept suggestion</Button>}<Button variant="secondary" onClick={() => setExpanded(!expanded)}>{expanded ? "Close" : `${campaignTerminology.storePlacement} / quantities`}</Button><Link className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-3 font-semibold" to={floorplan}><MapPin className="h-4 w-4" />Floorplan</Link></div></div>{expanded && <div className="mt-3 grid gap-3 border-t border-border pt-3"><Field label="Physical display area"><select className={inputClass} value={area?.active ? assignment.displayAreaId ?? "" : ""} onChange={(event) => { if (event.target.value) void update({ campaignDisplayAssignmentId: assignment.id, displayAreaId: event.target.value, status: "ASSIGNED", placementSource: "BUYER_SELECTED" }); }}><option value="">Choose active verified location…</option>{candidates.map((candidate) => { const result = campaignDisplayAreaCompatibility(display, candidate, data); return <option key={candidate.id} value={candidate.id} disabled={result.status === "incompatible"}>{candidate.name} · {candidate.localCode ?? candidate.displayNumber} · {humanize(result.status)}</option>; })}</select></Field><div className="flex gap-2"><Button variant="secondary" onClick={() => void update({ campaignDisplayAssignmentId: assignment.id, status: "EXCLUDED" })}>Not used in this store</Button>{area && <Link className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-3 font-semibold" to={floorplan}><ExternalLink className="h-4 w-4" />View on floorplan</Link>}</div><QuantityEditor assignmentId={assignment.id} displayId={display.id} storeName={store.name} onError={onError} /></div>}</div>;
}

function QuantityEditor({ assignmentId, displayId, storeName, onError }: { assignmentId: string; displayId: string; storeName: string; onError(message?: string): void }) {
  const platform = usePlatform(); const { data } = platform; if (!data) return null;
  const products = data.campaignDisplayAssignmentProducts.filter((item) => item.campaignDisplayAssignmentId === assignmentId);
  return <div><h3 className="font-semibold">Store quantities</h3><div className="mt-2 space-y-2">{products.map((item) => { const product = data.products.find((candidate) => candidate.id === item.productId); const member = data.campaignDisplayProducts.find((candidate) => candidate.id === item.campaignDisplayProductId); return <StoreQuantityField key={`${item.id}-${item.caseQuantity}-${item.recommendedCases}-${item.buyerOverride}`} item={item} sku={product?.sku ?? "Unknown SKU"} name={product?.name ?? "Unknown product"} storeName={storeName} casePack={product?.casePack} role={member?.role} onError={onError} onSave={(caseQuantity) => platform.updateCampaignDisplayAssignmentProduct({ campaignDisplayAssignmentProductId: item.id, caseQuantity })} onReset={() => platform.updateCampaignDisplayAssignmentProduct({ campaignDisplayAssignmentProductId: item.id, resetToDefault: true })} onApplyDefault={(caseQuantity) => platform.applyCampaignDisplayQuantity({ campaignDisplayId: displayId, campaignDisplayProductId: item.campaignDisplayProductId, caseQuantity })} />; })}</div></div>;
}

function StoreQuantityField({ item, sku, name, storeName, casePack, role, onSave, onReset, onApplyDefault, onError }: { item: CampaignDisplayAssignmentProduct; sku: string; name: string; storeName: string; casePack?: number; role?: string; onSave(value: number): Promise<unknown>; onReset(): Promise<unknown>; onApplyDefault(value: number): Promise<unknown>; onError(message?: string): void }) {
  const [value, setValue] = useState(item.caseQuantity?.toString() ?? ""); const [saving, setSaving] = useState(false);
  const quantity = Number(value); const valid = value !== "" && Number.isInteger(quantity) && quantity >= 0;
  const run = async (operation: () => Promise<unknown>) => { if (!valid) { onError("Quantity must be a non-negative whole number."); return; } setSaving(true); await runAllocationAction(operation, onError); setSaving(false); };
  return <div className="grid items-center gap-3 rounded border border-border p-3 lg:grid-cols-[minmax(0,1fr)_120px_auto]"><span><b>{sku}</b> · {name}<span className="block text-xs text-text-muted">{role} · case pack {casePack ?? "—"} · {campaignTerminology.campaignDefault}: {item.recommendedCases ?? "Not set"}</span></span><input aria-label={`Quantity for ${sku} at ${storeName}`} type="number" min="0" step="1" className={inputClass} value={value} disabled={saving} onChange={(event) => setValue(event.target.value)} /><div className="flex flex-wrap items-center gap-2"><Badge tone={item.buyerOverride ? "warning" : "neutral"}>{item.buyerOverride ? campaignTerminology.adjustedByStore : campaignTerminology.inherited}</Badge><Button type="button" disabled={saving || !valid || quantity === item.caseQuantity} onClick={() => void run(() => onSave(quantity))}>Save store adjustment</Button>{item.buyerOverride && <Button type="button" variant="secondary" disabled={saving} onClick={() => { setSaving(true); void runAllocationAction(onReset, onError).finally(() => setSaving(false)); }}><RotateCcw className="h-4 w-4" />Reset</Button>}<Button type="button" variant="secondary" disabled={saving || !valid} title="Replace the campaign default and reset every store to this quantity" onClick={() => void run(() => onApplyDefault(quantity))}>Apply default to all stores</Button></div></div>;
}

async function runAllocationAction(operation: () => Promise<unknown>, onError: (message?: string) => void) { onError(undefined); try { await operation(); } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to update store allocation."); } }
function showAllocation(status: string | undefined, filter: string) { return filter === "all" || (filter === "ready" && (status === "ASSIGNED" || status === "EXCLUDED")) || (filter === "attention" && status !== "ASSIGNED" && status !== "EXCLUDED"); }
