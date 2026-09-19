import { CheckCircle2, MapPin, Send } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, DataState, EmptyState, PageHeader, humanize } from "../../components/ui";
import { evaluateCampaignPublishReadiness, type PublishReadinessSection } from "../../domain/campaignPublishReadiness";
import type { CampaignDisplay, PlatformSnapshot, Store } from "../../domain/types";
import { usePlatform } from "../../services/PlatformProvider";
import { CampaignWorkflowStepper } from "./campaignWorkflow";
import { CampaignExceptionReview } from "./CampaignExceptionReview";

const sections: Array<[PublishReadinessSection, string, string]> = [
  ["CAMPAIGN", "Campaign", ""],
  ["PRODUCTS", "Products", "products"],
  ["DISPLAYS", "Displays", "display"],
  ["STORES", "Stores", "assign"],
  ["ORDERING", "Ordering readiness", "assign"],
];

export function CampaignReviewPage() {
  const { campaignId } = useParams();
  const { data, loading, error, publishCampaign, userEmail } = usePlatform();
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string>();
  const [publishMessage, setPublishMessage] = useState<string>();
  const campaign = data?.campaigns.find((item) => item.id === campaignId);
  const readiness = evaluateCampaignPublishReadiness(campaign, data);
  const displays = data?.campaignDisplays.filter((item) => item.campaignId === campaign?.id).sort((a, b) => a.sortOrder - b.sortOrder) ?? [];
  const includedStores = data?.campaignStores.filter((item) => item.campaignId === campaign?.id && item.included) ?? [];
  const excludedStores = data?.campaignStores.filter((item) => item.campaignId === campaign?.id && !item.included) ?? [];
  const allocations = data?.campaignDisplayAssignments.filter((item) => item.campaignId === campaign?.id && item.status === "ASSIGNED") ?? [];
  const products = data?.campaignDisplayAssignmentProducts.filter((item) => allocations.some((assignment) => assignment.id === item.campaignDisplayAssignmentId)) ?? [];
  const storeProductAllocations = data?.campaignStoreProductAllocations.filter((item) => item.campaignId === campaign?.id) ?? [];
  const latestRelease = data?.campaignReleases.filter((item) => item.campaignId === campaign?.id).sort((a, b) => b.version - a.version)[0];

  const publish = async () => {
    if (!campaign || readiness.state === "BLOCKED") return;
    const warnings = readiness.issues.filter((item) => item.severity === "WARNING");
    if (warnings.length && !window.confirm(`Publish with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}?\n\n${warnings.map((item) => `• ${item.message}`).join("\n")}`)) return;
    setPublishing(true);
    setPublishError(undefined);
    setPublishMessage(undefined);
    try {
      const result = await publishCampaign({ campaignId: campaign.id, publishedBy: userEmail ?? campaign.owner });
      setPublishMessage(`Release ${result.version} published to ${result.noticeCount} store${result.noticeCount === 1 ? "" : "s"} with ${result.assignmentCount} finalized display assignment${result.assignmentCount === 1 ? "" : "s"}.`);
    } catch (cause) {
      setPublishError(cause instanceof Error ? cause.message : "The campaign could not be published.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <DataState loading={loading} error={error}>
      {!campaign || !data ? <EmptyState title="Campaign not found" message="Unable to review this campaign." /> : (
        <div className="space-y-5">
          <PageHeader eyebrow="Review" title={campaign.name} description="Check products, quantities, and physical store placements, then finalize the plan for stores." />
          <CampaignWorkflowStepper campaign={campaign} data={data} current="review" />
          <CampaignExceptionReview data={data} campaignId={campaign.id} />

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Physical store placements</h2>
                <p className="mt-1 text-sm text-text-secondary">{includedStores.length} participating stores · {displays.length} campaign displays</p>
              </div>
              <Link className="text-sm font-semibold text-primary hover:text-primary-hover" to={`/campaigns/${campaign.id}/assign`}>Edit store placements</Link>
            </div>
            {includedStores.length === 0 || displays.length === 0 ? (
              <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-text-secondary">Include stores and add campaign displays before reviewing physical placements.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {includedStores.map((scope) => {
                  const store = data.stores.find((item) => item.id === scope.storeId);
                  return store ? (
                    <section key={scope.id} aria-labelledby={`review-store-${store.id}`} className="rounded-md border border-border p-4">
                      <h3 id={`review-store-${store.id}`} className="font-semibold">{store.name}</h3>
                      <div className="mt-3 space-y-3">
                        {displays.map((display) => <PlacementReview key={display.id} store={store} display={display} data={data} />)}
                      </div>
                    </section>
                  ) : null;
                })}
              </div>
            )}
          </Card>

          {storeProductAllocations.length > 0 && <Card>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Imported store case allocations</h2><p className="mt-1 text-sm text-text-secondary">Retained for displayed and shelf-supported products, independent of physical placement.</p></div><Badge tone="info">{storeProductAllocations.length} store/SKU rows</Badge></div>
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs uppercase text-text-muted"><tr><th className="pb-2">Store</th><th className="pb-2">SKU / product</th><th className="pb-2">Cases</th><th className="pb-2">Display intent</th></tr></thead><tbody className="divide-y divide-border">{storeProductAllocations.map((item) => { const store = data.stores.find((candidate) => candidate.id === item.storeId); const product = data.products.find((candidate) => candidate.id === item.productId); return <tr key={item.id}><td className="py-2 pr-3">{store?.name ?? "Unknown store"}</td><td className="py-2 pr-3"><b>{product?.sku ?? "Unknown SKU"}</b><span className="block text-xs text-text-muted">{product?.name}</span></td><td className="py-2 pr-3">{item.caseQuantity}</td><td className="py-2">{item.displayRequired ? item.intendedDisplayCode ?? "Required, unassigned" : "Shelf promotion"}</td></tr>; })}</tbody></table></div>
          </Card>}

          {excludedStores.length > 0 && (
            <Card>
              <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Stores excluded from campaign</h2><Badge tone="neutral">{excludedStores.length} excluded</Badge></div>
              <p className="mt-2 text-sm text-text-secondary">{excludedStores.map((scope) => data.stores.find((item) => item.id === scope.storeId)?.name).filter(Boolean).join(", ")}</p>
            </Card>
          )}

          {sections.map(([key, label, suffix]) => {
            const issues = readiness.issues.filter((item) => item.section === key);
            const blocking = issues.some((item) => item.severity === "BLOCKING");
            return (
              <Card key={key}>
                <div className="flex items-center justify-between"><h2 className="font-semibold">{label}</h2><Badge tone={blocking ? "error" : issues.length ? "warning" : "success"}>{blocking ? "Blocking" : issues.length ? "Warning" : "Ready"}</Badge></div>
                {issues.length ? <ul className="mt-3 space-y-1 text-sm text-text-secondary">{issues.map((item) => <li key={`${item.code}-${item.message}`}>• {item.message}</li>)}</ul> : <p className="mt-2 text-sm text-success">Ready for release.</p>}
                <Link className="mt-3 inline-block text-sm font-semibold text-primary" to={`/campaigns/${campaign.id}${suffix ? `/${suffix}` : ""}`}>Open {label}</Link>
              </Card>
            );
          })}

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Store release</h2>
                <p className="mt-2 text-sm text-text-secondary">Finalize the reviewed placements, create store execution work, and notify participating stores.</p>
                <p className="mt-1 text-sm text-text-muted">This release will create {allocations.length} operational display assignments with {products.length} assignment products.</p>
              </div>
              <Badge tone={readiness.state === "BLOCKED" ? "error" : readiness.state === "WARNING" ? "warning" : "success"}>{readiness.state === "BLOCKED" ? "Not ready" : readiness.state === "WARNING" ? "Ready with warnings" : "Ready"}</Badge>
            </div>
            {latestRelease && <p className="mt-3 flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" />Release {latestRelease.version} published {new Date(latestRelease.publishedAt).toLocaleString()}.</p>}
            {publishMessage && <p role="status" className="mt-3 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">{publishMessage}</p>}
            {publishError && <p role="alert" className="mt-3 rounded-md border border-error/30 bg-error/10 p-3 text-sm text-error">{publishError}</p>}
            <Button className="mt-4" disabled={publishing || readiness.state === "BLOCKED"} onClick={() => void publish()}>
              <Send className="h-4 w-4" />{publishing ? "Publishing…" : latestRelease ? "Publish updated release" : "Finalize stores and publish"}
            </Button>
            {readiness.state === "BLOCKED" && <p className="mt-2 text-xs text-text-muted">Resolve the blocking items above to enable publishing.</p>}
          </Card>
        </div>
      )}
    </DataState>
  );
}

function PlacementReview({ store, display, data }: { store: Store; display: CampaignDisplay; data: PlatformSnapshot }) {
  const assignment = data.campaignDisplayAssignments.find((item) => item.campaignDisplayId === display.id && item.storeId === store.id);
  const area = data.displayAreas.find((item) => item.id === assignment?.displayAreaId);
  const placementProducts = assignment
    ? data.campaignDisplayAssignmentProducts.filter((item) => item.campaignDisplayAssignmentId === assignment.id)
    : [];
  const isPlaced = assignment?.status === "ASSIGNED" && Boolean(area);
  const floorplan = `/stores/${store.id}/floorplan?campaign=${display.campaignId}${assignment ? `&assignment=${assignment.id}` : ""}${area ? `&area=${area.id}` : ""}`;

  return (
    <div className="rounded-md border border-border bg-subtle/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{display.name}</p>
          <p className="mt-1 text-sm text-text-secondary">
            {area ? `${area.name} · ${area.localCode ?? area.displayNumber}` : assignment?.status === "EXCLUDED" ? "Not used in this store" : "No store placement"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={isPlaced ? "success" : assignment?.status === "EXCLUDED" ? "neutral" : "error"}>{isPlaced ? "Placed" : assignment?.status === "EXCLUDED" ? "Excluded" : "Not placed"}</Badge>
            {area && <Badge tone={area.verificationStatus === "verified" ? "success" : "warning"}>{area.verificationStatus === "verified" ? "Verified" : "Needs verification"}</Badge>}
            {area && !area.active && <Badge tone="error">Inactive display area</Badge>}
          </div>
        </div>
        <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle" to={floorplan}><MapPin className="h-4 w-4" />View floorplan</Link>
      </div>

      {placementProducts.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="text-text-muted"><tr><th className="pb-2 font-semibold">Product</th><th className="pb-2 font-semibold">Role</th><th className="pb-2 font-semibold">Campaign default</th><th className="pb-2 font-semibold">Store quantity</th><th className="pb-2 font-semibold">Quantity state</th></tr></thead>
            <tbody className="divide-y divide-border">
              {placementProducts.map((item) => {
                const product = data.products.find((candidate) => candidate.id === item.productId);
                const displayProduct = data.campaignDisplayProducts.find((candidate) => candidate.id === item.campaignDisplayProductId);
                return (
                  <tr key={item.id}>
                    <td className="py-2 pr-3"><span className="font-semibold">{product?.sku ?? "Unknown SKU"}</span><span className="block text-text-muted">{product?.name ?? "Unknown product"}</span></td>
                    <td className="py-2 pr-3">{displayProduct?.role ?? "Not set"}</td>
                    <td className="py-2 pr-3">{item.recommendedCases ?? "Unresolved"}</td>
                    <td className="py-2 pr-3">{item.caseQuantity ?? "Unresolved"}</td>
                    <td className="py-2"><Badge tone={item.caseQuantity === undefined ? "error" : item.buyerOverride ? "warning" : "neutral"}>{item.caseQuantity === undefined ? "Unresolved quantity" : item.buyerOverride ? "Adjusted by store" : "Campaign default"}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {assignment && assignment.status !== "ASSIGNED" && assignment.status !== "EXCLUDED" && (
        <p className="mt-3 text-xs text-text-muted">Placement status: {humanize(assignment.status)}.</p>
      )}
    </div>
  );
}
