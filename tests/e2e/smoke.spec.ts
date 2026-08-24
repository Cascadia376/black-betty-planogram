import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("presents the merchandising dashboard priorities and actions", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  await expect(page.getByRole("heading", { name: "Merchandising Dashboard" })).toBeVisible();
  await expect(page.getByText("Synthetic demo data", { exact: true })).toBeVisible();
  await expect(page.getByText("Displays due this week", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Store execution progress", { exact: true })).toBeVisible();
  await expect(page.getByText("Compliance requiring review", { exact: true })).toBeVisible();
  await expect(page.getByText("Current monthly flyer", { exact: true })).toBeVisible();
  await expect(page.getByText("Seasonal programs", { exact: true })).toBeVisible();
  await expect(page.getByText("Top-performing display areas", { exact: true })).toBeVisible();
  await expect(page.getByText("Recommendations requiring attention", { exact: true })).toBeVisible();

  await expect(page.getByRole("link", { name: "New campaign" }).first()).toHaveAttribute("href", "/campaigns/new");
  await expect(page.getByRole("link", { name: "View campaigns" }).first()).toHaveAttribute("href", "/campaigns");
  await expect(page.getByRole("link", { name: "Review compliance" }).first()).toHaveAttribute("href", /\/compliance\//);
  await expect(page.getByRole("link", { name: "View performance" }).first()).toHaveAttribute("href", "/performance");
  await expect(page.getByRole("link", { name: /September Beer Feature/ }).first()).toHaveAttribute("href", /\/campaigns\//);
  await expect(page.getByRole("link", { name: /Crown Isle \/ Endcap A/ }).last()).toHaveAttribute("href", /\/display-areas\//);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

const crownIsleFloorplan = "/stores/10000000-0000-4000-8000-000000000001/floorplan";
const endcapAId = "40000000-0000-4000-8000-000000000001";

test("loads the Crown Isle floorplan and selects a persistent display area", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(crownIsleFloorplan);

  const canvas = page.getByLabel("Crown Isle merchandising floorplan");
  await expect(canvas).toBeVisible();
  await expect(canvas.getByRole("button")).toHaveCount(4);
  await expect(canvas.getByRole("button", { name: /Endcap A, Active campaign/ })).toBeVisible();
  await expect(canvas.getByRole("button", { name: /Feature Area 1, Upcoming campaign/ })).toBeVisible();
  await expect(canvas.getByRole("button", { name: /Endcap B, Available/ })).toBeVisible();

  await canvas.getByRole("button", { name: /Endcap A/ }).click();

  await expect(page).toHaveURL(new RegExp(`\\?area=${endcapAId}$`));
  await expect(page.getByRole("heading", { name: "Endcap A" })).toBeVisible();
  await expect(page.getByText("Wine gondolas", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("Central gondola endcaps", { exact: true })).toBeVisible();
  await expect(page.getByText("Approx. 24 cases", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Persistent Display Area Profile" })).toHaveAttribute("href", `/display-areas/${endcapAId}`);
  await expect(page.getByRole("main").getByRole("link", { name: /Store workspace/ })).toHaveAttribute("href", "/stores/10000000-0000-4000-8000-000000000001/workspace");
});

test("supports direct floorplan selection and linked destinations", async ({ page }) => {
  await page.goto(`${crownIsleFloorplan}?area=${endcapAId}`);
  await expect(page.getByRole("heading", { name: "Endcap A" })).toBeVisible();
  await expect(page.getByLabel(/Endcap A, Selected/)).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("link", { name: "Persistent Display Area Profile" }).click();
  await expect(page.getByRole("heading", { name: "Crown Isle / Endcap A" })).toBeVisible();

  await page.goto(`${crownIsleFloorplan}?area=${endcapAId}`);
  await page.getByRole("main").getByRole("link", { name: /Store workspace/ }).click();
  await expect(page.getByRole("heading", { name: "Crown Isle merchandising workspace" })).toBeVisible();
});

test("selects a floorplan display area with the keyboard", async ({ page }) => {
  await page.goto(crownIsleFloorplan);
  const area = page.getByLabel("Crown Isle merchandising floorplan").getByRole("button", { name: /Cooler Doors 1-4/ });

  await area.focus();
  await expect(area).toBeFocused();
  await area.press("Enter");

  await expect(page).toHaveURL(/\?area=40000000-0000-4000-8000-000000000003$/);
  await expect(page.getByRole("heading", { name: "Cooler Doors 1-4" })).toBeVisible();
});

test("keeps the floorplan within the viewport at desktop widths", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${crownIsleFloorplan}?area=${endcapAId}`);
    await expect(page.getByLabel("Crown Isle merchandising floorplan")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`floorplan-${viewport.width}.png`), fullPage: true });
  }
});

test("navigates the Crown Isle merchandising workflow", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Merchandising Dashboard" })).toBeVisible();
  await page.getByRole("link", { name: "Displays" }).click();
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

const directRoutes = [
  { path: "/campaigns", heading: "Campaigns" },
  { path: "/stores/10000000-0000-4000-8000-000000000001/floorplan", heading: "Crown Isle floorplan" },
  { path: "/stores/10000000-0000-4000-8000-000000000001/workspace", heading: "Crown Isle merchandising workspace" },
  { path: "/executions/70000000-0000-4000-8000-000000000001", heading: "September Beer Feature" },
  { path: "/compliance/70000000-0000-4000-8000-000000000001", heading: "Compliance review" },
  { path: "/performance", heading: "Performance & Recommendations" },
  { path: "/display-areas/40000000-0000-4000-8000-000000000001", heading: "Crown Isle / Endcap A" },
];

for (const route of directRoutes) {
  test(`loads and refreshes ${route.path}`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${route.path.replaceAll("/", "\\/")}$`));
  });
}

test("keeps the application shell responsive without page overflow", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`shell-${viewport.width}.png`), fullPage: true });
  }

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("shell-tablet.png"), fullPage: true });
});
