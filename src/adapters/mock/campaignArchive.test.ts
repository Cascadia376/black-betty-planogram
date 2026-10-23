import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockMerchandisingRepository } from "./MockMerchandisingRepository";
import { evaluateCampaignPublishReadiness } from "../../domain/campaignPublishReadiness";
import { seedSnapshot, IDS } from "./seed";

function fixture() {
  const state = structuredClone(seedSnapshot);
  const campaign = state.campaigns.find(item => item.id === IDS.octoberCampaign)!;
  campaign.status = "draft";
  state.campaignReleases = state.campaignReleases.filter(item => item.campaignId !== campaign.id);
  return state;
}

describe("draft campaign archive", () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it("changes only the chosen status and restores the exact original snapshot", async () => {
    const state = fixture();
    const repository = new MockMerchandisingRepository(undefined, state);
    const before = await repository.load();
    await repository.setCampaignArchived(IDS.octoberCampaign, true);
    const expected = structuredClone(before);
    expected.campaigns.find(item => item.id === IDS.octoberCampaign)!.status = "archived";
    expect(await repository.load()).toEqual(expected);
    expect(evaluateCampaignPublishReadiness(expected.campaigns.find(c=>c.id===IDS.octoberCampaign), expected).issues[0].code).toBe("CAMPAIGN_ARCHIVED");
    expect(await new MockMerchandisingRepository().load()).toEqual(expected);
    await repository.setCampaignArchived(IDS.octoberCampaign, false);
    expect(await repository.load()).toEqual(before);
  });

  it.each(["active", "scheduled", "completed"] as const)("rejects %s campaigns without changing data", async status => {
    const state = fixture(); state.campaigns.find(c => c.id === IDS.octoberCampaign)!.status = status;
    const repository = new MockMerchandisingRepository(undefined, state, false);
    const before = await repository.load();
    await expect(repository.setCampaignArchived(IDS.octoberCampaign, true)).rejects.toThrow("Only draft");
    expect(await repository.load()).toEqual(before);
  });

  it("rejects any release history, missing campaigns and repeated transitions", async () => {
    const state = fixture();
    const repository = new MockMerchandisingRepository(undefined, state, false);
    await expect(repository.setCampaignArchived("missing", true)).rejects.toThrow("not found");
    await expect(repository.setCampaignArchived(IDS.octoberCampaign, false)).rejects.toThrow("Only archived");
    await repository.setCampaignArchived(IDS.octoberCampaign, true);
    await expect(repository.setCampaignArchived(IDS.octoberCampaign, true)).rejects.toThrow("Only draft");
    await expect(repository.publishCampaign({campaignId:IDS.octoberCampaign,publishedBy:"synthetic"})).rejects.toThrow("Restore this archived");
    state.campaignReleases.push({campaignId:IDS.octoberCampaign} as typeof state.campaignReleases[number]);
    const released = new MockMerchandisingRepository(undefined, state, false);
    await expect(released.setCampaignArchived(IDS.octoberCampaign,true)).rejects.toThrow("release history");
  });

  it("rolls back an unsuccessful local save", async () => {
    const repository = new MockMerchandisingRepository(undefined, fixture());
    const before = await repository.load();
    vi.spyOn(localStorage, "setItem").mockImplementationOnce(() => { throw new Error("Storage unavailable"); });
    await expect(repository.setCampaignArchived(IDS.octoberCampaign,true)).rejects.toThrow("storage failed");
    expect(await repository.load()).toEqual(before);
  });
});
