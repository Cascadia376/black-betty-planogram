import { ArrowRight, Check, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { CampaignDisplay, CampaignDisplayPlacement, CampaignDisplayProduct, CampaignPlacementMode, CampaignProduct, DisplayType, Product } from "../../domain/types";
import { resolveCampaignProduct } from "../../domain/productMaster";
import { usePlatform } from "../../services/PlatformProvider";
import { Badge, Button, Card, DataState, EmptyState, Field, PageHeader, formatDate, humanize, inputClass } from "../../components/ui";
import { ProductIntakeWorkspace } from "./ProductIntakeWorkspace";
import { CampaignWorkflowStepper, campaignReadiness } from "./campaignWorkflow";

function useCampaign() {
  const { campaignId } = useParams();
  const platform = usePlatform();
  return { ...platform, campaignId, campaign: platform.data?.campaigns.find((item) => item.id === campaignId) };
}

function productLabel(campaignProductId: string, products: Product[] | undefined, campaignProducts: CampaignProduct[] | undefined) {
  const campaignProduct = campaignProducts?.find((item) => item.id === campaignProductId);
  const product = campaignProduct ? resolveCampaignProduct(campaignProduct, products ?? []) : undefined;
  return product ? `${product.sku} · ${product.name}` : "Unresolved product";
}

function displayTypeOptions() {
  return ["endcap", "feature_display", "seasonal_table", "floor_stack", "cooler_doors", "window", "checkout", "contest_space", "supplier_display", "flex", "other"] as DisplayType[];
}

export function CampaignProductsPage() {
  const navigate = useNavigate();
  const { campaign, data, loading, error, searchProducts, createPendingProduct, updateCampaignProducts } = useCampaign();
  const [products, setProducts] = useState<CampaignProduct[]>([]);
  const [loadedCampaignId, setLoadedCampaignId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  if (campaign && loadedCampaignId !== campaign.id) {
    setProducts(campaign.products);
    setLoadedCampaignId(campaign.id);
  }
  const save = async (continueNext = false) => {
    if (!campaign) return;
    try {
      setSaving(true);
      setFormError("");
      await updateCampaignProducts({ campaignId: campaign.id, products });
      if (continueNext) navigate(`/campaigns/${campaign.id}/display`);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Products could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  return <DataState loading={loading} error={error}>{!campaign || !data ? <EmptyState title="Campaign not found" message="Unable to build this campaign assortment." /> : <div className="space-y-6">
    <PageHeader eyebrow="Products" title={campaign.name} description={`${formatDate(campaign.startDate)} to ${formatDate(campaign.endDate)} · Build the campaign assortment.`} actions={<><Button type="button" variant="secondary" onClick={() => void save(false)} disabled={saving}><Save className="h-4 w-4" />Save</Button><Button type="button" onClick={() => void save(true)} disabled={saving || products.some((item) => !item.productId)}>Continue to Displays<ArrowRight className="h-4 w-4" /></Button></>} />
    <CampaignWorkflowStepper campaign={campaign} data={{ ...data, campaigns: data.campaigns.map((item) => item.id === campaign.id ? { ...campaign, products } : item) }} current="products" />
    {formError && <div role="alert" className="rounded-md border border-error/30 bg-error-subtle px-4 py-3 text-sm text-error">{formError}</div>}
    <ProductIntakeWorkspace products={data.products} assortment={products} onChange={setProducts} searchProducts={searchProducts} createPendingProduct={createPendingProduct} />
  </div>}</DataState>;
}

export function CampaignDetailPage() {
  const { campaign, data, loading, error, role } = useCampaign();
  const canEdit = role === "admin" || role === "merchandising";
  return <DataState loading={loading} error={error}>{!campaign || !data ? <EmptyState title="Campaign not found" message="The requested campaign does not exist in this data adapter." /> : <div className="space-y-5">
    <PageHeader eyebrow="Campaign summary" title={campaign.name} description={campaign.description} actions={canEdit && <><LinkButton to={`/campaigns/${campaign.id}/products`}>Products</LinkButton><LinkButton to={`/campaigns/${campaign.id}/display`}>Build displays</LinkButton><LinkButton to={`/campaigns/${campaign.id}/assign`} primary>Assign stores</LinkButton></>} />
    <CampaignWorkflowStepper campaign={campaign} data={data} current="campaign" />
    <div className="grid gap-4 xl:grid-cols-3"><Card className="xl:col-span-2"><div className="flex flex-wrap items-center gap-2"><Badge tone={campaign.status === "active" ? "success" : campaign.status === "scheduled" ? "info" : "neutral"}>{campaign.status}</Badge><Badge>{campaign.type}</Badge></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><Detail label="Period" value={`${formatDate(campaign.startDate)} to ${formatDate(campaign.endDate)}`} /><Detail label="Owner" value={campaign.owner} /><Detail label="Supplier / partner" value={campaign.supplier || "Not specified"} /><Detail label="Products" value={String(campaign.products.length)} /></dl></Card><CampaignSetupCard campaignId={campaign.id} /></div>
    <Card className="overflow-hidden p-0"><div className="border-b border-border px-4 py-3"><h2 className="font-semibold">Campaign setup</h2></div><SetupRows campaign={campaign} data={data} /></Card>
  </div>}</DataState>;
}

export function DisplayDesignerPage() {
  const navigate = useNavigate();
  const { campaign, data, loading, error, saveCampaignDisplays } = useCampaign();
  const existingDisplays = useMemo(() => data && campaign ? data.campaignDisplays.filter((display) => display.campaignId === campaign.id) : [], [data, campaign]);
  const [displays, setDisplays] = useState<CampaignDisplay[]>(existingDisplays);
  const [shelfSupportedIds, setShelfSupportedIds] = useState<string[]>(campaign?.shelfSupportedProductIds ?? []);
  const [loadedCampaignId, setLoadedCampaignId] = useState(campaign?.id);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  if (campaign && loadedCampaignId !== campaign.id) {
    setDisplays(existingDisplays);
    setShelfSupportedIds(campaign?.shelfSupportedProductIds ?? []);
    setLoadedCampaignId(campaign.id);
  }
  const assignedIds = new Set(displays.flatMap((display) => display.products.map((product) => product.campaignProductId)));
  const shelfIds = new Set(shelfSupportedIds);
  const unassigned = campaign?.products.filter((product) => !assignedIds.has(product.id) && !shelfIds.has(product.id)) ?? [];
  const addDisplay = () => setDisplays((current) => [...current, {
    id: crypto.randomUUID(), campaignId: campaign!.id, name: `Display ${current.length + 1}`, displayType: "flex", placementMode: "STANDARD", signage: "", minimumSpace: "", prescriptive: false, executionNotes: "", products: [],
  }]);
  const updateDisplay = (id: string, changes: Partial<CampaignDisplay>) => setDisplays((current) => current.map((display) => display.id === id ? { ...display, ...changes } : display));
  const addProductToDisplay = (displayId: string, campaignProductId: string) => updateDisplay(displayId, { products: [...(displays.find((display) => display.id === displayId)?.products ?? []), { id: crypto.randomUUID(), campaignProductId, required: campaign?.products.find((product) => product.id === campaignProductId)?.required ?? true, minimumQuantity: 1, minimumFacings: 1 }] });
  const removeDisplayProduct = (displayId: string, productId: string) => updateDisplay(displayId, { products: displays.find((display) => display.id === displayId)!.products.filter((product) => product.id !== productId) });
  const save = async (continueNext = false) => {
    if (!campaign) return;
    try {
      setSaving(true);
      setFormError("");
      await saveCampaignDisplays({ campaignId: campaign.id, displays, shelfSupportedProductIds: shelfSupportedIds });
      if (continueNext) navigate(`/campaigns/${campaign.id}/assign`);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Display plan could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  return <DataState loading={loading} error={error}>{!campaign || !data ? <EmptyState title="Campaign not found" message="Unable to design this campaign display plan." /> : <div className="space-y-6">
    <PageHeader eyebrow="Build displays" title={campaign.name} description="Group campaign products into merchandising displays." actions={<><Button type="button" variant="secondary" onClick={addDisplay}><Plus className="h-4 w-4" />New display</Button><Button type="button" variant="secondary" onClick={() => void save(false)} disabled={saving}><Save className="h-4 w-4" />Save</Button><Button type="button" onClick={() => void save(true)} disabled={saving || displays.some((display) => display.products.length === 0)}>Continue to Stores<ArrowRight className="h-4 w-4" /></Button></>} />
    <CampaignWorkflowStepper campaign={{ ...campaign, shelfSupportedProductIds: shelfSupportedIds }} data={{ ...data, campaignDisplays: displays }} current="displays" />
    {formError && <div role="alert" className="rounded-md border border-error/30 bg-error-subtle px-4 py-3 text-sm text-error">{formError}</div>}
    <Card><h2 className="font-semibold">Products</h2><div className="mt-3 grid gap-3 text-sm sm:grid-cols-4"><Summary label="Total" value={campaign.products.length} /><Summary label="Assigned to displays" value={assignedIds.size} /><Summary label="Shelf supported" value={shelfSupportedIds.length} /><Summary label="Unassigned" value={unassigned.length} /></div>{unassigned.length > 0 && <p className="mt-3 text-sm text-warning">Unassigned products can continue, but they are not automatically shelf-supported.</p>}</Card>
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]"><Card><h2 className="font-semibold">Unassigned products</h2><div className="mt-3 space-y-2">{unassigned.map((campaignProduct) => <div key={campaignProduct.id} className="rounded-md border border-border p-3 text-sm"><p className="font-medium">{productLabel(campaignProduct.id, data.products, campaign.products)}</p><div className="mt-2 flex flex-wrap gap-2">{displays.map((display) => <Button key={display.id} type="button" variant="secondary" className="min-h-8 text-xs" onClick={() => addProductToDisplay(display.id, campaignProduct.id)}>Add to {display.name}</Button>)}<Button type="button" variant="secondary" className="min-h-8 text-xs" onClick={() => setShelfSupportedIds((current) => [...current, campaignProduct.id])}>Mark shelf supported</Button></div></div>)}{unassigned.length === 0 && <EmptyState title="No unassigned products" message="All campaign products are assigned to a display or explicitly shelf-supported." />}</div></Card><div className="space-y-4">{displays.map((display) => <DisplayEditor key={display.id} display={display} campaignProducts={campaign.products} products={data.products} onChange={(changes) => updateDisplay(display.id, changes)} onRemove={() => setDisplays((current) => current.filter((item) => item.id !== display.id))} onRemoveProduct={(productId) => removeDisplayProduct(display.id, productId)} />)}{displays.length === 0 && <EmptyState title="No campaign displays" message="Create display groups for the campaign products before assigning store locations." />}</div></div>
  </div>}</DataState>;
}

export function CampaignAssignmentPage() {
  const navigate = useNavigate();
  const { campaign, data, loading, error, saveCampaignDisplayPlacements } = useCampaign();
  const displays = useMemo(() => data && campaign ? data.campaignDisplays.filter((display) => display.campaignId === campaign.id) : [], [data, campaign]);
  const existing = useMemo(() => data && campaign ? data.campaignDisplayPlacements.filter((placement) => placement.campaignId === campaign.id) : [], [data, campaign]);
  const [placements, setPlacements] = useState<CampaignDisplayPlacement[]>(existing);
  const [loadedCampaignId, setLoadedCampaignId] = useState(campaign?.id);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  if (campaign && loadedCampaignId !== campaign.id) {
    setPlacements(existing);
    setLoadedCampaignId(campaign.id);
  }
  const setPlacement = (campaignDisplayId: string, storeId: string, displayAreaId: string) => {
    setPlacements((current) => {
      const others = current.filter((item) => item.campaignDisplayId !== campaignDisplayId || item.storeId !== storeId);
      return [...others, { id: crypto.randomUUID(), campaignId: campaign!.id, campaignDisplayId, storeId, displayAreaId: displayAreaId || undefined, status: displayAreaId ? "assigned" : "needs_location" }];
    });
  };
  const save = async (continueNext = false) => {
    if (!campaign) return;
    try {
      setSaving(true);
      setFormError("");
      await saveCampaignDisplayPlacements({ campaignId: campaign.id, placements });
      if (continueNext) navigate(`/campaigns/${campaign.id}/review`);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Store placements could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  return <DataState loading={loading} error={error}>{!campaign || !data ? <EmptyState title="Campaign not found" message="Unable to assign this campaign." /> : <div className="space-y-6">
    <PageHeader eyebrow="Assign stores" title={campaign.name} description="Place each campaign display into persistent store display areas." actions={<><Button type="button" variant="secondary" onClick={() => void save(false)} disabled={saving}><Save className="h-4 w-4" />Save</Button><Button type="button" onClick={() => void save(true)} disabled={saving}>Continue to Review<ArrowRight className="h-4 w-4" /></Button></>} />
    <CampaignWorkflowStepper campaign={campaign} data={{ ...data, campaignDisplayPlacements: placements }} current="stores" />
    {formError && <div role="alert" className="rounded-md border border-error/30 bg-error-subtle px-4 py-3 text-sm text-error">{formError}</div>}
    <div className="space-y-4">{displays.map((display) => <Card key={display.id} className="overflow-hidden p-0"><div className="border-b border-border px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">{display.name}</h2><p className="text-xs text-text-muted">{humanize(display.displayType)} · {display.placementMode === "STANDARD" ? "Standard placement" : "Store-specific placement"}</p></div><Badge tone={display.placementMode === "STORE_SPECIFIC" ? "warning" : "info"}>{display.placementMode.replace("_", " ")}</Badge></div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-subtle/60 text-xs uppercase text-text-muted"><tr><th className="px-4 py-3">Store</th><th className="px-4 py-3">Suggested compatible areas</th><th className="px-4 py-3">Selected display area</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-border">{data.stores.map((store) => {
      const selected = placements.find((placement) => placement.campaignDisplayId === display.id && placement.storeId === store.id);
      const areas = data.displayAreas.filter((area) => area.storeId === store.id);
      const compatible = areas.filter((area) => area.type === display.displayType || display.displayType === "flex");
      return <tr key={store.id}><td className="px-4 py-3 font-medium">{store.name}</td><td className="px-4 py-3">{compatible.length ? compatible.map((area) => `${area.displayNumber} · ${area.name}`).join(", ") : "Review manually"}</td><td className="px-4 py-3"><select aria-label={`${display.name} location for ${store.name}`} className={inputClass} value={selected?.displayAreaId ?? ""} onChange={(event) => setPlacement(display.id, store.id, event.target.value)}><option value="">Needs location</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.displayNumber} · {area.name}</option>)}</select></td><td className="px-4 py-3"><Badge tone={selected?.displayAreaId ? "success" : display.placementMode === "STORE_SPECIFIC" ? "error" : "warning"}>{selected?.displayAreaId ? "Assigned" : display.placementMode === "STORE_SPECIFIC" ? "Needs location" : "Suggested"}</Badge></td></tr>;
    })}</tbody></table></div></Card>)}{displays.length === 0 && <EmptyState title="No campaign displays" message="Build campaign displays before assigning stores." />}</div>
  </div>}</DataState>;
}

export function CampaignReviewPage() {
  const navigate = useNavigate();
  const { campaign, data, loading, error, publishCampaign } = useCampaign();
  const [formError, setFormError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const readiness = campaign && data ? campaignReadiness(campaign, data) : undefined;
  const publish = async () => {
    if (!campaign) return;
    try {
      setPublishing(true);
      setFormError("");
      await publishCampaign(campaign.id);
      navigate(`/campaigns/${campaign.id}`);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Campaign could not be published.");
    } finally {
      setPublishing(false);
    }
  };
  return <DataState loading={loading} error={error}>{!campaign || !data || !readiness ? <EmptyState title="Campaign not found" message="Unable to review this campaign." /> : <div className="space-y-6">
    <PageHeader eyebrow="Review & publish" title={campaign.name} description="Confirm campaign readiness before releasing it to downstream store execution." actions={<Button type="button" disabled={publishing || !readiness.ready} onClick={() => void publish()}><Check className="h-4 w-4" />{publishing ? "Publishing..." : "Publish campaign"}</Button>} />
    <CampaignWorkflowStepper campaign={campaign} data={data} current="review" />
    {formError && <div role="alert" className="rounded-md border border-error/30 bg-error-subtle px-4 py-3 text-sm text-error">{formError}</div>}
    <div className="grid gap-4 lg:grid-cols-3"><ReadinessCard title="Campaign details" state="Ready" lines={[`${campaign.type}`, `${formatDate(campaign.startDate)} to ${formatDate(campaign.endDate)}`, `Owner: ${campaign.owner}`]} /><ReadinessCard title="Products" state={readiness.productCounts.total ? readiness.productCounts.invalid ? "Blocking issue" : readiness.productCounts.pending ? "Warning" : "Ready" : "Blocking issue"} lines={[`${readiness.productCounts.total} total`, `${readiness.productCounts.verified} verified`, `${readiness.productCounts.pending} pending/review`, `${readiness.productCounts.unassigned} unassigned`]} /><ReadinessCard title="Displays" state={readiness.displayCounts.total ? "Ready" : "Blocking issue"} lines={[`${readiness.displayCounts.total} displays`, `${readiness.displayCounts.standard} standard`, `${readiness.displayCounts.storeSpecific} store-specific`]} /><ReadinessCard title="Stores" state={readiness.storeCounts.missing ? "Warning" : "Ready"} lines={[`${readiness.storeCounts.stores} participating stores`, `${readiness.storeCounts.assigned} assigned placements`, `${readiness.storeCounts.missing} missing placements`]} /><ReadinessCard title="Ordering / allocation" state="Warning" lines={["Case quantities are managed during display execution/allocation.", "Supplier gaps remain review-only for standard campaigns."]} /></div>
    <Card><h2 className="font-semibold">Readiness issues</h2><IssueList title="Blocking issue" tone="error" items={readiness.blockers} empty="No blocking issues." /><IssueList title="Warning" tone="warning" items={readiness.warnings} empty="No warnings." /></Card>
  </div>}</DataState>;
}

function CampaignSetupCard({ campaignId }: { campaignId: string }) {
  return <Card><h2 className="font-semibold">Workflow actions</h2><div className="mt-3 grid gap-2 text-sm"><LinkButton to={`/campaigns/${campaignId}/products`}>Products</LinkButton><LinkButton to={`/campaigns/${campaignId}/display`}>Build displays</LinkButton><LinkButton to={`/campaigns/${campaignId}/assign`}>Assign stores</LinkButton><LinkButton to={`/campaigns/${campaignId}/review`} primary>Review & publish</LinkButton></div></Card>;
}

function SetupRows({ campaign, data }: { campaign: NonNullable<ReturnType<typeof useCampaign>["campaign"]>; data: NonNullable<ReturnType<typeof useCampaign>["data"]> }) {
  const readiness = campaignReadiness(campaign, data);
  const rows = [
    ["Campaign", "Complete", "Metadata saved"],
    ["Products", readiness.productCounts.total ? "Complete" : "Blocking issue", `${readiness.productCounts.total} products`],
    ["Displays", readiness.displayCounts.total ? readiness.productCounts.unassigned ? "Warning" : "Complete" : "Blocking issue", `${readiness.productCounts.unassigned} unassigned products`],
    ["Stores", readiness.storeCounts.missing ? "Warning" : "Complete", `${readiness.storeCounts.missing} locations missing`],
    ["Review", readiness.ready ? "Ready" : "Not ready", readiness.blockers.length ? `${readiness.blockers.length} blocking issue(s)` : "Ready to review"],
  ];
  return <div className="divide-y divide-border">{rows.map(([step, state, detail]) => <div key={step} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[160px_160px_1fr]"><strong>{step}</strong><Badge tone={state === "Complete" || state === "Ready" ? "success" : state === "Warning" ? "warning" : "error"}>{state}</Badge><span className="text-text-muted">{detail}</span></div>)}</div>;
}

function DisplayEditor({ display, campaignProducts, products, onChange, onRemove, onRemoveProduct }: { display: CampaignDisplay; campaignProducts: NonNullable<ReturnType<typeof useCampaign>["campaign"]>["products"]; products: NonNullable<ReturnType<typeof useCampaign>["data"]>["products"]; onChange(changes: Partial<CampaignDisplay>): void; onRemove(): void; onRemoveProduct(productId: string): void }) {
  const updateProduct = (id: string, changes: Partial<CampaignDisplayProduct>) => onChange({ products: display.products.map((product) => product.id === id ? { ...product, ...changes } : product) });
  return <Card><div className="flex flex-wrap items-start justify-between gap-3"><div className="grid flex-1 gap-3 md:grid-cols-2"><Field label="Display name"><input className={inputClass} value={display.name} onChange={(event) => onChange({ name: event.target.value })} /></Field><Field label="Display type"><select className={inputClass} value={display.displayType} onChange={(event) => onChange({ displayType: event.target.value as DisplayType })}>{displayTypeOptions().map((type) => <option key={type} value={type}>{humanize(type)}</option>)}</select></Field><Field label="Placement mode"><select className={inputClass} value={display.placementMode} onChange={(event) => onChange({ placementMode: event.target.value as CampaignPlacementMode })}><option value="STANDARD">Standard</option><option value="STORE_SPECIFIC">Store specific</option></select></Field><Field label="Minimum space / capacity"><input className={inputClass} value={display.minimumSpace} onChange={(event) => onChange({ minimumSpace: event.target.value })} /></Field><Field label="Signage"><input className={inputClass} value={display.signage} onChange={(event) => onChange({ signage: event.target.value })} /></Field><label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={display.prescriptive} onChange={(event) => onChange({ prescriptive: event.target.checked })} />Prescriptive</label><div className="md:col-span-2"><Field label="Execution notes"><textarea className={`${inputClass} min-h-20 py-2`} value={display.executionNotes} onChange={(event) => onChange({ executionNotes: event.target.value })} /></Field></div></div><button type="button" aria-label={`Remove ${display.name}`} className="grid h-9 w-9 place-items-center rounded-md text-error hover:bg-error-subtle" onClick={onRemove}><Trash2 className="h-4 w-4" /></button></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-subtle/60 text-xs uppercase text-text-muted"><tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">Required</th><th className="px-3 py-2">Min qty</th><th className="px-3 py-2">Min facings</th><th className="px-3 py-2">Note</th><th /></tr></thead><tbody className="divide-y divide-border">{display.products.map((item) => <tr key={item.id}><td className="px-3 py-2">{productLabel(item.campaignProductId, products, campaignProducts)}</td><td className="px-3 py-2"><input aria-label={`Required ${productLabel(item.campaignProductId, products, campaignProducts)}`} type="checkbox" checked={item.required} onChange={(event) => updateProduct(item.id, { required: event.target.checked })} /></td><td className="px-3 py-2"><input aria-label={`Minimum quantity ${productLabel(item.campaignProductId, products, campaignProducts)}`} type="number" min="0" className={inputClass} value={item.minimumQuantity ?? 0} onChange={(event) => updateProduct(item.id, { minimumQuantity: Number(event.target.value) })} /></td><td className="px-3 py-2"><input aria-label={`Minimum facings ${productLabel(item.campaignProductId, products, campaignProducts)}`} type="number" min="0" className={inputClass} value={item.minimumFacings ?? 0} onChange={(event) => updateProduct(item.id, { minimumFacings: Number(event.target.value) })} /></td><td className="px-3 py-2"><input aria-label={`Note ${productLabel(item.campaignProductId, products, campaignProducts)}`} className={inputClass} value={item.note ?? ""} onChange={(event) => updateProduct(item.id, { note: event.target.value })} /></td><td className="px-3 py-2"><button type="button" aria-label={`Remove product from ${display.name}`} className="grid h-8 w-8 place-items-center rounded-md text-error hover:bg-error-subtle" onClick={() => onRemoveProduct(item.id)}><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>{display.products.length === 0 && <p className="mt-3 text-sm text-error">Add at least one product before saving this display.</p>}</Card>;
}

function ReadinessCard({ title, state, lines }: { title: string; state: "Ready" | "Warning" | "Blocking issue"; lines: string[] }) {
  return <Card><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{title}</h2><Badge tone={state === "Ready" ? "success" : state === "Warning" ? "warning" : "error"}>{state}</Badge></div><ul className="mt-3 space-y-1 text-sm text-text-secondary">{lines.map((line) => <li key={line}>{line}</li>)}</ul></Card>;
}

function IssueList({ title, items, tone, empty }: { title: string; items: string[]; tone: "warning" | "error"; empty: string }) {
  return <section className="mt-4"><div className="flex items-center gap-2"><Badge tone={tone}>{title}</Badge><span className="text-sm text-text-muted">{items.length}</span></div>{items.length ? <ul className="mt-2 space-y-1 text-sm">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-text-muted">{empty}</p>}</section>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-text-muted">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>;
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border border-border bg-subtle/50 p-3"><strong className="block text-lg">{value}</strong><span className="text-xs text-text-muted">{label}</span></div>;
}

function LinkButton({ to, children, primary = false }: { to: string; children: ReactNode; primary?: boolean }) {
  return <Link className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold ${primary ? "bg-primary text-primary-foreground" : "border border-border bg-surface text-text-primary hover:bg-subtle"}`} to={to}>{children}</Link>;
}
