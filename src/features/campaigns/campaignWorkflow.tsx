/* eslint-disable react-refresh/only-export-components */
import { CheckCircle2, Circle, OctagonAlert, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import type { Campaign, PlatformSnapshot, Product, UUID } from "../../domain/types";
import { productMasterStatusLabel, resolveCampaignProduct } from "../../domain/productMaster";
import { Badge } from "../../components/ui";

export type CampaignWorkflowStep = "campaign" | "products" | "displays" | "stores" | "review";
export type CampaignStepStatus = "complete" | "current" | "warning" | "blocked" | "not_started";

const steps: Array<{ id: CampaignWorkflowStep; label: string }> = [
  { id: "campaign", label: "Campaign" },
  { id: "products", label: "Products" },
  { id: "displays", label: "Displays" },
  { id: "stores", label: "Stores" },
  { id: "review", label: "Review" },
];

export function campaignStepPath(campaignId: UUID | undefined, step: CampaignWorkflowStep) {
  if (step === "campaign") return campaignId ? `/campaigns/${campaignId}` : "/campaigns/new";
  if (!campaignId) return "/campaigns/new";
  if (step === "products") return `/campaigns/${campaignId}/products`;
  if (step === "displays") return `/campaigns/${campaignId}/display`;
  if (step === "stores") return `/campaigns/${campaignId}/assign`;
  return `/campaigns/${campaignId}/review`;
}

export function campaignReadiness(campaign: Campaign, data: PlatformSnapshot) {
  const displays = data.campaignDisplays.filter((display) => display.campaignId === campaign.id);
  const placements = data.campaignDisplayPlacements.filter((placement) => placement.campaignId === campaign.id);
  const resolvedProducts = campaign.products.map((campaignProduct) => resolveCampaignProduct(campaignProduct, data.products));
  const invalidProducts = resolvedProducts.filter((product): product is Product => !product || product.masterStatus === "unresolved");
  const reviewProducts = resolvedProducts.filter((product): product is Product => Boolean(product && (product.masterStatus === "pending" || !product.active)));
  const assignedProductIds = new Set(displays.flatMap((display) => display.products.map((product) => product.campaignProductId)));
  const shelfSupportedIds = new Set(campaign.shelfSupportedProductIds ?? []);
  const plannedProductIds = new Set([...assignedProductIds, ...shelfSupportedIds]);
  const unassignedProducts = campaign.products.filter((product) => !plannedProductIds.has(product.id));
  const requiredUnassigned = unassignedProducts.filter((product) => product.required);
  const emptyDisplays = displays.filter((display) => display.products.length === 0);
  const storePlacements = displays.flatMap((display) => data.stores.map((store) => ({
    display,
    store,
    placement: placements.find((item) => item.campaignDisplayId === display.id && item.storeId === store.id),
  })));
  const missingStoreSpecific = storePlacements.filter(({ display, placement }) => display.placementMode === "STORE_SPECIFIC" && !placement?.displayAreaId);
  const missingStandard = storePlacements.filter(({ display, placement }) => display.placementMode === "STANDARD" && !placement?.displayAreaId);
  const blockers = [
    ...(!campaign.products.length ? ["No campaign products have been added."] : []),
    ...invalidProducts.map((product) => `Invalid product reference: ${productMasterStatusLabel(product)}.`),
    ...emptyDisplays.map((display) => `${display.name} has no products.`),
    ...missingStoreSpecific.map(({ display, store }) => `${display.name} needs a ${store.name} location.`),
  ];
  const warnings = [
    ...reviewProducts.map((product) => `${product.name} needs Product Master review.`),
    ...requiredUnassigned.map((product) => `${resolveCampaignProduct(product, data.products)?.name ?? product.id} is required but not assigned or shelf-supported.`),
    ...unassignedProducts.filter((product) => !product.required).map((product) => `${resolveCampaignProduct(product, data.products)?.name ?? product.id} is unassigned.`),
    ...missingStandard.map(({ display, store }) => `${display.name} has no ${store.name} placement yet.`),
  ];
  return {
    displays,
    placements,
    blockers,
    warnings,
    ready: blockers.length === 0,
    productCounts: {
      total: campaign.products.length,
      verified: resolvedProducts.filter((product) => product?.masterStatus === "verified" && product.active).length,
      pending: reviewProducts.length,
      invalid: invalidProducts.length,
      assigned: assignedProductIds.size,
      shelfSupported: shelfSupportedIds.size,
      unassigned: unassignedProducts.length,
    },
    displayCounts: {
      total: displays.length,
      standard: displays.filter((display) => display.placementMode === "STANDARD").length,
      storeSpecific: displays.filter((display) => display.placementMode === "STORE_SPECIFIC").length,
    },
    storeCounts: {
      stores: data.stores.length,
      assigned: storePlacements.filter(({ placement }) => placement?.displayAreaId).length,
      missing: missingStandard.length + missingStoreSpecific.length,
    },
  };
}

export function campaignStepStatuses(campaign: Campaign | undefined, data: PlatformSnapshot | undefined, current: CampaignWorkflowStep): Record<CampaignWorkflowStep, CampaignStepStatus> {
  const statuses = Object.fromEntries(steps.map((step) => [step.id, "not_started"])) as Record<CampaignWorkflowStep, CampaignStepStatus>;
  if (!campaign || !data) return { ...statuses, [current]: "current" };
  const readiness = campaignReadiness(campaign, data);
  statuses.campaign = campaign.name && campaign.owner && campaign.startDate && campaign.endDate ? "complete" : "blocked";
  statuses.products = readiness.productCounts.total === 0 || readiness.productCounts.invalid > 0 ? "blocked" : readiness.productCounts.pending > 0 ? "warning" : "complete";
  statuses.displays = readiness.displayCounts.total === 0 || readiness.displays.some((display) => display.products.length === 0) ? "blocked" : readiness.productCounts.unassigned > 0 ? "warning" : "complete";
  statuses.stores = readiness.storeCounts.missing > 0 ? "warning" : "complete";
  statuses.review = readiness.ready ? "complete" : "blocked";
  statuses[current] = "current";
  return statuses;
}

export function CampaignWorkflowStepper({ campaign, data, current }: { campaign?: Campaign; data?: PlatformSnapshot; current: CampaignWorkflowStep }) {
  const statuses = campaignStepStatuses(campaign, data, current);
  return <nav aria-label="Campaign planning steps" className="overflow-x-auto rounded-md border border-border bg-surface p-2">
    <ol className="flex min-w-max gap-2">
      {steps.map((step, index) => {
        const status = statuses[step.id];
        const Icon = status === "complete" ? CheckCircle2 : status === "warning" ? TriangleAlert : status === "blocked" ? OctagonAlert : Circle;
        return <li key={step.id} className="min-w-36 flex-1">
          <Link to={campaignStepPath(campaign?.id, step.id)} aria-current={step.id === current ? "step" : undefined} className={clsx("flex h-full items-center gap-2 rounded-md border px-3 py-2 text-sm", step.id === current ? "border-primary bg-primary-subtle text-primary" : "border-transparent text-text-secondary hover:bg-subtle")}>
            <span className="text-xs font-semibold">{index + 1}</span>
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="font-semibold">{step.label}</span>
            <Badge tone={status === "complete" ? "success" : status === "warning" ? "warning" : status === "blocked" ? "error" : "neutral"}>{status.replace("_", " ")}</Badge>
          </Link>
        </li>;
      })}
    </ol>
  </nav>;
}
