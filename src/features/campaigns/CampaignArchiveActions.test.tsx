import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockMerchandisingRepository } from "../../adapters/mock/MockMerchandisingRepository";
import { IDS, seedSnapshot } from "../../adapters/mock/seed";
import { PlatformProvider } from "../../services/PlatformProvider";
import { CampaignOverviewPage } from "./CampaignOverviewPage";
import { CampaignsPage } from "./CampaignsPage";

function setup(list = false, archived = false) {
  const state = structuredClone(seedSnapshot);
  state.campaigns.find(c => c.id === IDS.octoberCampaign)!.status = archived ? "archived" : "draft";
  state.campaignReleases = state.campaignReleases.filter(c => c.campaignId !== IDS.octoberCampaign);
  const repository = new MockMerchandisingRepository(undefined,state,false);
  render(<PlatformProvider adapter={repository}><MemoryRouter initialEntries={[list?"/campaigns":`/campaigns/${IDS.octoberCampaign}`]}><Routes><Route path="/campaigns" element={<CampaignsPage/>}/><Route path="/campaigns/:campaignId" element={<CampaignOverviewPage/>}/></Routes></MemoryRouter></PlatformProvider>);
  return repository;
}

describe("campaign archive controls", () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); vi.stubGlobal("confirm", vi.fn(() => true)); });

  it("requires explicit confirmation with the exact campaign ID, then offers restore", async () => {
    const confirm = vi.spyOn(window,"confirm").mockReturnValue(false);
    const repository = setup();
    const mutate = vi.spyOn(repository,"setCampaignArchived");
    fireEvent.click(await screen.findByRole("button",{name:"Archive draft"}));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining(IDS.octoberCampaign));
    expect(mutate).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button",{name:"Archive draft"}));
    fireEvent.click(await screen.findByRole("button",{name:"Restore to draft"}));
    expect(await screen.findByRole("button",{name:"Archive draft"})).toBeEnabled();
    expect(mutate.mock.calls).toEqual([[IDS.octoberCampaign,true],[IDS.octoberCampaign,false]]);
  });

  it("requires reload after an uncertain response and does not replay a successful archive", async () => {
    vi.spyOn(window,"confirm").mockReturnValue(true);
    const repository = setup();
    const original = repository.setCampaignArchived.bind(repository);
    const mutate = vi.spyOn(repository,"setCampaignArchived").mockImplementationOnce(async (...args) => { await original(...args); throw new Error("Response lost"); });
    fireEvent.click(await screen.findByRole("button",{name:"Archive draft"}));
    await screen.findByText("Response lost");
    expect(screen.getByRole("button",{name:"Archive draft"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:"Reload campaign before retrying"}));
    expect(await screen.findByRole("button",{name:"Restore to draft"})).toBeEnabled();
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("keeps archived campaign history reachable through the list toggle", async () => {
    const repository=setup(true,true);
    await screen.findByRole("heading",{name:"Campaigns"});
    const before=await repository.load();
    const campaign=before.campaigns.find(c=>c.id===IDS.octoberCampaign)!;
    expect(screen.queryByRole("link",{name:campaign.name})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox",{name:"Show archived campaigns"}));
    fireEvent.click(screen.getByRole("link",{name:campaign.name}));
    await screen.findByRole("button",{name:"Restore to draft"});
    expect((await repository.load()).history).toEqual(before.history);
    expect((await repository.load()).campaignImports).toEqual(before.campaignImports);
  });
});
