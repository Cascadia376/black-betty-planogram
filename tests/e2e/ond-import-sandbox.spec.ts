import { expect } from "@playwright/test";
import { test } from "./localTest";
import { createCascadiaOndWorkbook } from "../fixtures/cascadiaOndWorkbook";
import { cascadiaOndRows } from "../fixtures/cascadiaOndRows";

declare const Buffer: { from(input: Uint8Array): Uint8Array };

const ondProgramId = "c0000000-0000-4000-8000-000000000001";
const ondImport = `/programs/${ondProgramId}/import`;
const ondAllocations = `/programs/${ondProgramId}/allocations`;
const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function workbookBuffer(rows: (string | number)[][]) {
  return Buffer.from(createCascadiaOndWorkbook(rows)) as never;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("imports the synthetic OND workbook and verifies normalized allocations end to end", async ({ page }, testInfo) => {
  await page.goto(ondImport);
  await expect(page.getByRole("heading", { name: "OND 2026 legacy allocation import" })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "OND_2026_TEST_Happy_Path.xlsx",
    mimeType: xlsxMime,
    buffer: workbookBuffer(cascadiaOndRows),
  });

  await expect(page.getByText("3 ready", { exact: true })).toBeVisible();
  await expect(page.getByText("0 review", { exact: true })).toBeVisible();
  await expect(page.getByText("0 errors", { exact: true })).toBeVisible();

  const approval = page.getByRole("heading", { name: "Approval" }).locator("xpath=ancestor::section[1]");
  await expect(approval).toContainText("Rows");
  await expect(approval).toContainText("3");
  await expect(approval).toContainText("Assignments");
  await expect(approval).toContainText("2");
  await expect(approval).toContainText("Products");
  await expect(approval).toContainText("3");
  await expect(approval).toContainText("Issues");
  await expect(approval).toContainText("0");

  await page.screenshot({ path: testInfo.outputPath("01-happy-path-review.png"), fullPage: true });

  await page.getByRole("button", { name: "Approve import" }).click();
  await expect(page.getByRole("button", { name: "Import applied" })).toBeDisabled();
  await page.getByRole("link", { name: "Open imported allocations" }).click();
  await expect(page).toHaveURL(new RegExp(`${ondAllocations.replaceAll("/", "\\/")}$`));
  await expect(page.getByRole("heading", { name: "OND 2026 allocations" })).toBeVisible();

  await page.getByLabel("Store").selectOption({ label: "Eagle Creek" });
  const rows = page.locator("tbody tr");
  await expect(rows.filter({ hasText: "MOCK-OND-1001" })).toBeVisible();
  await expect(rows.filter({ hasText: "MOCK-OND-1002" })).toBeVisible();
  await expect(rows.filter({ hasText: "MOCK-OND-2001" })).toBeVisible();

  const displayOne = rows.filter({ hasText: "MOCK-OND-1001" });
  await expect(displayOne).toContainText("MOCK-OND-1002");
  await expect(displayOne).toContainText("24 total");
  const displayTwo = rows.filter({ hasText: "MOCK-OND-2001" });
  await expect(displayTwo).toContainText("14 total");

  await page.screenshot({ path: testInfo.outputPath("02-imported-eagle-creek-allocations.png"), fullPage: true });
});

test("requires explicit reset-date resolution before warning rows can be approved", async ({ page }, testInfo) => {
  const warningRows = [
    cascadiaOndRows[0],
    [
      "OND 2026",
      "Eagle Creek",
      "1",
      "MOCK-OND-1001",
      "Mock Harvest Red Feature",
      18,
      "Mock Coastal Distribution",
      "2026-10-01",
      "2026-11-11",
      "",
      "Reset Nov 12 for holiday assortment",
    ],
  ];

  await page.goto(ondImport);
  await page.locator('input[type="file"]').setInputFiles({
    name: "OND_2026_TEST_Warning_Reset_Date.xlsx",
    mimeType: xlsxMime,
    buffer: workbookBuffer(warningRows),
  });

  await expect(page.getByText("1 review", { exact: true })).toBeVisible();
  await expect(page.getByText("0 errors", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve import" })).toHaveCount(0);

  await page.getByLabel("Reset date for row 2").fill("2026-11-12");
  await page.getByRole("button", { name: "Apply resolution" }).click();

  await expect(page.getByText("1 ready", { exact: true })).toBeVisible();
  await expect(page.getByText("0 review", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve import" })).toBeEnabled();

  await page.screenshot({ path: testInfo.outputPath("03-warning-resolved.png"), fullPage: true });
});

test("blocks invalid OND data and exact-header failures", async ({ page }, testInfo) => {
  const invalidRows = [
    cascadiaOndRows[0],
    [
      "OND 2026",
      "Eagle Creek",
      "17",
      "UNKNOWN",
      "Unknown product",
      "many",
      "Unknown vendor",
      "Oct 1",
      "2026-11-11",
      "Nov 12",
      "Reset Nov 12",
    ],
  ];

  await page.goto(ondImport);
  await page.locator('input[type="file"]').setInputFiles({
    name: "OND_2026_TEST_Error_Validation.xlsx",
    mimeType: xlsxMime,
    buffer: workbookBuffer(invalidRows),
  });

  await expect(page.getByText("1 errors", { exact: true })).toBeVisible();
  await expect(page.getByText(/does not identify exactly one display/)).toBeVisible();
  await expect(page.getByText(/is not in the product master/)).toBeVisible();
  await expect(page.getByText(/Case quantity must be a positive whole number/)).toBeVisible();
  await expect(page.getByText(/is not a known supplier name or code/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve import" })).toHaveCount(0);

  await page.screenshot({ path: testInfo.outputPath("04-invalid-data-blocked.png"), fullPage: true });

  const badHeaders = [
    [...cascadiaOndRows[0].slice(0, -1), "Notes"],
    cascadiaOndRows[1],
  ];

  await page.locator('input[type="file"]').setInputFiles({
    name: "OND_2026_TEST_Header_Error.xlsx",
    mimeType: xlsxMime,
    buffer: workbookBuffer(badHeaders),
  });

  await expect(page.getByText(/Expected exactly: Program \| Store \| Display #/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve import" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("05-header-error-blocked.png"), fullPage: true });
});
