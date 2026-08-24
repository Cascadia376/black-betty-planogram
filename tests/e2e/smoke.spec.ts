import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("navigates the Crown Isle merchandising workflow", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Merchandising Dashboard" })).toBeVisible();
  await page.getByRole("link", { name: "Floorplan" }).click();
  await expect(page.getByLabel("Crown Isle merchandising floorplan")).toBeVisible();
  await page.getByRole("button", { name: /Endcap A/ }).click();
  await expect(page.getByRole("heading", { name: "Endcap A" })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Store workspace" }).click();
  await page.getByRole("link", { name: "Open task" }).first().click();
  await expect(page.getByRole("heading", { name: "September Beer Feature" })).toBeVisible();
  await page.getByLabel("Completion note").fill("Mock display completed for test.");
  await page.getByRole("button", { name: "Submit completion" }).click();
  await expect(page.getByRole("heading", { name: "Compliance review" })).toBeVisible();
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByRole("status")).toContainText("saved");
  await page.getByRole("navigation").getByRole("link", { name: "Performance" }).click();
  await expect(page.getByRole("heading", { name: "Performance & Recommendations" })).toBeVisible();
  await page.getByRole("link", { name: "Crown Isle / Endcap A" }).click();
  await expect(page.getByRole("heading", { name: "Crown Isle / Endcap A" })).toBeVisible();
});
