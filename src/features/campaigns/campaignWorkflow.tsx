/* eslint-disable react-refresh/only-export-components */
import { CheckCircle2, Circle, OctagonAlert, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import type { Campaign, PlatformSnapshot, UUID } from "../../domain/types";
import { Badge } from "../../components/ui";

export type CampaignWorkflowStep = "campaign" | "products" | "displays" | "stores" | "review";
export type CampaignStepStatus = "complete" | "current" | "warning" | "blocked" | "not_started";

export interface CampaignProductSummary {
  total: number;
  verified: number;
  pending: number;
  reviewRequired: number;
}

const steps: Array<{ id: CampaignWorkflowStep; label: string }> = [
  { id: "campaign", label: "Campaign" },
  { id: "products", label: "Products" },
  { id: "displays", label: "Displays" },
  { id: "stores", label: "Stores" },
  { id: "review", label: "Review" },
];

export interface CampaignProductReadiness {
  total: number;
  verified: number;
  pending: number;
  inactive: number;
  unresolved: number;
  needsReview: number;
}

export interface CampaignDisplayReadiness {
  total: number;
  assigned: number;
  shelfSupported: number;
  unassigned: number;
  displays: number;
  emptyDisplays: number;
  status: "complete" | "warning" | "not_started";
}

export function campaignDisplayReadiness(campaign: Campaign | undefined, data: PlatformSnapshot | undefined): CampaignDisplayReadiness {
  const empty: CampaignDisplayReadiness = { total: 0, assigned: 0, shelfSupported: 0, unassigned: 0, displays: 0, emptyDisplays: 0, status: "not_started" };
  if (!campaign || !data || !campaign.products.length) return empty;
  const displays = data.campaignDisplays.filter((item) => item.campaignId === campaign.id);
  const memberships = new Set(data.campaignDisplayProducts.filter((item) => displays.some((display) => display.id === item.campaignDisplayId)).map((item) => item.campaignProductId));
  const shelfSupported = campaign.products.filter((item) => item.merchandisingState === "SHELF_SUPPORTED").length;
  const assigned = campaign.products.filter((item) => memberships.has(item.id)).length;
  const unassigned = campaign.products.length - assigned - shelfSupported;
  const emptyDisplays = displays.filter((display) => !data.campaignDisplayProducts.some((item) => item.campaignDisplayId === display.id)).length;
  return { total: campaign.products.length, assigned, shelfSupported, unassigned, displays: displays.length, emptyDisplays, status: !displays.length && !shelfSupported ? "not_started" : unassigned || emptyDisplays ? "warning" : "complete" };
}

export function campaignProductReadiness(campaign: Campaign | undefined, data: PlatformSnapshot | undefined): CampaignProductReadiness {
  const readiness: CampaignProductReadiness = { total: 0, verified: 0, pending: 0, inactive: 0, unresolved: 0, needsReview: 0 };
  if (!campaign || !data) return readiness;

  const productById = new Map(data.products.map((product) => [product.id, product]));
  readiness.total = campaign.products.length;

  for (const campaignProduct of campaign.products) {
    const product = productById.get(campaignProduct.productId);
    if (!product || product.masterStatus === "unresolved") readiness.unresolved += 1;
    else if (!product.active) readiness.inactive += 1;
    else if (product.masterStatus === "pending") readiness.pending += 1;
    else if (product.masterStatus === "verified") readiness.verified += 1;
    else readiness.unresolved += 1;
  }

  readiness.needsReview = readiness.pending + readiness.inactive + readiness.unresolved;
  return readiness;
}

export function campaignStepPath(campaignId: UUID | undefined, step: CampaignWorkflowStep) {
  if (step === "campaign") return campaignId ? `/campaigns/${campaignId}` : "/campaigns/new";
  if (!campaignId) return undefined;
  if (step === "products") return `/campaigns/${campaignId}/products`;
  if (step === "displays") return `/campaigns/${campaignId}/display`;
  if (step === "stores") return `/campaigns/${campaignId}/assign`;
  return undefined;
}

export function campaignProductSummary(campaign: Pick<Campaign, "products"> | undefined, data: Pick<PlatformSnapshot, "products"> | undefined): CampaignProductSummary {
  const productById = new Map(data?.products.map((product) => [product.id, product]));
  const products = campaign?.products ?? [];
  const verified = products.filter((campaignProduct) => {
    const product = productById.get(campaignProduct.productId);
    return product?.active && product.masterStatus === "verified";
  }).length;
  const pending = products.filter((campaignProduct) => productById.get(campaignProduct.productId)?.masterStatus === "pending").length;
  const reviewRequired = products.filter((campaignProduct) => {
    const product = productById.get(campaignProduct.productId);
    return !product || !product.active || product.masterStatus !== "verified";
  }).length;
  return { total: products.length, verified, pending, reviewRequired };
}

export function campaignStepStatuses(campaign: Campaign | undefined, data: PlatformSnapshot | undefined, current: CampaignWorkflowStep): Record<CampaignWorkflowStep, CampaignStepStatus> {
  const statuses: Record<CampaignWorkflowStep, CampaignStepStatus> = {
    campaign: "not_started",
    products: "not_started",
    displays: "not_started",
    stores: "not_started",
    review: "not_started",
  };

  if (campaign) {
    const products = campaignProductSummary(campaign, data);
    const displayReadiness = campaignDisplayReadiness(campaign, data);
    const hasLegacyDisplayData = campaign.requirement.displayType !== "flex"
      || campaign.requirement.priority !== "standard"
      || Boolean(campaign.requirement.signage)
      || campaign.requirement.minimumSpace !== "To be defined during display building"
      || Boolean(campaign.requirement.executionNotes)
      || campaign.requirement.prescriptive;
    statuses.campaign = campaign.name && campaign.owner && campaign.startDate && campaign.endDate ? "complete" : "blocked";
    statuses.products = products.reviewRequired > 0 ? "warning" : products.verified > 0 ? "complete" : "blocked";
    statuses.displays = data?.campaignDisplays.some((display) => display.campaignId === campaign.id)
      ? displayReadiness.status === "complete" ? "complete" : "warning"
      : hasLegacyDisplayData ? "complete" : "not_started";
    statuses.stores = data?.assignments.some((assignment) => assignment.campaignId === campaign.id) ? "complete" : "not_started";
  }

  statuses[current] = "current";
  return statuses;
}

export function CampaignWorkflowStepper({ campaign, data, current }: { campaign?: Campaign; data?: PlatformSnapshot; current: CampaignWorkflowStep }) {
  const statuses = campaignStepStatuses(campaign, data, current);
  return <nav aria-label="Campaign planning steps" className="overflow-x-auto rounded-md border border-border bg-surface p-2">
    <ol className="flex min-w-max gap-2">
      {steps.map((step, index) => {
        const status = statuses[step.id];
        const path = campaignStepPath(campaign?.id, step.id);
        const Icon = status === "complete" ? CheckCircle2 : status === "warning" ? TriangleAlert : status === "blocked" ? OctagonAlert : Circle;
        const content = <><span className="text-xs font-semibold">{index + 1}</span><Icon className="h-4 w-4 shrink-0" aria-hidden /><span className="font-semibold">{step.label}</span><Badge tone={status === "complete" ? "success" : status === "warning" ? "warning" : status === "blocked" ? "error" : "neutral"}>{status.replace("_", " ")}</Badge></>;
        const className = clsx("flex h-full items-center gap-2 rounded-md border px-3 py-2 text-sm", step.id === current ? "border-primary bg-primary-subtle text-primary" : "border-transparent text-text-secondary", path && step.id !== current && "hover:bg-subtle");
        return <li key={step.id} className="min-w-36 flex-1">{path ? <Link to={path} aria-current={step.id === current ? "step" : undefined} className={className}>{content}</Link> : <div aria-current={step.id === current ? "step" : undefined} className={className}>{content}</div>}</li>;
      })}
    </ol>
  </nav>;
}
