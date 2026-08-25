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
  async createCampaign(): Promise<UUID> { return this.unavailable(); }
  async assignCampaign(): Promise<never> { return this.unavailable(); }
  async createDisplayAssignment(): Promise<never> { return this.unavailable(); }
  async updateDisplayAssignment(): Promise<never> { return this.unavailable(); }
  async applyOndImport(): Promise<void> { return this.unavailable(); }
  async saveBridgeStrategy(): Promise<void> { return this.unavailable(); }
  async completeExecution(): Promise<void> { return this.unavailable(); }
  async reviewCompliance(): Promise<void> { return this.unavailable(); }
  async updateRecommendation(): Promise<void> { return this.unavailable(); }
  async updateOrderRecommendation(): Promise<void> { return this.unavailable(); }
  async reset(): Promise<void> { return this.unavailable(); }
}
