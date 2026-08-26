/* eslint-disable react-refresh/only-export-components */
import { CheckCircle2, Circle, OctagonAlert, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import type { Campaign, PlatformSnapshot, UUID } from "../../domain/types";
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
  if (!campaignId) return undefined;
  if (step === "products") return `/campaigns/${campaignId}/products`;
  if (step === "displays") return `/campaigns/${campaignId}/display`;
  if (step === "stores") return `/campaigns/${campaignId}/assign`;
  return undefined;
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
    const validProductIds = new Set(data?.products.filter((product) => product.active && product.masterStatus === "verified").map((product) => product.id));
    const hasValidProducts = campaign.products.some((product) => validProductIds.has(product.productId));
    statuses.campaign = campaign.name && campaign.owner && campaign.startDate && campaign.endDate ? "complete" : "blocked";
    statuses.products = hasValidProducts ? "complete" : "warning";
    const hasDisplayGuidance = hasValidProducts && campaign.requirement.minimumSpace !== "To be defined during display building";
    statuses.displays = hasDisplayGuidance ? "complete" : "not_started";
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
