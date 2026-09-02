import type { SupabaseClient } from "@supabase/supabase-js";
import type { MerchandisingRepository } from "../../domain/repositories";
import type { PlatformSnapshot, UUID } from "../../domain/types";

/** Integration boundary only. Production access remains explicitly disabled. */
export class SupabaseMerchandisingRepository implements MerchandisingRepository {
  constructor(private readonly client: SupabaseClient) {}

  private unavailable(): never {
    void this.client;
    throw new Error("The Supabase merchandising adapter is not enabled. Use the mock adapter.");
  }

  async load(): Promise<PlatformSnapshot> { return this.unavailable(); }
  async getStoreLayouts(): Promise<never> { return this.unavailable(); }
  async getStoreLayout(): Promise<never> { return this.unavailable(); }
  async getCategorySpaces(): Promise<never> { return this.unavailable(); }
  async updateCategorySpace(): Promise<never> { return this.unavailable(); }
  async createStoreLayout(): Promise<never> { return this.unavailable(); }
  async duplicateStoreLayout(): Promise<never> { return this.unavailable(); }
  async setCurrentStoreLayout(): Promise<void> { return this.unavailable(); }
  async createDisplayArea(): Promise<never> { return this.unavailable(); }
  async updateDisplayArea(): Promise<never> { return this.unavailable(); }
  async deleteDisplayArea(): Promise<void> { return this.unavailable(); }
  async searchProducts(): Promise<never> { return this.unavailable(); }
  async createPendingProduct(): Promise<never> { return this.unavailable(); }
  async createCampaign(): Promise<UUID> { return this.unavailable(); }
  async addCampaignProducts(): Promise<never> { return this.unavailable(); }
  async applyCampaignProductImport(): Promise<never> { return this.unavailable(); }
  async updateCampaignProduct(): Promise<never> { return this.unavailable(); }
  async removeCampaignProduct(): Promise<void> { return this.unavailable(); }
  async createCampaignDisplay(): Promise<never> { return this.unavailable(); }
  async updateCampaignDisplay(): Promise<never> { return this.unavailable(); }
  async reorderCampaignDisplay(): Promise<void> { return this.unavailable(); }
  async removeCampaignDisplay(): Promise<void> { return this.unavailable(); }
  async assignCampaignProductsToDisplay(): Promise<never> { return this.unavailable(); }
  async removeCampaignProductFromDisplay(): Promise<void> { return this.unavailable(); }
  async setCampaignProductShelfSupport(): Promise<void> { return this.unavailable(); }
  async setCampaignProductUnassigned(): Promise<void> { return this.unavailable(); }
  async updateCampaignDisplayProduct(): Promise<never> { return this.unavailable(); }
  async reorderCampaignDisplayProduct(): Promise<void> { return this.unavailable(); }
  async setCampaignStores(): Promise<void> { return this.unavailable(); }
  async suggestCampaignDisplay(): Promise<never> { return this.unavailable(); }
  async updateCampaignDisplayAssignment(): Promise<never> { return this.unavailable(); }
  async updateCampaignDisplayAssignmentProduct(): Promise<never> { return this.unavailable(); }
  async applyCampaignDisplayQuantity(): Promise<void> { return this.unavailable(); }
  async assignCampaign(): Promise<never> { return this.unavailable(); }
  async createDisplayAssignment(): Promise<never> { return this.unavailable(); }
  async updateDisplayAssignment(): Promise<never> { return this.unavailable(); }
  async applyOndImport(): Promise<void> { return this.unavailable(); }
  async publishProgram(): Promise<never> { return this.unavailable(); }
  async refreshOrderRecommendations(): Promise<never> { return this.unavailable(); }
  async createPurchaseOrder(): Promise<never> { return this.unavailable(); }
  async setProgramStore(): Promise<void> { return this.unavailable(); }
  async saveBridgeStrategy(): Promise<void> { return this.unavailable(); }
  async completeExecution(): Promise<void> { return this.unavailable(); }
  async reviewCompliance(): Promise<void> { return this.unavailable(); }
  async updateRecommendation(): Promise<void> { return this.unavailable(); }
  async updateOrderRecommendation(): Promise<void> { return this.unavailable(); }
  async reset(): Promise<void> { return this.unavailable(); }
}
