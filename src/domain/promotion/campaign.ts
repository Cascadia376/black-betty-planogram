import type { Product, NewCampaignInput } from "../types";
import type { IntelligenceOpportunity } from "./schema";
export interface AddPromotionToCampaignInput {
  opportunity: IntelligenceOpportunity;
  product: Product;
  campaignId?: string;
  newCampaign?: NewCampaignInput;
}
