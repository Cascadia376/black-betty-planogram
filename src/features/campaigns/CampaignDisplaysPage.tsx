import { ArrowRight, Plus, Search } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, DataState, EmptyState, Field, PageHeader, formatDate, humanize, inputClass } from "../../components/ui";
import type { CampaignDisplayPlacementMode, DisplayType } from "../../domain/types";
import { resolveCampaignProduct } from "../../domain/productMaster";
import { usePlatform } from "../../services/PlatformProvider";
import { CampaignWorkflowStepper, campaignDisplayReadiness } from "./campaignWorkflow";

const displayTypes: DisplayType[] = ["endcap", "feature_display", "seasonal_table", "floor_stack", "cooler_doors", "window", "checkout", "contest_space", "supplier_display", "flex", "other"];

export function CampaignDisplaysPage() {
  const { campaignId } = useParams();
  const platform = usePlatform();
  const { data, loading, error } = platform;
  const campaign = data?.campaigns.find((item) => item.id === campaignId);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [targetDisplay, setTargetDisplay] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [displayType, setDisplayType] = useState<DisplayType>("feature_display");
  const [placementMode, setPlacementMode] = useState<CampaignDisplayPlacementMode>("STANDARD");
  const [mutationError, setMutationError] = useState<string>();
  const displays = useMemo(() => data?.campaignDisplays.filter((item) => item.campaignId === campaign?.id).sort((a, b) => a.sortOrder - b.sortOrder) ?? [], [campaign?.id, data?.campaignDisplays]);
  const readiness = campaignDisplayReadiness(campaign, data);
  const visibleProducts = useMemo(() => (campaign?.products ?? []).filter((item) => {
    const product = resolveCampaignProduct(item, data?.products ?? []);
    const text = `${product?.sku ?? ""} ${product?.name ?? ""}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!category || product?.category === category);
  }), [campaign?.products, category, data?.products, query]);
  const categories = [...new Set((campaign?.products ?? []).map((item) => resolveCampaignProduct(item, data?.products ?? [])?.category).filter(Boolean))] as string[];
  const run = async (operation: () => Promise<unknown>) => { try { setMutationError(undefined); await operation(); setSelected([]); } catch (cause) { setMutationError(cause instanceof Error ? cause.message : "Unable to update display planning."); } };
  const createDisplay = async (event: FormEvent) => { event.preventDefault(); if (!campaign) return; await run(async () => { await platform.createCampaignDisplay({ campaignId: campaign.id, display: { name, displayType, placementMode, prescriptive: false } }); setName(""); setShowForm(false); }); };

  return <DataState loading={loading} error={error}>{!campaign || !data ? <EmptyState title="Campaign not found" message="Unable to open display planning." /> : <div className="space-y-5">
    <PageHeader eyebrow="Displays" title={campaign.name} description={`${formatDate(campaign.startDate)} to ${formatDate(campaign.endDate)} · Group the campaign assortment into practical merchandising displays.`} actions={<Link className="inline-flex min-h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground" to={`/campaigns/${campaign.id}/assign`}>Continue to Stores <ArrowRight className="h-4 w-4" /></Link>} />
    <CampaignWorkflowStepper campaign={campaign} data={data} current="displays" />
    <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Display readiness</h2><p className="mt-1 text-sm text-text-secondary">{readiness.total} products · {readiness.assigned} display assigned · {readiness.shelfSupported} shelf supported · {readiness.unassigned} unassigned</p></div><Badge tone={readiness.status === "complete" ? "success" : readiness.status === "not_started" ? "neutral" : "warning"}>{readiness.status === "complete" ? "Ready for stores" : "Merchandising decisions needed"}</Badge></div></Card>
    {mutationError && <div role="alert" className="rounded-md border border-error/30 bg-error-subtle p-3 text-sm text-error">{mutationError}</div>}
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card><h2 className="font-semibold">Product pool</h2><div className="mt-3 grid gap-2"><label className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-muted" /><input aria-label="Search campaign products" className={`${inputClass} pl-9`} placeholder="SKU or product" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="Filter by category" className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></div>
        <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">{visibleProducts.map((item) => { const product = resolveCampaignProduct(item, data.products); const checked = selected.includes(item.id); return <label key={item.id} className="flex cursor-pointer gap-3 rounded border border-border p-3 text-sm"><input type="checkbox" checked={checked} onChange={() => setSelected((ids) => checked ? ids.filter((id) => id !== item.id) : [...ids, item.id])} /><span className="min-w-0 flex-1"><span className="block font-medium">{product?.name ?? "Unresolved product"}</span><span className="block text-xs text-text-muted">{product?.sku} · {product?.category}</span><Badge tone={item.merchandisingState === "SHELF_SUPPORTED" ? "info" : item.merchandisingState === "DISPLAY_ASSIGNED" ? "success" : "warning"}>{humanize(item.merchandisingState ?? "UNASSIGNED")}</Badge></span></label>; })}</div>
        <div className="mt-4 grid gap-2"><select aria-label="Select display for products" className={inputClass} value={targetDisplay} onChange={(event) => setTargetDisplay(event.target.value)}><option value="">Select display…</option>{displays.map((display) => <option key={display.id} value={display.id}>{display.name}</option>)}</select><Button disabled={!selected.length || !targetDisplay} onClick={() => run(() => platform.assignCampaignProductsToDisplay({ campaignId: campaign.id, campaignDisplayId: targetDisplay, campaignProductIds: selected }))}>Add / move selected</Button><div className="grid grid-cols-2 gap-2"><Button variant="secondary" disabled={!selected.length} onClick={() => run(() => platform.setCampaignProductShelfSupport(campaign.id, selected))}>Shelf supported</Button><Button variant="secondary" disabled={!selected.length} onClick={() => run(() => platform.setCampaignProductUnassigned(campaign.id, selected))}>Unassign</Button></div></div>
      </Card>
      <div className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Campaign displays</h2><p className="text-sm text-text-secondary">CampaignDisplay is a merchandising concept; store locations are chosen in the Stores step.</p></div><Button onClick={() => setShowForm((value) => !value)}><Plus className="h-4 w-4" />New display</Button></div>
        {showForm && <Card><form onSubmit={createDisplay} className="grid gap-3 md:grid-cols-3"><Field label="Display name"><input required className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="Display type"><select className={inputClass} value={displayType} onChange={(event) => setDisplayType(event.target.value as DisplayType)}>{displayTypes.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></Field><Field label="Placement mode" hint={placementMode === "STANDARD" ? "Common concept; compatible locations are suggested later." : "Campaign-specific setup; location is selected for each store later."}><select className={inputClass} value={placementMode} onChange={(event) => setPlacementMode(event.target.value as CampaignDisplayPlacementMode)}><option value="STANDARD">Standard</option><option value="STORE_SPECIFIC">Store-specific</option></select></Field><div className="md:col-span-3"><Button>Create display</Button></div></form></Card>}
        {displays.map((display) => { const members = data.campaignDisplayProducts.filter((item) => item.campaignDisplayId === display.id); return <Card key={display.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{display.name}</h3><p className="text-sm text-text-secondary">{humanize(display.displayType)} · {display.placementMode === "STANDARD" ? "Standard" : "Store-specific"} · {members.length} products</p></div><Button variant="danger" onClick={() => run(() => platform.removeCampaignDisplay(display.id))}>Remove</Button></div>{display.signage && <p className="mt-2 text-sm"><span className="font-semibold">Signage:</span> {display.signage}</p>}{display.executionNotes && <p className="mt-1 text-sm text-text-secondary">{display.executionNotes}</p>}<div className="mt-3 space-y-2">{members.length === 0 ? <p className="text-sm text-warning">Empty display — add products or remove it.</p> : members.map((member) => { const product = data.products.find((item) => item.id === member.productId); return <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2 text-sm"><span><b>{product?.sku}</b> · {product?.name} <span className="text-text-muted">({member.role}, {member.required ? "required" : "optional"})</span></span><span className="flex gap-2"><Button variant="secondary" onClick={() => run(() => platform.updateCampaignDisplayProduct({ campaignDisplayProductId: member.id, patch: { role: member.role === "Hero" ? "Supporting" : "Hero" } }))}>{member.role === "Hero" ? "Make supporting" : "Make hero"}</Button><Button variant="secondary" onClick={() => run(() => platform.removeCampaignProductFromDisplay(member.id))}>Remove</Button></span></div>; })}</div></Card>; })}
      </div>
    </div>
  </div>}</DataState>;
}
