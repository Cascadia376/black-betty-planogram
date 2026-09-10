import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { SupplierSubmissionImportAdapter, toApplySupplierSubmissionImport } from "../../adapters/import/SupplierSubmissionImportAdapter";
import { MockMerchandisingRepository } from "../../adapters/mock/MockMerchandisingRepository";
import { MockProductMasterLookup } from "../../adapters/mock/MockProductMasterLookup";
import { seedSnapshot } from "../../adapters/mock/seed";
import { PlatformProvider } from "../../services/PlatformProvider";
import { supplierSubmissionRows } from "../../../tests/fixtures/supplierSubmissionWorkbook";
import { PromotionOpportunitiesPage } from "./PromotionOpportunitiesPage";

describe("Promotion Opportunities workspace", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows and filters opportunities and persists Approve, Pass, Defer, and Jeremy comments", async () => {
    const repository = new MockMerchandisingRepository();
    const result = await new SupplierSubmissionImportAdapter().parseRows(supplierSubmissionRows, { productMaster: new MockProductMasterLookup(seedSnapshot.products) }, { sourceFileName: "Supplier.xlsx", sourceSheet: "Supplier Submission", fingerprint: "workspace-sha" });
    await repository.applySupplierSubmissionImport(toApplySupplierSubmissionImport(result));
    render(<PlatformProvider adapter={repository}><MemoryRouter><PromotionOpportunitiesPage /></MemoryRouter></PlatformProvider>);

    expect(await screen.findByText("Coastal Lager 12 Pack")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Supplier filter"), { target: { value: "not present" } });
    expect(await screen.findByText("No opportunities found")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Supplier filter"), { target: { value: "Mock Coast" } });
    expect(await screen.findByText("Coastal Lager 12 Pack")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Approve Coastal Lager 12 Pack"));
    await waitFor(() => expect(screen.getByText("APPROVED")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Pass Coastal Lager 12 Pack"));
    await waitFor(() => expect(screen.getByText("PASSED")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Defer Coastal Lager 12 Pack"));
    await waitFor(() => expect(screen.getByText("DEFERRED")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Jeremy comment for Coastal Lager 12 Pack"), { target: { value: "Strong seller" } });
    fireEvent.click(screen.getByRole("button", { name: "Save comment" }));
    await waitFor(async () => expect((await repository.load()).promotionOpportunities[0].jeremyComment).toBe("Strong seller"));
    fireEvent.click(screen.getByLabelText("Approve Coastal Lager 12 Pack"));
    await waitFor(async () => expect((await repository.load()).promotionOpportunities[0]).toMatchObject({ status: "APPROVED", jeremyComment: "Strong seller", supplierEvidence: { notes: "Preorder by September 15" } }));
  });
});
