import { ArrowLeft, ArrowRight, Check, MapPin, MoveRight } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getAssignmentCompatibility } from "../../domain/rules";
import { productMasterStatusLabel, resolveCampaignProduct } from "../../domain/productMaster";
import { usePlatform } from "../../services/PlatformProvider";
import { Badge, Button, Card, DataState, EmptyState, Field, PageHeader, formatDate, humanize, inputClass } from "../../components/ui";
import { mockBusinessClock } from "../../services/clock";
import { CampaignWorkflowStepper } from "./campaignWorkflow";
import { ProductIntakeWorkspace } from "./ProductIntakeWorkspace";

function useCampaign() {
  const { campaignId } = useParams();
  const platform = usePlatform();
  return { ...platform, campaign: platform.data?.campaigns.find((item) => item.id === campaignId) };
}

export function CampaignProductsPage() {
  const { campaign, data, loading, error, searchProducts, addCampaignProducts, updateCampaignProduct, removeCampaignProduct } = useCampaign();
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState<string>();
  const mutateProducts = async (operation: () => Promise<void>) => {
    setSaving(true);
    setMutationError(undefined);
    try {
      await operation();
    } catch (cause) {
      setMutationError(cause instanceof Error ? cause.message : "Campaign products could not be updated.");
      throw cause;
    } finally {
      setSaving(false);
    }
  };
  return <DataState loading={loading} error={error}>{!campaign || !data ? <EmptyState title="Campaign not found" message="Unable to open this campaign product workspace." /> : <div className="space-y-6">
    <PageHeader eyebrow="Products" title={campaign.name} description={`${formatDate(campaign.startDate)} to ${formatDate(campaign.endDate)}`} actions={<LinkButton to={`/campaigns/${campaign.id}/display`} primary>Continue to Displays<ArrowRight className="h-4 w-4" /></LinkButton>} />
    <CampaignWorkflowStepper campaign={campaign} data={data} current="products" />
    {mutationError && <div role="alert" className="rounded-md border border-error/30 bg-error-subtle p-3 text-sm text-error">{mutationError}</div>}
    <ProductIntakeWorkspace
      products={data.products}
      assortment={campaign.products}
      saving={saving}
      searchProducts={searchProducts}
      onAdd={(productIds) => mutateProducts(async () => { await addCampaignProducts({ campaignId: campaign.id, productIds }); })}
      onUpdate={(campaignProductId, patch) => mutateProducts(async () => { await updateCampaignProduct({ campaignId: campaign.id, campaignProductId, patch }); })}
      onRemove={(campaignProductId) => mutateProducts(async () => { await removeCampaignProduct(campaign.id, campaignProductId); })}
    />
  </div>}</DataState>;
}

export function CampaignDetailPage() {
  const { campaign, data, loading, error, role } = useCampaign();
  const canEdit = role === "admin" || role === "merchandising";
  return <DataState loading={loading} error={error}>{!campaign || !data ? <EmptyState title="Campaign not found" message="The requested campaign does not exist in this data adapter." /> : <div className="space-y-5">
    <PageHeader eyebrow="Campaign overview" title={campaign.name} description={campaign.description} actions={canEdit && <><LinkButton to={`/campaigns/${campaign.id}/products`}>Products</LinkButton><LinkButton to={`/campaigns/${campaign.id}/display`}>Build displays</LinkButton><LinkButton to={`/campaigns/${campaign.id}/assign`} primary>Assign stores</LinkButton><Button type="button" variant="secondary" disabled>Review</Button></>} />
    <CampaignWorkflowStepper campaign={campaign} data={data} current="campaign" />
    <div className="grid gap-4 xl:grid-cols-3"><Card className="xl:col-span-2"><div className="flex items-center gap-2"><Badge tone={campaign.status === "active" ? "success" : campaign.status === "scheduled" ? "info" : "neutral"}>{campaign.status}</Badge><Badge>{campaign.type}</Badge></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><Detail label="Period" value={`${formatDate(campaign.startDate)} to ${formatDate(campaign.endDate)}`} /><Detail label="Owner" value={campaign.owner} /><Detail label="Supplier / partner" value={campaign.supplier || "Not specified"} /><Detail label="Display type" value={humanize(campaign.requirement.displayType)} /></dl></Card><Card><h2 className="font-semibold">Execution guidance</h2><dl className="mt-3 space-y-3 text-sm"><Detail label="Signage" value={campaign.requirement.signage || "None specified"} /><Detail label="Minimum space" value={campaign.requirement.minimumSpace} /><Detail label="Approach" value={campaign.requirement.prescriptive ? "Prescriptive" : "Guided local execution"} /></dl></Card></div>
    <ProductTable campaign={campaign} products={data.products} />
    <Card><h2 className="font-semibold">Assignments</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{data.assignments.filter((item) => item.campaignId === campaign.id).map((assignment) => { const store = data.stores.find((item) => item.id === assignment.storeId); const area = data.displayAreas.find((item) => item.id === assignment.displayAreaId); return <Link key={assignment.id} to={`/display-areas/${area?.id}`} className="flex items-center justify-between rounded-md border border-border p-3"><div><p className="font-medium">{store?.name} / {area?.name}</p><p className="text-xs text-text-muted">Effective {formatDate(assignment.effectiveDate)}</p></div><Badge tone="success">{humanize(assignment.compatibility)}</Badge></Link>; })}</div></Card>
  </div>}</DataState>;
}

export function DisplayDesignerPage() {
  const { campaign, data, loading, error } = useCampaign();
  return <DataState loading={loading} error={error}>{!campaign || !data ? <EmptyState title="Campaign not found" message="Unable to design this display." /> : <div className="space-y-6"><PageHeader eyebrow="Build displays" title={`${campaign.name} display`} description="Arrange the existing assortment into practical display guidance. This is not a pixel-perfect planogram." actions={<LinkButton to={`/campaigns/${campaign.id}`}><ArrowLeft className="h-4 w-4" />Campaign</LinkButton>} />
    <CampaignWorkflowStepper campaign={campaign} data={data} current="displays" />
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]"><Card><div className="mx-auto max-w-3xl"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">{humanize(campaign.requirement.displayType)} guide</p><Badge tone={campaign.requirement.prescriptive ? "error" : "info"}>{campaign.requirement.prescriptive ? "Prescriptive" : "Guidance"}</Badge></div><div className="grid min-h-[430px] grid-cols-2 gap-2 border-8 border-locked bg-subtle p-4 sm:grid-cols-3">{campaign.products.map((campaignProduct, index) => { const product = resolveCampaignProduct(campaignProduct, data.products); return <div key={campaignProduct.id} className={`flex flex-col justify-between border-2 p-3 ${campaignProduct.required ? "border-error bg-error/5" : "border-info bg-info/5"}`} style={{ minHeight: `${Math.max(100, 190 - index * 25)}px` }}><Badge tone={campaignProduct.required ? "error" : "info"}>{campaignProduct.required ? "Required" : "Optional"}</Badge><div><p className="font-semibold">{product?.name ?? "Unresolved product"}</p><p className="mt-1 text-xs text-text-muted">{product?.sku ?? "Unknown SKU"} · {campaignProduct.role}</p></div></div>; })}</div><p className="mt-3 text-xs text-text-muted">Relative blocks communicate prominence only; store teams may adjust spacing unless marked prescriptive.</p></div></Card><div className="space-y-4"><Card><h2 className="font-semibold">Requirements</h2><dl className="mt-3 space-y-3 text-sm"><Detail label="Minimum space" value={campaign.requirement.minimumSpace} /><Detail label="Signage" value={campaign.requirement.signage} /><Detail label="Execution notes" value={campaign.requirement.executionNotes} /></dl></Card><Card><h2 className="font-semibold">Placement order</h2><ol className="mt-3 space-y-2">{campaign.products.map((campaignProduct, index) => <li key={campaignProduct.id} className="flex items-center gap-2 text-sm"><span className="grid h-6 w-6 place-items-center rounded bg-subtle text-xs font-semibold">{index + 1}</span>{resolveCampaignProduct(campaignProduct, data.products)?.name ?? "Unresolved product"}</li>)}</ol></Card></div></div>
  </div>}</DataState>;
}

export function CampaignAssignmentPage() {
  const navigate = useNavigate();
  const { campaign, data, loading, error, assignCampaign } = useCampaign();
  const [areaId, setAreaId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(mockBusinessClock.today());
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string>();
  const selectedArea = data?.displayAreas.find((item) => item.id === areaId);
  const compatibility = useMemo(() => campaign && selectedArea ? getAssignmentCompatibility(campaign, selectedArea) : undefined, [campaign, selectedArea]);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!campaign || !selectedArea) return; try { await assignCampaign({ campaignId: campaign.id, storeId: selectedArea.storeId, displayAreaId: selectedArea.id, effectiveDate, notes }); navigate(`/stores/${selectedArea.storeId}/floorplan?area=${selectedArea.id}`); } catch (cause) { setFormError(cause instanceof Error ? cause.message : "Unable to assign campaign."); } };
  return <DataState loading={loading} error={error}>{!campaign || !data ? <EmptyState title="Campaign not found" message="Unable to assign this campaign." /> : <form onSubmit={submit} className="space-y-6"><PageHeader eyebrow="Assign" title={`Assign ${campaign.name}`} description="Choose a store and persistent display area. Compatibility uses the existing campaign display requirement." actions={<Button disabled={!areaId || compatibility === "incompatible"}><Check className="h-4 w-4" />Create assignment</Button>} />
    <CampaignWorkflowStepper campaign={campaign} data={data} current="stores" />
    {formError && <div role="alert" className="rounded-md border border-error/30 bg-error/5 p-3 text-sm text-error">{formError}</div>}
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]"><Card><h2 className="font-semibold">Store display areas</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{data.displayAreas.map((area) => { const result = getAssignmentCompatibility(campaign, area); const store = data.stores.find((item) => item.id === area.storeId); return <button type="button" key={area.id} onClick={() => setAreaId(area.id)} className={`rounded-md border p-4 text-left transition ${areaId === area.id ? "border-primary ring-2 ring-primary/15" : "border-border hover:border-primary/50"}`}><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{area.name}</p><p className="text-xs text-text-muted">{store?.name} · {humanize(area.type)}</p></div><Badge tone={result === "compatible" ? "success" : result === "requires_review" ? "warning" : "error"}>{humanize(result)}</Badge></div><p className="mt-3 text-sm text-text-secondary">{area.description}</p></button>; })}</div></Card><div className="space-y-4"><Card><h2 className="font-semibold">Assignment details</h2><div className="mt-4 space-y-4"><Field label="Store"><input className={inputClass} value={data.stores.find((item) => item.id === selectedArea?.storeId)?.name ?? "Select a display area"} disabled /></Field><Field label="Effective date"><input type="date" className={inputClass} value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} /></Field><Field label="Store-specific notes"><textarea className={`${inputClass} min-h-24 py-2`} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field></div></Card>{selectedArea && <Card><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /><h2 className="font-semibold">{selectedArea.name}</h2></div><p className="mt-2 text-sm text-text-secondary">{selectedArea.capacity}</p><div className="mt-3 flex items-center gap-2 text-sm"><span>{humanize(campaign.requirement.displayType)}</span><MoveRight className="h-4 w-4 text-text-muted" /><span>{humanize(selectedArea.type)}</span></div></Card>}</div></div>
  </form>}</DataState>;
}

function ProductTable({ campaign, products }: { campaign: NonNullable<ReturnType<typeof useCampaign>["campaign"]>; products: NonNullable<ReturnType<typeof useCampaign>["data"]>["products"] }) {
  return <Card className="overflow-hidden p-0"><div className="border-b border-border px-4 py-3"><h2 className="font-semibold">Campaign assortment</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-subtle/60 text-xs uppercase text-text-muted"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Requirement</th><th className="px-4 py-3">Product status</th></tr></thead><tbody className="divide-y divide-border">{campaign.products.map((campaignProduct) => { const product = resolveCampaignProduct(campaignProduct, products); return <tr key={campaignProduct.id}><td className="px-4 py-3"><p className="font-medium">{product?.name ?? "Unresolved product"}</p><p className="text-xs text-text-muted">{product?.sku ?? "Unknown SKU"} · {product?.category ?? "Uncategorized"}</p></td><td className="px-4 py-3">{campaignProduct.role}</td><td className="px-4 py-3"><Badge tone={campaignProduct.required ? "error" : "info"}>{campaignProduct.required ? "Required" : "Optional"}</Badge></td><td className="px-4 py-3"><Badge tone={!product || product.masterStatus === "unresolved" ? "error" : !product.active || product.masterStatus === "pending" ? "warning" : "success"}>{productMasterStatusLabel(product)}</Badge></td></tr>; })}</tbody></table></div></Card>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-text-muted">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>;
}

function LinkButton({ to, children, primary = false }: { to: string; children: ReactNode; primary?: boolean }) {
  return <Link className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold ${primary ? "bg-primary text-primary-foreground" : "border border-border bg-surface text-text-primary hover:bg-subtle"}`} to={to}>{children}</Link>;
}
