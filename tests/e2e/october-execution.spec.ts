import { expect } from "@playwright/test";
import { test } from "./localTest";
import { createOctoberExecutionWorkbook } from "../fixtures/octoberExecutionWorkbook";

declare const Buffer: { from(input: Uint8Array): Uint8Array };

test("quick importer carries the workbook and entered campaign dates into full review", async ({ page }) => {
  await page.route("**/*.supabase.co/**", (route) => route.abort());
  await page.goto("/campaigns/new");
  await page.getByLabel("Campaign name").fill("OND handoff campaign");
  await page.getByLabel("Campaign type").selectOption("OND");
  await expect(page.getByLabel("Start date")).toHaveValue(/-10-01$/);
  await expect(page.getByLabel("End date")).toHaveValue(/-12-31$/);
  await page.getByLabel("Start date").fill("2027-10-01");
  await page.getByLabel("End date").fill("2027-12-31");
  await page.getByRole("button", { name: "Create campaign and continue" }).click();
  await page.getByRole("button", { name: "Import known-format spreadsheet" }).click();
  await page.getByRole("dialog").locator('input[type="file"]').setInputFiles({ name: "Black Betty OND Test Spreadsheet 2.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(createOctoberExecutionWorkbook()) as never });
  await page.getByRole("link", { name: "Open full workbook importer" }).click();
  await expect(page.getByRole("heading", { name: "Import review", exact: true })).toBeVisible();
  await expect(page.getByLabel("Start date")).toHaveValue("2027-10-01");
  await expect(page.getByLabel("End date")).toHaveValue("2027-12-31");
  await expect(page.getByLabel("Campaign name")).toHaveValue("OND handoff campaign");
  await expect(page.getByText("Replace selected workbook")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Missing display code · row 6" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply and create draft campaign" })).toBeDisabled();
});

test("consolidated OND → explicit exception approval → Crown Isle and Port Alberni packs", async ({ page }, testInfo) => {
  // Network must never reach a live catalog in this synthetic acceptance test.
  await page.route("**/*.supabase.co/**", (route) => route.abort());
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/campaigns");
  await page.getByRole("link", { name: "Import consolidated OND workbook", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "OND 2026 execution test.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(createOctoberExecutionWorkbook()) as never });
  await expect(page.getByRole("heading", { name: "Exceptions first — review before Apply" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inactive SKU · row 8" })).toBeVisible();
  await page.getByLabel("Cross-store code for row 6").fill("BR2");
  await page.getByRole("button", { name: "Approve display code", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Missing display code · row 6" })).toHaveCount(0);
  await page.getByLabel("Exact SKU for row 7").fill("MOCK-1003");
  await page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Unmatched SKU · row 7" }) }).getByRole("button", { name: "Look up exact SKU" }).click();
  await expect(page.getByText("Exact active match: MOCK-1003 · Pacific Pilsner 8 Pack")).toBeVisible();
  await page.getByRole("button", { name: "Approve exact product for row 7" }).click();
  await expect(page.getByRole("button", { name: "Apply and create draft campaign" })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Apply and create draft campaign" }).click();
  await expect(page).toHaveURL(/\/campaigns\/[^/]+\/review$/);
  const reviewUrl = page.url();
  for (const code of ["W8", "BR2", "M1"]) {
    const instructions = page.getByRole("article").filter({ has: page.getByLabel(`Signage for Display ${code}`, { exact: true }) });
    await instructions.getByLabel(`Signage for Display ${code}`, { exact: true }).fill("OND campaign header and approved price tickets");
    await instructions.getByRole("button", { name: "Save display instructions" }).click();
  }
  await expect(page.getByLabel("Execution pack store")).toHaveValue(/.+/);
  await page.getByRole("link", { name: "Open Crown Isle October pack" }).click();
  await expect(page.locator(".execution-pack").getByRole("heading", { name: "Crown Isle", exact: true })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Harvest Red Blend" })).toContainText("6");
  await expect(page.getByRole("row").filter({ hasText: "Coastal Lager 12 Pack" })).toContainText("12");
  await expect(page.getByRole("heading", { name: "Display build sheets", exact: true })).toBeVisible();
  await expect(page.getByText("Display notes:", { exact: false }).first()).toBeVisible();
  await expect(page.locator("svg image").first()).toHaveAttribute("href", /.+/);
  await expect(page.getByRole("button", { name: "Print / Save letter-size PDF" })).toBeEnabled();
  await expect(page.getByText("OND campaign header and approved price tickets", { exact: false }).first()).toBeVisible();
  const displayMap = page.locator(".pack-map-page svg");
  const octoberMap = await displayMap.evaluate((node) => node.outerHTML);
  for (const label of ["November", "December"] as const) {
    await page.getByRole("link", { name: `${label} order plan` }).click();
    await expect(page.getByRole("heading", { name: `${label} OND order plan` })).toBeVisible();
    await expect(displayMap.evaluate((node) => node.outerHTML)).resolves.toBe(octoberMap);
  }
  await page.getByRole("link", { name: "October order plan" }).click();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Print / Save letter-size PDF" })).toBeHidden();
  await page.pdf({ path: testInfo.outputPath("crown-isle-execution.pdf"), preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: "screen" });
  await page.screenshot({ path: testInfo.outputPath("crown-isle-pack.png"), fullPage: true });
  await page.goto(reviewUrl);
  await page.getByLabel("Execution pack store").selectOption({ label: "Port Alberni" });
  const exception = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Suggested alternative requiring approval", exact: true }) }).filter({ hasText: "W8:" });
  await expect(exception).toContainText("3 cases");
  await exception.getByRole("button", { name: "Approve suggested area" }).click();
  await expect(exception).toHaveCount(0);
  await page.getByRole("link", { name: "Open Port Alberni October pack" }).click();
  await expect(page.locator(".execution-pack").getByRole("heading", { name: "Port Alberni", exact: true })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Harvest Red Blend" })).toContainText("3");
  await expect(page.getByRole("heading", { name: "No-display / shelf-support items" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: "Harvest Red Blend" })).toContainText("3");
});
