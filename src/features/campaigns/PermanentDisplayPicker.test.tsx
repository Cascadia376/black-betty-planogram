import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it } from "vitest";
import { MockMerchandisingRepository } from "../../adapters/mock/MockMerchandisingRepository";
import { MockProductMasterLookup } from "../../adapters/mock/MockProductMasterLookup";
import { FlyerWorkbookImportAdapter, toApplyCampaignWorkbookImport } from "../../adapters/import/FlyerWorkbookImportAdapter";
import { octoberExecutionRows } from "../../../tests/fixtures/octoberExecutionWorkbook";
import { PlatformProvider, usePlatform } from "../../services/PlatformProvider";
import { PermanentDisplayPicker } from "./PermanentDisplayPicker";

function Picker({ campaignId }: { campaignId: string }) {
  const { data } = usePlatform();
  const campaign = data?.campaigns.find((item) => item.id === campaignId);
  return data && campaign ? <PermanentDisplayPicker campaign={campaign} data={data} /> : null;
}

beforeEach(() => localStorage.clear());
it("visibly confirms a permanent area and saves only an existing display's store override", async () => {
  const repo = new MockMerchandisingRepository();
  const initial = await repo.load();
  const master = new MockProductMasterLookup(initial.products);
  const result = await new FlyerWorkbookImportAdapter().parseRows(octoberExecutionRows, { snapshot: initial, productMaster: master }, { sourceFileName: "OND 2026.xlsx", sourceSheet: "Worksheet", fingerprint: "picker-test" });
  const { campaignId } = await repo.applyCampaignWorkbookImport(toApplyCampaignWorkbookImport(result, result.suggestedCampaign));
  const before = await repo.load();
  const assignment = before.campaignDisplayAssignments.find((item) => item.campaignId === campaignId && item.intendedDisplayCode === "W8" && item.status === "SUGGESTED")!;
  render(<PlatformProvider adapter={repo} productMaster={master}><MemoryRouter><Picker campaignId={campaignId} /></MemoryRouter></PlatformProvider>);
  fireEvent.click(await screen.findByText("Manual store placement override"));
  fireEvent.change(screen.getByLabelText("Override store"), { target: { value: assignment.storeId } });
  fireEvent.change(screen.getByLabelText("Existing campaign display"), { target: { value: assignment.campaignDisplayId } });
  fireEvent.change(screen.getByLabelText("Permanent area"), { target: { value: assignment.suggestionDisplayAreaId } });
  expect(screen.getByRole("status")).toHaveTextContent("Next: approve this store override");
  expect((await repo.load()).campaignDisplayAssignments).toEqual(before.campaignDisplayAssignments);
  fireEvent.click(screen.getByRole("button", { name: "Approve store override" }));
  expect(await screen.findByRole("link", { name: "Next: review products and cases in store pack" })).toHaveAttribute("href", `/campaigns/${campaignId}/stores/${assignment.storeId}/pack`);
  const after = await repo.load();
  expect(after.campaignDisplays).toEqual(before.campaignDisplays);
  expect(after.campaignDisplayAssignmentProducts).toEqual(before.campaignDisplayAssignmentProducts);
  expect(after.campaignDisplayAssignments.filter((item) => item.id !== assignment.id)).toEqual(before.campaignDisplayAssignments.filter((item) => item.id !== assignment.id));
  expect(after.displayAreas).toEqual(before.displayAreas);
});
