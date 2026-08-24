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
const ondProgramId = "c0000000-0000-4000-8000-000000000001";
const ondProgram = `/programs/${ondProgramId}`;
const ondAllocations = `${ondProgram}/allocations`;
const ondFloorplan = `${crownIsleFloorplan}?program=${ondProgramId}`;
const crownIsleOrders = `/stores/10000000-0000-4000-8000-000000000001/orders?program=${ondProgramId}`;
const crownIsleWorkspace = "/stores/10000000-0000-4000-8000-000000000001/workspace";

test("shows the OND execution and ordering attention queue", async ({ page }) => {
  await page.goto(crownIsleWorkspace);
  await expect(page.getByRole("heading", { name: "Crown Isle merchandising workspace" })).toBeVisible();
  await expect(page.getByText("What needs my attention?", { exact: false })).toBeVisible();

  for (const label of ["Displays to set", "Resets due", "Overdue tasks", "Issues", "Orders required today", "Products at risk", "Upcoming opening fills", "Bridge actions", "Exit-risk products"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }

  await expect(page.getByRole("heading", { name: "Operational timeline" })).toBeVisible();
  await expect(page.getByText("Next display reset", { exact: true })).toBeVisible();
  await expect(page.getByText("Nov 12, 2026", { exact: true })).toBeVisible();
  await expect(page.getByText("Next required delivery", { exact: true })).toBeVisible();
  await expect(page.getByText("Major holiday demand phase", { exact: true })).toBeVisible();
  await expect(page.getByText("Program end", { exact: true })).toBeVisible();

  await expect(page.getByText("RESET", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("ORDER", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("BRIDGE", { exact: true })).toBeVisible();
  await expect(page.getByText("EXIT", { exact: true })).toBeVisible();
  await expect(page.getByText("Order coverage: At risk.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open task/ }).first()).toHaveAttribute("href", /\/executions\//);
  await expect(page.getByRole("link", { name: "Open orders" }).first()).toHaveAttribute("href", crownIsleOrders);
  await expect(page.getByRole("link", { name: "Locate display" }).first()).toHaveAttribute("href", /\/floorplan\?/);
  await expect(page.getByRole("link", { name: "Report issue" }).first()).toHaveAttribute("href", /\/executions\//);
});

test("keeps the OND store workspace within desktop and tablet viewports", async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto(crownIsleWorkspace);
    await expect(page.getByRole("heading", { name: "Crown Isle merchandising workspace" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("shows order-today, bridge, and exit guidance for the store manager", async ({ page }) => {
  await page.goto(crownIsleOrders);
  await expect(page.getByRole("heading", { name: "Crown Isle orders" })).toBeVisible();
  const orderToday = page.getByRole("region", { name: "Order today" });
  await expect(orderToday.getByText("MOCK-OND-1001", { exact: true })).toBeVisible();
  await expect(orderToday.getByText("6 cases", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("Buying strategy: intentional bridge", { exact: true })).toBeVisible();
  await expect(page.getByText("Exit strategy: minimize post-program stock", { exact: true })).toBeVisible();
  const bridge = page.getByRole("region", { name: "Intentional bridge inventory" });
  await expect(bridge.getByText("Projected Jan 1 inventory", { exact: true })).toBeVisible();
  await expect(bridge.getByText("Bridge inventory", { exact: true })).toBeVisible();
  await expect(bridge.getByText("24 cases", { exact: true })).toBeVisible();
  await expect(bridge.getByText("$288.00", { exact: true })).toBeVisible();
  const residual = page.getByRole("region", { name: "Potential unwanted residual" });
  await expect(residual.getByText("Unwanted residual", { exact: true })).toBeVisible();
  await expect(residual.getByText("Unwanted residual", { exact: true }).locator("xpath=following-sibling::dd[1]")).toHaveText("5 cases");
  await expect(orderToday.getByRole("link", { name: "Locate display" })).toHaveAttribute("href", new RegExp(`program=${ondProgramId}.*area=`));
  await expect(orderToday.getByRole("link", { name: "Open assignment" })).toHaveAttribute("href", ondAllocations);
});

test("accepts and edits an order recommendation", async ({ page }) => {
  await page.goto(crownIsleOrders);
  const item = page.getByRole("region", { name: "Order today" });
  await item.getByRole("button", { name: "Accept" }).click();
  await expect(item.getByRole("status")).toContainText("accepted");
  await expect(item.getByText("Accepted", { exact: true })).toBeVisible();
  await item.getByRole("button", { name: "Edit cases" }).click();
  await item.getByLabel("Edited cases").fill("9");
  await item.getByRole("button", { name: "Save cases" }).click();
  await expect(item.getByRole("status")).toContainText("updated");
  await expect(item.getByText("9 cases", { exact: true })).toBeVisible();
  await expect(item.getByText("Edited", { exact: true })).toBeVisible();
});

test("marks a recommendation ordered and moves it to arriving soon", async ({ page }) => {
  await page.goto(crownIsleOrders);
  await page.getByRole("region", { name: "Order today" }).getByRole("button", { name: "Mark ordered" }).click();
  const arriving = page.getByRole("region", { name: "Arriving soon" });
  await expect(arriving.getByText("MOCK-OND-1001", { exact: true })).toBeVisible();
  await expect(arriving.getByText("Ordered", { exact: true })).toBeVisible();
});

test("keeps the store ordering assistant within desktop viewports", async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto(crownIsleOrders);
    await expect(page.getByRole("heading", { name: "Crown Isle orders" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("loads and filters the OND display allocation planner", async ({ page }) => {
  await page.goto(ondAllocations);
  await expect(page.getByRole("heading", { name: "OND 2026 allocations" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Display assignments" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Display #" })).toBeVisible();
  await expect(page.getByText("MOCK-OND-1001", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Display type").selectOption("cooler_doors");
  await expect(page.getByText("1 of 4 assignments")).toBeVisible();
  await expect(page.getByText("Cooler Doors 1-4", { exact: true })).toBeVisible();
});

test("edits store-specific quantities and validates allocation rules", async ({ page }) => {
  await page.goto(ondAllocations);
  await page.getByRole("button", { name: "Edit" }).first().click();
  const editor = page.getByRole("form", { name: "Assignment editor" });
  await expect(editor.getByText("Products", { exact: true })).toBeVisible();
  await expect(editor.getByLabel("Case quantity", { exact: true })).toHaveCount(2);
  await expect(editor.getByLabel("Supplier").first()).toContainText("Mock Coastal Distribution");

  await editor.getByLabel("Case quantity", { exact: true }).first().fill("0");
  await editor.getByRole("button", { name: "Save assignment" }).click();
  await expect(editor.getByRole("alert")).toContainText("case quantity of at least one");
  await editor.getByLabel("Case quantity", { exact: true }).first().fill("20");
  await editor.getByRole("button", { name: "Save assignment" }).click();
  await expect(editor.getByRole("status")).toContainText("saved to mock storage");

  await editor.getByTestId("display-area").selectOption(endcapAId);
  await editor.getByLabel("Program period").selectOption("");
  await editor.getByLabel("Start date").fill("2026-11-01");
  await editor.getByLabel("End date").fill("2026-11-30");
  await editor.getByRole("button", { name: "Save assignment" }).click();
  await expect(editor.getByRole("alert")).toContainText("cannot overlap");
});

test("copies an allocation to another synthetic store", async ({ page }) => {
  await page.goto(ondAllocations);
  await page.getByRole("button", { name: "Edit" }).first().click();
  const editor = page.getByRole("form", { name: "Assignment editor" });
  await editor.getByRole("button", { name: "Copy assignment to another store" }).click();
  await editor.getByRole("checkbox", { name: "Eagle Creek" }).check();
  await editor.getByRole("button", { name: "Create copy" }).click();
  await expect(editor.getByRole("status")).toContainText("copied to 1 store");
});

test("keeps the allocation planner within desktop viewports", async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto(ondAllocations);
    await expect(page.getByRole("heading", { name: "OND 2026 allocations" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("loads the OND program workspace with store and reset actions", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(ondProgram);

  await expect(page.getByRole("heading", { name: "OND 2026" })).toBeVisible();
  await expect(page.getByText("Program timeline", { exact: true })).toBeVisible();
  await expect(page.getByText("Nov 12 reset", { exact: true })).toBeVisible();
  await expect(page.getByText("Upcoming resets", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Display 1 · Endcap A/)).toBeVisible();
  await expect(page.getByText(/Display 3 · Cooler Doors 1-4/)).toBeVisible();

  await expect(page.getByRole("link", { name: /Open store/ }).first()).toHaveAttribute("href", "/stores/10000000-0000-4000-8000-000000000001/workspace");
  await expect(page.getByRole("link", { name: "Review display assignments" })).toHaveAttribute("href", ondFloorplan);
  await expect(page.getByRole("link", { name: "Review orders" })).toHaveAttribute("href", "#ordering-exceptions");
});

test("opens Crown Isle from the OND program workspace", async ({ page }) => {
  await page.goto(ondProgram);
  await page.getByRole("link", { name: /Open store/ }).first().click();
  await expect(page.getByRole("heading", { name: "Crown Isle merchandising workspace" })).toBeVisible();
});

test("keeps the OND program workspace within responsive viewports", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto(ondProgram);
    await expect(page.getByRole("heading", { name: "OND 2026" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`program-${viewport.width}.png`), fullPage: true });
  }
});

test("shows the current and next OND assignment for a selected display", async ({ page }) => {
  await page.goto(ondFloorplan);
  const canvas = page.getByLabel("Crown Isle merchandising floorplan");

  await expect(canvas.getByRole("button", { name: /Endcap A, Upcoming reset/ })).toBeVisible();
  await expect(canvas.getByRole("button", { name: /Feature Area 1, Current/ })).toBeVisible();
  await expect(canvas.getByRole("button", { name: /Cooler Doors 1-4, Requires attention/ })).toBeVisible();
  await canvas.getByRole("button", { name: /Endcap A/ }).click();

  await expect(page).toHaveURL(new RegExp(`program=${ondProgramId}&area=${endcapAId}$`));
  await expect(page.getByRole("heading", { name: "Endcap A" })).toBeVisible();
  await expect(page.getByText("Display 1 · CI-D01", { exact: true })).toBeVisible();
  await expect(page.getByText("Current assignment", { exact: true })).toBeVisible();
  await expect(page.getByText("Oct 1, 2026 - Nov 11, 2026", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("MOCK-OND-1001", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("12 cases", { exact: true })).toBeVisible();
  await expect(page.getByText("Bridge planned", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Next assignment", { exact: true })).toBeVisible();
  await expect(page.getByText("Reset Nov 12, 2026", { exact: true })).toBeVisible();
  await expect(page.getByText("MOCK-OND-2001", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("14 cases", { exact: true })).toBeVisible();
});

test("retains the OND program during keyboard display selection", async ({ page }) => {
  await page.goto(ondFloorplan);
  const area = page.getByLabel("Crown Isle merchandising floorplan").getByRole("button", { name: /Feature Area 1, Current/ });
  await area.focus();
  await expect(area).toBeFocused();
  await area.press("Enter");
  await expect(page).toHaveURL(new RegExp(`program=${ondProgramId}&area=40000000-0000-4000-8000-000000000004$`));
  await expect(page.getByRole("heading", { name: "Feature Area 1" })).toBeVisible();
});

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
    await page.goto(`${ondFloorplan}&area=${endcapAId}`);
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
  { path: ondProgram, heading: "OND 2026" },
  { path: ondAllocations, heading: "OND 2026 allocations" },
  { path: "/stores/10000000-0000-4000-8000-000000000001/floorplan", heading: "Crown Isle floorplan" },
  { path: "/stores/10000000-0000-4000-8000-000000000001/workspace", heading: "Crown Isle merchandising workspace" },
  { path: "/stores/10000000-0000-4000-8000-000000000001/orders", heading: "Crown Isle orders" },
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
