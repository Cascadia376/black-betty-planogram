import type { CampaignDisplay, DisplayArea, PlatformSnapshot } from "./types";

export interface CampaignDisplayAreaCompatibility {
  status: "recommended" | "compatible" | "review" | "incompatible";
  reasons: string[];
}

export function campaignDisplayAreaCompatibility(display: CampaignDisplay, area: DisplayArea, data: Pick<PlatformSnapshot, "campaignDisplayAssignments" | "campaignDisplays" | "campaigns" | "zones">): CampaignDisplayAreaCompatibility {
  const reasons: string[] = [];
  const typeMatch = display.displayType === area.type || (display.displayType === "feature_display" && area.type === "feature_table");
  if (!typeMatch && !area.flexible) return { status: "incompatible", reasons: ["Display type is not compatible with this physical area."] };
  reasons.push(typeMatch ? "Compatible display type." : "Flexible fixture can support this display type.");
  const zone = data.zones.find((item) => item.id === area.zoneId);
  if (area.primaryCategory && zone?.category && area.primaryCategory !== zone.category && zone.category !== "Promotional") reasons.push("Zone/category requires buyer review.");
  const campaign = data.campaigns.find((item) => item.id === display.campaignId);
  const conflict = data.campaignDisplayAssignments.some((assignment) => assignment.displayAreaId === area.id && assignment.status === "ASSIGNED" && campaign && assignment.startDate <= campaign.endDate && assignment.endDate >= campaign.startDate);
  if (conflict) return { status: "incompatible", reasons: [...reasons, "An overlapping campaign allocation already uses this area."] };
  return { status: reasons.some((reason) => reason.includes("review")) ? "review" : typeMatch ? "recommended" : "compatible", reasons };
}
