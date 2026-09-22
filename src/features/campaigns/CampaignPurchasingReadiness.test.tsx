import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Store } from "../../domain/types";
import type { CampaignPurchasingReadiness as Readiness } from "../../services/purchasingReadiness";
import { CampaignPurchasingReadiness } from "./CampaignPurchasingReadiness";

const store = { id: "10000000-0000-4000-8000-000000000003", name: "Allandale" } as Store;
const data: Readiness = {
  contract_version: "purchasing-readiness-v1", campaign_id: "campaign", source_fingerprint: "source-current", as_of: "2026-09-22", stock_writes: false,
  requirements: [{ key: "bb:key", campaign_id: "campaign", store_id: 1, sku: "SKU", required_date: "2026-10-01", status: "Unknown", required_units: 18, usable_on_hand_units: null, eligible_incoming_units: null, uncovered_units: null, reasons: ["Dated stock is unavailable."], review: { reviewed: true, source_current: true }, orders: [{ order_id: "order", po_number: "UMPO-1", status: "issued", issued: true, dispatched: false, confirmed: false, confirmation_fresh: false, received_line_units: 0 }] }],
};

describe("CampaignPurchasingReadiness", () => {
  it("shows Unknown and makes no request without configured authentication", () => {
    const load = vi.fn();
    render(<CampaignPurchasingReadiness campaignId="campaign" stores={[store]} products={[]} available={false} load={load} />);
    expect(screen.getByRole("status")).toHaveTextContent("Unknown");
    expect(load).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("requires explicit store/freshness and separates issued from sent/readiness", async () => {
    const load = vi.fn().mockResolvedValue(data);
    render(<CampaignPurchasingReadiness campaignId="campaign" stores={[store]} products={[]} available load={load} />);
    const button = screen.getByRole("button", { name: "Check purchasing readiness" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Readiness store"), { target: { value: store.id } });
    fireEvent.change(screen.getByLabelText("Confirmation freshness (days)"), { target: { value: "2" } });
    fireEvent.click(button);
    await waitFor(() => expect(load).toHaveBeenCalledWith({ campaign_id: "campaign", store_ids: [1], max_confirmation_age_days: 2 }));
    expect(await screen.findByText("Dated stock is unavailable.")).toBeVisible();
    expect(screen.getByText("Unknown", { exact: true })).toBeVisible();
    expect(screen.getByText(/UMPO-1: issued; not sent/)).toBeVisible();
    expect(screen.queryByText("Ready", { exact: true })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Confirmation freshness (days)"), { target: { value: "3" } });
    expect(screen.queryByText("Dated stock is unavailable.")).not.toBeInTheDocument();
  });

  it("keeps unknown mapping visible and does not silently omit the store", () => {
    render(<CampaignPurchasingReadiness campaignId="campaign" stores={[{ ...store, id: "unmapped" }]} products={[]} available load={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Readiness store"), { target: { value: "unmapped" } });
    expect(screen.getByRole("status")).toHaveTextContent("no verified Ursus Major mapping");
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("reports failed reads as Unknown without modifying merchandising", async () => {
    render(<CampaignPurchasingReadiness campaignId="campaign" stores={[store]} products={[]} available load={vi.fn().mockRejectedValue(new Error("Access denied"))} />);
    fireEvent.change(screen.getByLabelText("Readiness store"), { target: { value: store.id } });
    fireEvent.change(screen.getByLabelText("Confirmation freshness (days)"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unknown — Access denied");
  });
});
