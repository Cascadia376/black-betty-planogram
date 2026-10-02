import { describe, expect, it } from "vitest";
import { MockMerchandisingRepository } from "../adapters/mock/MockMerchandisingRepository";
import { IDS, seedSnapshot } from "../adapters/mock/seed";
import { evaluateCampaignPublishReadiness } from "./campaignPublishReadiness";
import { snapshotForRelease } from "./campaignReleaseSnapshot";
import { buildStoreExecutionPack } from "./storeExecutionPack";

async function readyCampaign() {
  const repository = new MockMerchandisingRepository(undefined, structuredClone(seedSnapshot), false);
  const area = seedSnapshot.displayAreas.find((item) => item.active && item.storeId !== IDS.store && item.storeId !== IDS.eagleStore)!;
  const campaignId = await repository.createCampaign({ name: "Release hardening", type: "OND", owner: "Test buyer", supplier: "Test supplier", description: "Test-only campaign", startDate: "2027-10-01", endDate: "2027-12-31", products: [{ id: "test-release-product", productId: IDS.ondHarvestProduct, role: "Feature", required: true }] });
  const display = await repository.createCampaignDisplay({ campaignId, displayAreaId: area.id, display: { name: "Seasonal feature", displayType: area.type, placementMode: "STORE_SPECIFIC", prescriptive: true, signage: "Approved price tickets", executionNotes: "Labels forward" } });
  const [member] = await repository.assignCampaignProductsToDisplay({ campaignId, campaignDisplayId: display.id, campaignProductIds: ["test-release-product"] });
  await repository.updateCampaignDisplayProduct({ campaignDisplayProductId: member.id, patch: { minimumFacings: 3 } });
  await repository.applyCampaignDisplayQuantity({ campaignDisplayId: display.id, campaignDisplayProductId: member.id, caseQuantity: 5 });
  return { repository, campaignId, area, display, member };
}

describe("release data and readiness", () => {
  it("keeps released instructions, product guidance and positions stable after later edits and treats unchanged publish as a no-op", async () => {
    const { repository, campaignId, area, display } = await readyCampaign();
    const result = await repository.publishCampaign({ campaignId, publishedBy: "Test buyer" });
    const first = await repository.load();
    const release = first.campaignReleases.find((item) => item.id === result.releaseId)!;
    const frozen = snapshotForRelease(first, release)!;
    const originalPack = buildStoreExecutionPack(frozen, campaignId, area.storeId)!;
    expect(originalPack.builds[0]).toMatchObject({ displayName: "Seasonal feature", startDate: "2027-10-01", endDate: "2027-12-31" });
    expect(originalPack.builds[0].products[0]).toMatchObject({ cases: 5, minimumFacings: 3 });

    expect(await repository.publishCampaign({ campaignId, publishedBy: "Test buyer" })).toEqual(result);
    expect(await repository.load()).toEqual(first);
    await repository.updateCampaignDisplay({ campaignDisplayId: display.id, patch: { executionNotes: "New unpublished note" } });
    await repository.updateDisplayArea({ displayAreaId: area.id, patch: { geometry: { x: 0.2, y: 0.2, width: 0.06, height: 0.06 } } });
    const edited = await repository.load();
    edited.products.find((item) => item.id === IDS.ondHarvestProduct)!.name = "Later catalog name";
    const reopened = new MockMerchandisingRepository(undefined, edited, false);
    const after = await reopened.load();
    expect(buildStoreExecutionPack(snapshotForRelease(after, after.campaignReleases.find((item) => item.id === release.id)!)!, campaignId, area.storeId)).toEqual(originalPack);
    expect(buildStoreExecutionPack(after, campaignId, area.storeId)!.builds[0].notes).toContain("New unpublished note");
    const second = await reopened.publishCampaign({ campaignId, publishedBy: "Test buyer" });
    expect(second.version).toBe(2);
    expect((await reopened.load()).campaignReleases.find((item) => item.id === release.id)?.status).toBe("superseded");
  });

  it("does not fabricate a frozen manager pack for a legacy release", async () => {
    const { repository, campaignId } = await readyCampaign();
    const result = await repository.publishCampaign({ campaignId, publishedBy: "Test buyer" });
    const data = await repository.load();
    const release = data.campaignReleases.find((item) => item.id === result.releaseId)!;
    delete release.snapshot.executionData;
    expect(snapshotForRelease(data, release)).toBeUndefined();
  });

  it.each(["missing quantity", "inactive product", "wrong store area", "invalid dates", "conflicting notes", "orphan quantity", "duplicate placement"])("blocks %s without mutating the plan", async (scenario) => {
    const { repository, campaignId, area } = await readyCampaign();
    const data = await repository.load();
    const campaign = data.campaigns.find((item) => item.id === campaignId)!;
    const assignment = data.campaignDisplayAssignments.find((item) => item.campaignId === campaignId)!;
    if (scenario === "missing quantity") data.campaignDisplayAssignmentProducts = data.campaignDisplayAssignmentProducts.filter((item) => item.campaignDisplayAssignmentId !== assignment.id);
    if (scenario === "inactive product") data.products.find((item) => item.id === IDS.ondHarvestProduct)!.active = false;
    if (scenario === "wrong store area") assignment.displayAreaId = data.displayAreas.find((item) => item.storeId !== area.storeId && item.active)!.id;
    if (scenario === "invalid dates") assignment.endDate = "2027-02-31";
    if (scenario === "conflicting notes") assignment.hasConflictingExecutionNotes = true;
    if (scenario === "orphan quantity") data.campaignDisplayAssignmentProducts.find((item) => item.campaignDisplayAssignmentId === assignment.id)!.productId = "orphan";
    if (scenario === "duplicate placement") data.campaignDisplayAssignments.push({ ...assignment, id: "duplicate" });
    expect(evaluateCampaignPublishReadiness(campaign, data).state).toBe("BLOCKED");
    const invalid = new MockMerchandisingRepository(undefined, data, false);
    await expect(invalid.publishCampaign({ campaignId, publishedBy: "Test buyer" })).rejects.toThrow("blocking");
    expect(await invalid.load()).toEqual(data);
  });
});
