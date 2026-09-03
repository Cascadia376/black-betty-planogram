import type { CampaignDisplay, DisplayArea, PlatformSnapshot } from "./types";

export interface CampaignDisplayAreaCompatibility {
  status: "recommended" | "compatible" | "review" | "incompatible";
  reasons: string[];
}

export function campaignDisplayAreaCompatibility(display: CampaignDisplay, area: DisplayArea, data: Pick<PlatformSnapshot, "campaignDisplayAssignments" | "campaignDisplays" | "campaigns" | "zones">): CampaignDisplayAreaCompatibility {
  const reasons: string[] = [];
  if (!area.active) return { status: "incompatible", reasons: ["This physical display area is inactive."] };
  const typeMatch = display.displayType === area.type || (display.displayType === "feature_display" && area.type === "feature_table");
  if (!typeMatch && !area.flexible) return { status: "incompatible", reasons: ["Display type is not compatible with this physical area."] };
  reasons.push(typeMatch ? "Compatible display type." : "Flexible fixture can support this display type.");
  const campaignLanguage = `${display.name} ${display.description ?? ""}`.toLocaleLowerCase();
  const preferredFamily = campaignLanguage.includes("wine") ? "WINE" : /beer|rtd|cider/.test(campaignLanguage) ? "BEER_RTD" : campaignLanguage.includes("multi") ? "MULTI" : undefined;
  if (preferredFamily && area.displayFamily === preferredFamily) reasons.push(`Recommended because this is a ${preferredFamily === "BEER_RTD" ? "Beer/RTD" : preferredFamily === "MULTI" ? "Multi" : "Wine"} display family.`);
  const zone = data.zones.find((item) => item.id === area.zoneId);
  if (area.primaryCategory && zone?.category && area.primaryCategory !== zone.category && zone.category !== "Promotional") reasons.push("Zone/category requires buyer review.");
  const campaign = data.campaigns.find((item) => item.id === display.campaignId);
  const conflict = data.campaignDisplayAssignments.some((assignment) => assignment.displayAreaId === area.id && assignment.status === "ASSIGNED" && campaign && assignment.startDate <= campaign.endDate && assignment.endDate >= campaign.startDate);
  if (conflict) return { status: "incompatible", reasons: [...reasons, "An overlapping campaign allocation already uses this area."] };
  return { status: reasons.some((reason) => reason.includes("review")) ? "review" : typeMatch || reasons.some((reason) => reason.startsWith("Recommended")) ? "recommended" : "compatible", reasons };
}
