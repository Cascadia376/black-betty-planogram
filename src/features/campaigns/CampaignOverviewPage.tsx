import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Card, DataState, EmptyState, PageHeader, formatDate } from "../../components/ui";
import type { Campaign, PlatformSnapshot } from "../../domain/types";
import { productMasterStatusLabel, resolveCampaignProduct } from "../../domain/productMaster";
import { usePlatform } from "../../services/PlatformProvider";
import { CampaignWorkflowStepper, campaignDisplayReadiness, campaignProductReadiness, campaignStoreReadiness } from "./campaignWorkflow";

export function CampaignOverviewPage() {
  const { campaignId } = useParams();
  const { data, loading, error, role } = usePlatform();
  const campaign = data?.campaigns.find((item) => item.id === campaignId);
  const canEdit = role === "admin" || role === "merchandising";

  return <DataState loading={loading} error={error}>{!campaign || !data ? <EmptyState title="Campaign not found" message="The requested campaign does not exist in this data adapter." /> : <div className="space-y-5">
    <PageHeader
      eyebrow="Campaign overview"
      title={campaign.name}
      description={campaign.description || `${formatDate(campaign.startDate)} to ${formatDate(campaign.endDate)}`}
      actions={canEdit && <div className="flex flex-wrap gap-2">
        <WorkflowLink to={`/campaigns/${campaign.id}/products`}>Products</WorkflowLink>
        <WorkflowLink to={`/campaigns/${campaign.id}/display`}>Build displays</WorkflowLink>
        <WorkflowLink to={`/campaigns/${campaign.id}/assign`}>Assign stores</WorkflowLink>
      </div>}
    />
    <CampaignWorkflowStepper campaign={campaign} data={data} current="campaign" />
    <CampaignSummary campaign={campaign} data={data} />
    <CampaignAssortment campaign={campaign} data={data} />
  </div>}</DataState>;
}

function CampaignSummary({ campaign, data }: { campaign: Campaign; data: PlatformSnapshot }) {
  const readiness = campaignProductReadiness(campaign, data);
  const displayReadiness = campaignDisplayReadiness(campaign, data);
  const storeReadiness = campaignStoreReadiness(campaign, data);
  const assignments = data.assignments.filter((item) => item.campaignId === campaign.id).length;
  return <div className="grid gap-4 lg:grid-cols-3">
    <Card className="lg:col-span-2">
      <div className="flex flex-wrap items-center gap-2"><Badge tone={campaign.status === "active" ? "success" : campaign.status === "scheduled" ? "info" : "neutral"}>{campaign.status}</Badge><Badge>{campaign.type}</Badge></div>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <Detail label="Period" value={`${formatDate(campaign.startDate)} to ${formatDate(campaign.endDate)}`} />
        <Detail label="Owner" value={campaign.owner} />
        <Detail label="Supplier / partner" value={campaign.supplier || "Not specified"} />
        <Detail label="Store assignments" value={assignments ? `${assignments} created` : "Not started"} />
      </dl>
    </Card>
    <Card>
      <h2 className="font-semibold">Product readiness</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Detail label="Total" value={String(readiness.total)} />
        <Detail label="Verified" value={String(readiness.verified)} />
        <Detail label="Pending" value={String(readiness.pending)} />
        <Detail label="Needs review" value={String(readiness.needsReview)} />
      </dl>
      <div className="mt-4"><WorkflowLink to={`/campaigns/${campaign.id}/products`}>{readiness.total ? "Review products" : "Add products"}</WorkflowLink></div>
    </Card>
    <Card>
      <h2 className="font-semibold">Stores</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Detail label="Included" value={String(storeReadiness.included)} />
        <Detail label="Ready" value={String(storeReadiness.ready)} />
        <Detail label="Need review" value={String(storeReadiness.needsReview)} />
        <Detail label="Not started" value={String(storeReadiness.notStarted)} />
      </dl>
      <p className="mt-3 text-xs text-text-muted">{storeReadiness.completePlacements} / {storeReadiness.totalPlacements} placements complete</p>
      <div className="mt-4"><WorkflowLink to={`/campaigns/${campaign.id}/assign`}>{storeReadiness.complete ? "Review store plan" : "Assign stores"}</WorkflowLink></div>
    </Card>
    <Card>
      <h2 className="font-semibold">Display planning</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Detail label="Displays" value={String(displayReadiness.displays)} />
        <Detail label="Display assigned" value={String(displayReadiness.assigned)} />
        <Detail label="Shelf supported" value={String(displayReadiness.shelfSupported)} />
        <Detail label="Unassigned" value={String(displayReadiness.unassigned)} />
      </dl>
      <div className="mt-4"><WorkflowLink to={`/campaigns/${campaign.id}/display`}>{displayReadiness.status === "complete" ? "Review displays" : "Build displays"}</WorkflowLink></div>
    </Card>
  </div>;
}

function CampaignAssortment({ campaign, data }: { campaign: Campaign; data: PlatformSnapshot }) {
  return <Card className="overflow-hidden p-0">
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><div><h2 className="font-semibold">Campaign assortment</h2><p className="mt-1 text-xs text-text-muted">Product details come from Product Master; campaign-specific role and requirement stay with the campaign.</p></div><WorkflowLink to={`/campaigns/${campaign.id}/products`}>Edit products</WorkflowLink></div>
    {campaign.products.length === 0 ? <div className="p-4"><EmptyState title="No campaign products" message="Add products before moving into display planning." /></div> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-subtle/60 text-xs uppercase text-text-muted"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Requirement</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-border">{campaign.products.map((campaignProduct) => { const product = resolveCampaignProduct(campaignProduct, data.products); const status = productMasterStatusLabel(product); return <tr key={campaignProduct.id}><td className="px-4 py-3"><p className="font-medium">{product?.name ?? "Unresolved product"}</p><p className="text-xs text-text-muted">{product?.sku ?? "Unknown SKU"} · {product?.category ?? "Uncategorized"}</p></td><td className="px-4 py-3">{campaignProduct.role}</td><td className="px-4 py-3">{campaignProduct.required ? "Required" : "Optional"}</td><td className="px-4 py-3"><Badge tone={!product || product.masterStatus === "unresolved" ? "error" : !product.active || product.masterStatus === "pending" ? "warning" : "success"}>{status}</Badge></td></tr>; })}</tbody></table></div>}
  </Card>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-text-muted">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>;
}

function WorkflowLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link className="inline-flex min-h-9 items-center justify-center rounded-md border border-border bg-surface px-3 text-sm font-semibold text-text-primary hover:bg-subtle" to={to}>{children}</Link>;
}
