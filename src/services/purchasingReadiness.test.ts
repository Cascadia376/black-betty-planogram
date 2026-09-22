import { describe, expect, it, vi } from "vitest";
import { canonicalPurchasingStoreId, fetchPurchasingReadiness, parsePurchasingReadiness } from "./purchasingReadiness";

const request = { campaign_id: "campaign-id", store_ids: [1], max_confirmation_age_days: 2 };
function response() {
  return {
    contract_version: "purchasing-readiness-v1", campaign_id: "campaign-id", source_fingerprint: "source-version", as_of: "2026-09-22", stock_writes: false,
    requirements: [{ key: "bb:requirement", campaign_id: "campaign-id", store_id: 1, sku: "SKU", source_product_id: "product-id", required_date: "2026-10-01", status: "Unknown", required_units: 18, usable_on_hand_units: null, eligible_incoming_units: null, uncovered_units: null, reasons: ["Dated inventory is unavailable."], review: { reviewed: true, source_current: true }, orders: [] }],
  };
}

describe("purchasing readiness boundary", () => {
  it("uses verified store identities and never guesses another layout or WB", () => {
    expect(canonicalPurchasingStoreId("10000000-0000-4000-8000-000000000003")).toBe(1);
    expect(canonicalPurchasingStoreId("10000000-0000-4000-8000-000000000013")).toBeUndefined();
    expect(canonicalPurchasingStoreId("Allandale")).toBeUndefined();
  });

  it("keeps Unknown and rejects Ready without stock evidence", () => {
    expect(parsePurchasingReadiness(response(), request).requirements[0].status).toBe("Unknown");
    const invalid = response(); invalid.requirements[0].status = "Ready";
    expect(() => parsePurchasingReadiness(invalid, request)).toThrow("dated stock evidence");
  });

  it("rejects cross-store, wrong campaign and duplicated requirement responses", () => {
    const wrongStore = response(); wrongStore.requirements[0].store_id = 2;
    expect(() => parsePurchasingReadiness(wrongStore, request)).toThrow("scope");
    const wrongCampaign = response(); wrongCampaign.campaign_id = "another";
    expect(() => parsePurchasingReadiness(wrongCampaign, request)).toThrow("scope");
    const duplicate = response(); duplicate.requirements.push(duplicate.requirements[0]);
    expect(() => parsePurchasingReadiness(duplicate, request)).toThrow("duplicate");
  });

  it("sends only a scoped read request with native bearer and no cookies/redirects", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response()), { status: 200 }));
    await fetchPurchasingReadiness("https://ursus.example", "synthetic-token", request, fetcher);
    expect(String(fetcher.mock.calls[0][0])).toBe("https://ursus.example/api/purchasing/readiness");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", credentials: "omit", redirect: "error", headers: { Authorization: "Bearer synthetic-token" }, body: JSON.stringify(request) });
  });

  it("refuses unauthenticated or insecure configured endpoints before fetching", async () => {
    const fetcher = vi.fn();
    await expect(fetchPurchasingReadiness("http://remote.example", "token", request, fetcher)).rejects.toThrow("HTTPS");
    await expect(fetchPurchasingReadiness("https://user:password@remote.example", "token", request, fetcher)).rejects.toThrow("HTTPS");
    await expect(fetchPurchasingReadiness("https://ursus.example", "", request, fetcher)).rejects.toThrow("Sign in");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("preserves denied access instead of broadening permissions", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("denied", { status: 403 }));
    await expect(fetchPurchasingReadiness("https://ursus.example", "token", request, fetcher)).rejects.toThrow("provisioned Ursus Major account");
  });
});
