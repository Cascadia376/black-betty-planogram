import type { DemandHistoryRecord } from "../../domain/types";

export type DemandConfidence = "high" | "medium" | "low";
export type DemandFallbackLevel = "store_sku" | "chainwide_sku" | "store_category" | "chainwide_category" | "default_ond_curve";
export type OndDemandPhase = "baseline" | "gradual_build" | "christmas_acceleration" | "christmas_closed" | "boxing_drop" | "intermediate" | "new_year_spike" | "new_year_closed" | "post_holiday";

export interface DemandForecastInput {
  storeId: string;
  productId: string;
  category: string;
  startDate: string;
  endDate: string;
}

export interface DailyDemandForecast {
  date: string;
  expectedCases: number;
  phase: OndDemandPhase;
  multiplier: number;
}

export interface DemandForecastResult {
  dailyDemand: DailyDemandForecast[];
  confidence: DemandConfidence;
  source: DemandFallbackLevel;
  explanation: string;
}

export interface HistoricalDemandSource {
  loadHistory(): Promise<DemandHistoryRecord[]>;
}

export interface DemandForecastService {
  forecast(input: DemandForecastInput): Promise<DemandForecastResult>;
}
