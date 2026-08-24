import { describe, expect, it } from "vitest";
import type { DemandHistoryRecord } from "../../domain/types";
import { MockHistoricalDemandSource } from "./MockHistoricalDemandSource";
import { RuleBasedOndDemandService } from "./RuleBasedOndDemandService";

const input = { storeId: "store-a", productId: "sku-a", category: "Wine", startDate: "2026-12-14", endDate: "2027-01-02" };
const forecastWith = (records: DemandHistoryRecord[]) => new RuleBasedOndDemandService(new MockHistoricalDemandSource(records)).forecast(input);
const record = (id: string, values: Partial<DemandHistoryRecord>): DemandHistoryRecord => ({ id, date: "2025-11-01", cases: 10, ...values });

describe("rule-based OND demand curve", () => {
  it("models acceleration, closures, and the New Year spike", async () => {
    const result = await forecastWith([record("store-sku", { storeId: "store-a", productId: "sku-a" })]);
    const demand = (date: string) => result.dailyDemand.find((item) => item.date === date)!;
    expect(demand("2026-12-15").expectedCases).toBeGreaterThan(demand("2026-12-14").expectedCases);
    expect(demand("2026-12-25").expectedCases).toBe(0);
    expect(demand("2026-12-30").expectedCases).toBeGreaterThan(demand("2026-12-29").expectedCases);
    expect(demand("2026-12-31").phase).toBe("new_year_spike");
    expect(demand("2027-01-01").expectedCases).toBe(0);
  });

  it("uses the configured fallback hierarchy", async () => {
    const storeSku = record("store-sku", { storeId: "store-a", productId: "sku-a", category: "Wine" });
    const chainSku = record("chain-sku", { storeId: "store-b", productId: "sku-a", category: "Spirits" });
    const storeCategory = record("store-category", { storeId: "store-a", productId: "sku-b", category: "Wine" });
    const chainCategory = record("chain-category", { storeId: "store-b", productId: "sku-b", category: "Wine" });
    await expect(forecastWith([storeSku, chainSku, storeCategory, chainCategory])).resolves.toEqual(expect.objectContaining({ source: "store_sku", confidence: "high" }));
    await expect(forecastWith([chainSku, storeCategory, chainCategory])).resolves.toEqual(expect.objectContaining({ source: "chainwide_sku" }));
    await expect(forecastWith([storeCategory, chainCategory])).resolves.toEqual(expect.objectContaining({ source: "store_category" }));
    await expect(forecastWith([chainCategory])).resolves.toEqual(expect.objectContaining({ source: "chainwide_category" }));
    await expect(forecastWith([])).resolves.toEqual(expect.objectContaining({ source: "default_ond_curve", confidence: "low" }));
  });
});
