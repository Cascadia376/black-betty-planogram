import { expect } from "@playwright/test";
import { test } from "./localTest";

const crownIsleFloorplan = "/stores/10000000-0000-4000-8000-000000000001/floorplan";

test("moves, resizes, cancels, saves and pans Crown Isle displays", async ({ page }, testInfo) => {
  await page.goto(`${crownIsleFloorplan}?mode=layout`);
  await page.getByRole("button", { name: "Edit display positions", exact: true }).click();
  const area = page.locator("[data-display-hotspot]").first();
  const id = await area.getAttribute("data-display-hotspot");
  const original = await area.getAttribute("style");
  await area.focus();
  await area.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Save display position", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Cancel change", exact: true }).click();
  await expect(area).toHaveAttribute("style", original!);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByLabel("Floorplan zoom")).toHaveText("125%");
  await page.getByRole("button", { name: "Fit floorplan", exact: true }).click();
  const box = (await area.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
  await expect(area).not.toHaveAttribute("style", original!);
  await page.getByRole("button", { name: "Save display position", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Display geometry saved" })).toBeVisible();
  await area.click();
  const handle = page.getByRole("button", { name: /^Resize / }).first();
  const handleBox = (await handle.boundingBox())!;
  const movedStyle = await area.getAttribute("style");
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 20, handleBox.y + handleBox.height / 2 + 15, { steps: 5 });
  await page.mouse.up();
  await expect(area).not.toHaveAttribute("style", movedStyle!);
  const savedStyle = await area.getAttribute("style");
  await page.getByRole("button", { name: "Save display position", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Display geometry saved" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Edit display positions", exact: true }).click();
  await expect(page.locator(`[data-display-hotspot="${id}"]`)).toHaveAttribute("style", savedStyle!);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Pan floorplan", exact: true }).click();
  await page.getByTestId("floorplan-viewport").scrollIntoViewIfNeeded();
  const viewport = (await page.getByTestId("floorplan-viewport").boundingBox())!;
  const transform = await page.getByTestId("floorplan-transform").getAttribute("style");
  await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.x + viewport.width / 2 - 40, viewport.y + viewport.height / 2 - 25, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByTestId("floorplan-transform")).not.toHaveAttribute("style", transform!);
  await page.getByRole("button", { name: "Fit floorplan", exact: true }).click();
  await expect(page.getByLabel("Floorplan zoom")).toHaveText("100%");
  await page.screenshot({ path: testInfo.outputPath("floorplan-editor.png"), fullPage: true });
});

test("keeps campaign floorplans read-only even when layout mode is requested", async ({ page }) => {
  await page.goto(`${crownIsleFloorplan}?campaign=50000000-0000-4000-8000-000000000004&area=42000000-0000-4000-8000-000000000020&mode=layout`);

  await expect(page.getByRole("heading", { name: "October Flyer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit display positions" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Manage physical layout" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit Display Area" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit category space" })).toHaveCount(0);
});
