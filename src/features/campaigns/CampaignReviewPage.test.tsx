import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { MockMerchandisingRepository } from "../../adapters/mock/MockMerchandisingRepository";
import { IDS } from "../../adapters/mock/seed";
import { PlatformProvider } from "../../services/PlatformProvider";
import { CampaignReviewPage } from "./CampaignReviewPage";

describe("CampaignReviewPage", () => {
  beforeEach(() => window.localStorage.clear());

  it("distinguishes placed and unplaced stores and shows adjusted quantities", async () => {
    const repository = new MockMerchandisingRepository();
    const initial = await repository.load();
    const display = initial.campaignDisplays.find((item) => item.campaignId === IDS.octoberCampaign)!;
    await repository.setCampaignStores({ campaignId: IDS.octoberCampaign, storeIds: [IDS.store, IDS.eagleStore] });
    const assignments = await repository.suggestCampaignDisplay({ campaignId: IDS.octoberCampaign, campaignDisplayId: display.id });
    const placed = assignments.find((item) => item.storeId === IDS.store)!;
    await repository.updateCampaignDisplayAssignment({ campaignDisplayAssignmentId: placed.id, displayAreaId: placed.suggestionDisplayAreaId, status: "ASSIGNED" });
    const state = await repository.load();
    const quantity = state.campaignDisplayAssignmentProducts.find((item) => item.campaignDisplayAssignmentId === placed.id)!;
    await repository.updateCampaignDisplayAssignmentProduct({ campaignDisplayAssignmentProductId: quantity.id, caseQuantity: 9 });

    render(
      <PlatformProvider adapter={repository}>
        <MemoryRouter initialEntries={[`/campaigns/${IDS.octoberCampaign}/review`]}>
          <Routes><Route path="campaigns/:campaignId/review" element={<CampaignReviewPage />} /></Routes>
        </MemoryRouter>
      </PlatformProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Physical store placements" })).toBeInTheDocument();
    expect(screen.getAllByText("Placed", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not placed", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Adjusted by store", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Campaign default", { exact: true }).length).toBeGreaterThan(0);
  });
});
