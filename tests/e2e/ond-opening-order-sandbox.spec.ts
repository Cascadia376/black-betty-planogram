import { expect, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { test } from "./localTest";

const ondProgramId = "c0000000-0000-4000-8000-000000000001";
const crownIsleId = "10000000-0000-4000-8000-000000000001";
const ordersPath = `/stores/${crownIsleId}/orders?program=${ondProgramId}`;

function metric(card: Locator, label: string) {
  return card.locator("dt", { hasText: label }).filter({ hasText: new RegExp(`^${label}import { expect, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { test } from "./localTest";

const ondProgramId = "c0000000-0000-4000-8000-000000000001";
const crownIsleId = "10000000-0000-4000-8000-000000000001";
) }).locator("xpath=following-sibling::dd[1]");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/?sandbox=1&scenario=opening-order");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("calculates ten controlled opening-order scenarios and produces a safe generic PO", async ({ page }, testInfo) => {
  await page.goto(ordersPath);
  await expect(page.getByRole("heading", { name: "Crown Isle orders" })).toBeVisible();

  await page.getByRole("button", { name: "Refresh recommendations" }).click();
  await expect(page.getByRole("status")).toContainText("10 recommendations refreshed.");

  const cases = [
    ["Mock Harvest Red Feature", "0 cases"],
    ["TEST Partial Stock Feature", "6 cases"],
    ["TEST Inbound Covered Feature", "0 cases"],
    ["TEST Reserved Stock Feature", "2 cases"],
    ["TEST Zero Stock Feature", "4 cases"],
    ["TEST Alternate Supplier Feature", "7 cases"],
    ["Mock Winter Cider Pack", "5 cases"],
    ["Mock Cream Liqueur Gift Pack", "24 cases"],
    ["Mock Holiday Cream Liqueur", "0 cases"],
    ["Mock Seasonal Gift Set", "0 cases"],
  ] as const;

  for (const [name, recommended] of cases) {
    const card = page.getByRole("heading", { name }).locator("xpath=ancestor::section[1]");
    await expect(card).toBeVisible();
    await expect(metric(card, "Recommended order")).toHaveText(recommended);
  }

  const partial = page.getByRole("heading", { name: "TEST Partial Stock Feature" }).locator("xpath=ancestor::section[1]");
  await expect(metric(partial, "On hand")).toHaveText("2 cases");
  await expect(metric(partial, "On order")).toHaveText("3 cases");
  await expect(metric(partial, "Recommended order")).toHaveText("6 cases");

  const inboundCovered = page.getByRole("heading", { name: "TEST Inbound Covered Feature" }).locator("xpath=ancestor::section[1]");
  await expect(metric(inboundCovered, "On hand")).toHaveText("4 cases");
  await expect(metric(inboundCovered, "On order")).toHaveText("6 cases");
  await expect(metric(inboundCovered, "Recommended order")).toHaveText("0 cases");

  const reserved = page.getByRole("heading", { name: "TEST Reserved Stock Feature" }).locator("xpath=ancestor::section[1]");
  await expect(metric(reserved, "On hand")).toHaveText("6 cases");
  await expect(reserved.getByText("2 reserved", { exact: true })).toBeVisible();
  await expect(metric(reserved, "Recommended order")).toHaveText("2 cases");

  const alternate = page.getByRole("heading", { name: "TEST Alternate Supplier Feature" }).locator("xpath=ancestor::section[1]");
  await expect(alternate).toContainText("Mock Island Wholesale");

  const atRisk = page.getByRole("heading", { name: "Mock Winter Cider Pack" }).locator("xpath=ancestor::section[1]");
  await expect(atRisk).toContainText("Mock Coastal Distribution");
  const atRiskGroup = page.locator("section[aria-labelledby='orders-at_risk']");
  await expect(atRiskGroup).toContainText("Mock Winter Cider Pack");

  const bridge = page.getByRole("heading", { name: "Mock Cream Liqueur Gift Pack" }).locator("xpath=ancestor::section[1]");
  await expect(bridge).toContainText("Buying strategy: intentional bridge");
  await expect(metric(bridge, "Recommended order")).toHaveText("24 cases");

  const exit = page.getByRole("heading", { name: "Mock Seasonal Gift Set" }).locator("xpath=ancestor::section[1]");
  await expect(exit).toContainText("Exit strategy: minimize post-program stock");

  const batches = page.getByRole("heading", { name: "Supplier order batches" }).locator("xpath=ancestor::section[1]");
  const coastalBatch = batches.locator("div").filter({ has: page.getByText("Mock Coastal Distribution", { exact: true }) }).filter({ has: page.getByRole("button", { name: "Create supplier order" }) }).first();
  await expect(coastalBatch).toContainText("4 products");
  await expect(coastalBatch).toContainText("36 cases");
  await expect(batches.getByText("Mock Winter Cider Pack", { exact: true })).toHaveCount(0);

  await page.screenshot({ path: testInfo.outputPath("06-opening-order-review.png"), fullPage: true });

  await coastalBatch.getByRole("button", { name: "Create supplier order" }).click();
  await expect(page.getByRole("status")).toContainText("Supplier order");
  await expect(batches).toContainText("36 cases");

  const downloadPromise = page.waitForEvent("download");
  await batches.getByRole("button", { name: "Download test PO CSV" }).click();
  const download = await downloadPromise;
  await expect(download.suggestedFilename()).toMatch(/^TEST-PO-CI-MOCK-COASTAL-/);
  const path = await download.path();
  expect(path).not.toBeNull();
  const csv = await readFile(path!, "utf8");
  expect(csv).toContain("TEST-OND-4001");
  expect(csv).toContain("TEST-OND-4003");
  expect(csv).toContain("TEST-OND-4004");
  expect(csv).toContain("MOCK-OND-1002");
  expect(csv).not.toContain("MOCK-OND-3001");
  expect(csv).not.toContain("TEST-OND-4005");

  await page.screenshot({ path: testInfo.outputPath("07-purchase-order-created.png"), fullPage: true });

  await expect(batches.getByText("Mock Coastal Distribution", { exact: true })).toHaveCount(1);
  const remainingCreateButtons = batches.getByRole("button", { name: "Create supplier order" });
  await expect(remainingCreateButtons).toHaveCount(1);
  const alternateBatch = batches.locator("div").filter({ has: page.getByText("Mock Island Wholesale", { exact: true }) }).filter({ has: page.getByRole("button", { name: "Create supplier order" }) }).first();
  await expect(alternateBatch).toContainText("1 products");
  await expect(alternateBatch).toContainText("7 cases");
});
