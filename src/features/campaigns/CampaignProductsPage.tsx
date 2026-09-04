import { ArrowRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Button, DataState, EmptyState, PageHeader, formatDate } from "../../components/ui";
import { usePlatform } from "../../services/PlatformProvider";
import { CampaignWorkflowStepper, campaignProductReadiness } from "./campaignWorkflow";
import { ProductIntakeWorkspace } from "./ProductIntakeWorkspace";

export function CampaignProductsPage() {
  const { campaignId } = useParams();
  const location = useLocation();
  const platform = usePlatform();
  const { data, loading, error, searchProducts, createPendingProduct, addCampaignProducts, applyCampaignProductImport, updateCampaignProduct, removeCampaignProduct } = platform;
  const campaign = data?.campaigns.find((item) => item.id === campaignId);
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

  return <DataState loading={loading} error={error}>{!campaign || !data ? <EmptyState title="Campaign not found" message="Unable to open this campaign product workspace." /> : <CampaignProductsContent>
    {(() => {
      const readiness = campaignProductReadiness(campaign, data);
      const createdName = (location.state as { createdCampaignName?: string } | null)?.createdCampaignName;
      return <>
        <PageHeader
          eyebrow="Products"
          title={campaign.name}
          description={`${formatDate(campaign.startDate)} to ${formatDate(campaign.endDate)}`}
          actions={readiness.total > 0
            ? <LinkButton to={`/campaigns/${campaign.id}/display`} primary>Continue to Displays<ArrowRight className="h-4 w-4" /></LinkButton>
            : <Button type="button" disabled>Continue to Displays<ArrowRight className="h-4 w-4" /></Button>}
        />
        <CampaignWorkflowStepper campaign={campaign} data={data} current="products" />
        {createdName && <div role="status" aria-live="polite" className="rounded-md border border-success/30 bg-success-subtle p-4 text-sm font-semibold text-success">{createdName} created and saved. Continue by adding products, or return to the campaign overview at any time.</div>}
        {readiness.total === 0 && <div role="status" className="rounded-md border border-border bg-subtle/50 p-3 text-sm text-text-secondary">Add at least one campaign product before continuing to Displays.</div>}
        {readiness.needsReview > 0 && <div role="status" className="rounded-md border border-warning/30 bg-warning-subtle p-3 text-sm text-text-secondary">{readiness.needsReview} product{readiness.needsReview === 1 ? "" : "s"} need review. Pending or inactive products may continue into display planning, but they remain flagged for follow-up.</div>}
        {mutationError && <div role="alert" className="rounded-md border border-error/30 bg-error-subtle p-3 text-sm text-error">{mutationError}</div>}
        <ProductIntakeWorkspace
          products={data.products}
          assortment={campaign.products}
          saving={saving}
          searchProducts={searchProducts}
          onCreatePendingProduct={(input) => createPendingProduct(input)}
          onApplyImport={(products) => mutateProducts(async () => { await applyCampaignProductImport({ campaignId: campaign.id, products }); })}
          onAdd={(productIds) => mutateProducts(async () => { await addCampaignProducts({ campaignId: campaign.id, productIds }); })}
          onUpdate={(campaignProductId, patch) => mutateProducts(async () => { await updateCampaignProduct({ campaignId: campaign.id, campaignProductId, patch }); })}
          onRemove={(campaignProductId) => mutateProducts(async () => { await removeCampaignProduct(campaign.id, campaignProductId); })}
        />
      </>;
    })()}
  </CampaignProductsContent>}</DataState>;
}

function CampaignProductsContent({ children }: { children: ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}

function LinkButton({ to, children, primary = false }: { to: string; children: ReactNode; primary?: boolean }) {
  return <Link className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold ${primary ? "bg-primary text-primary-foreground" : "border border-border bg-surface text-text-primary hover:bg-subtle"}`} to={to}>{children}</Link>;
}
