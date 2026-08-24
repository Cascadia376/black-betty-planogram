import type { DemandHistoryRecord } from "../../domain/types";
import type { DemandConfidence, DemandFallbackLevel, DemandForecastInput, DemandForecastResult, DemandForecastService, HistoricalDemandSource, OndDemandPhase } from "./contracts";

export interface OndDemandCurveConfig {
  multipliers: Record<OndDemandPhase, number>;
  postHolidayCategoryMultipliers: Record<string, number>;
  defaultDailyCases: number;
}

export const defaultOndDemandCurveConfig: OndDemandCurveConfig = {
  multipliers: {
    baseline: 1,
    gradual_build: 1.2,
    christmas_acceleration: 1.8,
    christmas_closed: 0,
    boxing_drop: 0.4,
    intermediate: 0.8,
    new_year_spike: 2.1,
    new_year_closed: 0,
    post_holiday: 0.75,
  },
  postHolidayCategoryMultipliers: {},
  defaultDailyCases: 1,
};

function phaseForDate(date: string): OndDemandPhase {
  const monthDay = date.slice(5, 10);
  if (monthDay >= "10-01" && monthDay <= "11-30") return "baseline";
  if (monthDay >= "12-01" && monthDay <= "12-14") return "gradual_build";
  if (monthDay >= "12-15" && monthDay <= "12-24") return "christmas_acceleration";
  if (monthDay === "12-25") return "christmas_closed";
  if (monthDay === "12-26") return "boxing_drop";
  if (monthDay >= "12-27" && monthDay <= "12-29") return "intermediate";
  if (monthDay >= "12-30" && monthDay <= "12-31") return "new_year_spike";
  if (monthDay === "01-01") return "new_year_closed";
  return "post_holiday";
}

function datesBetween(startDate: string, endDate: string) {
  if (endDate < startDate) throw new Error("Demand forecast end date must be on or after its start date.");
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function selectHistory(history: DemandHistoryRecord[], input: DemandForecastInput) {
  const choices: { source: DemandFallbackLevel; confidence: DemandConfidence; records: DemandHistoryRecord[] }[] = [
    { source: "store_sku", confidence: "high", records: history.filter((item) => item.storeId === input.storeId && item.productId === input.productId) },
    { source: "chainwide_sku", confidence: "medium", records: history.filter((item) => item.productId === input.productId) },
    { source: "store_category", confidence: "medium", records: history.filter((item) => item.storeId === input.storeId && item.category === input.category) },
    { source: "chainwide_category", confidence: "low", records: history.filter((item) => item.category === input.category) },
  ];
  return choices.find((choice) => choice.records.length > 0) ?? { source: "default_ond_curve" as const, confidence: "low" as const, records: [] };
}

export class RuleBasedOndDemandService implements DemandForecastService {
  constructor(private readonly source: HistoricalDemandSource, private readonly config: OndDemandCurveConfig = defaultOndDemandCurveConfig) {}

  async forecast(input: DemandForecastInput): Promise<DemandForecastResult> {
    const history = await this.source.loadHistory();
    const selected = selectHistory(history, input);
    const baselineCases = selected.records.length
      ? selected.records.reduce((total, record) => total + record.cases, 0) / selected.records.length
      : this.config.defaultDailyCases;
    const dailyDemand = datesBetween(input.startDate, input.endDate).map((date) => {
      const phase = phaseForDate(date);
      const multiplier = phase === "post_holiday"
        ? this.config.postHolidayCategoryMultipliers[input.category] ?? this.config.multipliers[phase]
        : this.config.multipliers[phase];
      return { date, phase, multiplier, expectedCases: Math.round(baselineCases * multiplier * 100) / 100 };
    });
    const sourceLabel = selected.source.replaceAll("_", " ");
    return {
      dailyDemand,
      confidence: selected.confidence,
      source: selected.source,
      explanation: `${sourceLabel} supplied ${selected.records.length || "no"} synthetic history record${selected.records.length === 1 ? "" : "s"}; baseline ${baselineCases.toFixed(2)} cases/day was adjusted by the configured OND phase multiplier for each date.`,
    };
  }
}
