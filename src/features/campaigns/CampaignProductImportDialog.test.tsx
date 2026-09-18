import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { CampaignProductImportContext } from "../../adapters/import/CampaignProductImportAdapter";
import { CampaignProductImportDialog } from "./CampaignProductImportDialog";

vi.mock("../../adapters/import/CampaignProductImportAdapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../adapters/import/CampaignProductImportAdapter")>();
  return {
    ...actual,
    CampaignProductImportAdapter: class extends actual.CampaignProductImportAdapter {
      async parse(file: Blob, context: CampaignProductImportContext) {
        if ((file as File).name.includes("Store Displays")) {
          return this.parseRows([
            ["Vendor", "Category", "INV_NUM", "Product", "Display", "Case QTY", "Display Notes"],
            ["Supplier", "WINE", 796094, "Copper Moon Pinot Grigio", "W1", 2, "Feature"],
          ], context);
        }
        return this.parseRows([
          ["Vendor", "Category", "INV_NUM", "Product", "Allandale"],
          ["Supplier", "WINE", 796094, "Copper Moon Pinot Grigio", 6],
        ], context);
      }
    },
  };
});

describe("CampaignProductImportDialog", () => {
  it("explains when a consolidated OND workbook belongs in the full importer", async () => {
    const { container } = render(
      <MemoryRouter>
        <CampaignProductImportDialog products={[]} assortment={[]} onCreatePendingProduct={vi.fn()} onApply={vi.fn()} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input as HTMLInputElement, { target: { files: [new File(["workbook"], "Black Betty OND Test Spreadsheet.xlsx")] } });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("consolidated OND planning workbook");
    expect(screen.getByRole("link", { name: /Open full workbook importer/i })).toHaveAttribute("href", "/imports/flyer");
    expect(screen.queryByText("Matched")).not.toBeInTheDocument();
  });

  it("routes a store-display workbook to its dedicated importer", async () => {
    const { container } = render(
      <MemoryRouter>
        <CampaignProductImportDialog products={[]} assortment={[]} onCreatePendingProduct={vi.fn()} onApply={vi.fn()} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(["workbook"], "OND Store Displays.xlsx")] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("OND store-display workbook");
    expect(screen.getByRole("link", { name: /Open store display importer/i })).toHaveAttribute("href", "/imports/store-displays");
  });
});
