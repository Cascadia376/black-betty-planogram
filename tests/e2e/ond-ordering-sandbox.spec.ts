import { expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { test } from "./localTest";

const ondProgramId = "c0000000-0000-4000-8000-000000000001";
const crownIsleId = "10000000-0000-4000-8000-000000000001";
const ordersPath = `/stores/${crownIsleId}/orders?program=${ondProgramId}`;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

function recommendationCard(page: Parameters<typeof test>[0] extends never ? never : any, product: string, displayText: string) {
  return page.locator("section.rounded-md")
    .filter({ has: page.getByRole("heading", { name: product, exact: true }) })
    .filter({ hasText: displayText })
    .first();
}

test("recalculates Crown Isle OND orders from inventory, inbound, display need, demand, bridge, and exit rules", async ({ page }, testInfo) => {
  await page.goto(ordersPath);
  await expect(page.getByRole("heading", { name: "Crown Isle orders" })).toBeVisible();

  await page.getByRole("button", { name: "Refresh recommendations" }).click();
  await expect(page.getByRole("status")).toContainText("8 recommendations refreshed.");

  const harvestEndcap = recommendationCard(page, "Mock Harvest Red Feature", "Display 1 · Endcap A");
  await expect(harvestEndcap).toContainText("On hand");
  await expect(harvestEndcap).toContainText("5 cases");
  await expect(harvestEndcap).toContainText("1 reserved");
  await expect(harvestEndcap).toContainText("On order");
  await expect(harvestEndcap).toContainText("2 cases");
  await expect(harvestEndcap).toContainText("Required display stock");
  await expect(harvestEndcap).toContainText("12 cases");
  await expect(harvestEndcap).toContainText("Forecast need");
  await expect(harvestEndcap).toContainText("3 cases");
  await expect(harvestEndcap).toContainText("Recommended order");
  await expect(harvestEndcap).toContainText("9 cases");

  const harvestFeature = recommendationCard(page, "Mock Harvest Red Feature", "Display 4 · Feature Area 1");
  await expect(harvestFeature).toContainText("Required display stock");
  await expect(harvestFeature).toContainText("10 cases");
  await expect(harvestFeature).toContainText("Recommended order");
  await expect(harvestFeature).toContainText("7 cases");

  const bridgeEndcap = recommendationCard(page, "Mock Cream Liqueur Gift Pack", "Display 1 · Endcap A");
  await expect(bridgeEndcap).toContainText("Buying strategy: intentional bridge");
  await expect(bridgeEndcap).toContainText("Recommended order");
  await expect(bridgeEndcap).toContainText("24 cases");
  await expect(bridgeEndcap).toContainText("Estimated bridge margin captured");
  await expect(bridgeEndcap).toContainText("$288.00");

  const bridgeCooler = recommendationCard(page, "Mock Cream Liqueur Gift Pack", "Display 3 · Cooler Doors 1-4");
  await expect(bridgeCooler).toContainText("Required display stock");
  await expect(bridgeCooler).toContainText("16 cases");
  await expect(bridgeCooler).toContainText("Recommended order");
  await expect(bridgeCooler).toContainText("24 cases");

  const holiday = recommendationCard(page, "Mock Holiday Cream Liqueur", "Display 1 · Endcap A");
  await expect(holiday).toContainText("14 cases");
  await expect(holiday).toContainText("Recommended order");
  await expect(holiday).toContainText("1 cases");

  const exitEndcap = recommendationCard(page, "Mock Seasonal Gift Set", "Display 1 · Endcap A");
  await expect(exitEndcap).toContainText("Exit strategy: minimize post-program stock");
  await expect(exitEndcap).toContainText("Recommended order");
  await expect(exitEndcap).toContainText("0 cases");

  const exitFeature = recommendationCard(page, "Mock Seasonal Gift Set", "Display 4 · Feature Area 1");
  await expect(exitFeature).toContainText("Recommended order");
  await expect(exitFeature).toContainText("0 cases");

  const cider = recommendationCard(page, "Mock Winter Cider Pack", "Display 3 · Cooler Doors 1-4");
  await expect(cider).toContainText("Forecast need");
  await expect(cider).toContainText("5 cases");
  await expect(cider).toContainText("Recommended order");
  await expect(cider).toContainText("15 cases");

  await expect(page.locator('section[aria-labelledby="orders-intentional_bridge"]')).toContainText("2");
  await expect(page.locator('section[aria-labelledby="orders-potential_residual"]')).toContainText("2");
  await expect(page.locator('section[aria-labelledby="orders-at_risk"]')).toContainText("1");

  await page.screenshot({ path: testInfo.outputPath("06-crown-isle-ordering-recalculated.png"), fullPage: true });
});

test("batches actionable Crown Isle recommendations into a supplier order and downloads the generic test PO", async ({ page }, testInfo) => {
  await page.goto(ordersPath);
  await page.getByRole("button", { name: "Refresh recommendations" }).click();
  await expect(page.getByRole("status")).toContainText("8 recommendations refreshed.");

  const supplierBatch = page.locator("section.rounded-md").filter({ hasText: "Supplier order batches" }).first();
  await expect(supplierBatch).toContainText("Mock Coastal Distribution");
  await expect(supplierBatch).toContainText("5 products · 65 cases");

  await supplierBatch.getByRole("button", { name: "Create supplier order" }).click();
  await expect(page.getByRole("status")).toContainText(/Supplier order .* created\./);
  await expect(supplierBatch).toContainText("Submitted orders");
  await expect(supplierBatch).toContainText("Mock Coastal Distribution · 65 cases · due Oct 1, 2026");
  await expect(supplierBatch).toContainText("Generic test export only. It is not a BDL or LDB submission format.");

  const downloadPromise = page.waitForEvent("download");
  await supplierBatch.getByRole("button", { name: "Download test PO CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^TEST-PO-CO-MOCK-COASTAL-/);
  const path = await download.path();
  expect(path).toBeTruthy();
  const csv = await readFile(path!, "utf8");
  expect(csv).toContain('"Store","Supplier"');
  expect(csv).toContain('"Crown Isle","Mock Coastal Distribution"');
  expect(csv.match(/"MOCK-OND-1001"/g)?.length).toBe(2);
  expect(csv.match(/"MOCK-OND-1002"/g)?.length).toBe(2);
  expect(csv.match(/"MOCK-OND-2001"/g)?.length).toBe(1);
  expect(csv).not.toContain('"MOCK-OND-3001"');
  expect(csv.split(/\r?\n/)).toHaveLength(6);

  await page.screenshot({ path: testInfo.outputPath("07-crown-isle-submitted-po.png"), fullPage: true });
});
