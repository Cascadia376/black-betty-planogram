import { expect, test } from "@playwright/test";
import { createCascadiaOndWorkbook } from "../fixtures/cascadiaOndWorkbook";
import { cascadiaOndRows } from "../fixtures/cascadiaOndRows";

declare const Buffer: { from(input: Uint8Array): Uint8Array };

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("presents the merchandising dashboard priorities and actions", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  await expect(page).toHaveTitle("Black Betty | Cascadia Merchandising");
  await expect(page.getByText("Black Betty", { exact: true })).toBeVisible();
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
  await expect(page.getByRole("link", { name: "Open OND 2026" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Upload spreadsheets" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "View campaigns" }).first()).toHaveAttribute("href", "/campaigns");
  await expect(page.getByRole("link", { name: "Review compliance" }).first()).toHaveAttribute("href", /\/compliance\//);
  await expect(page.getByRole("link", { name: "View performance" }).first()).toHaveAttribute("href", "/performance");
  await expect(page.getByRole("link", { name: /September Beer Feature/ }).first()).toHaveAttribute("href", /\/campaigns\//);
  await expect(page.getByRole("link", { name: /Crown Isle \/ Endcap A/ }).last()).toHaveAttribute("href", /\/display-areas\//);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("shows a store-manager operational navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByLabel("Demo role").last().selectOption("store_manager");
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(navigation.getByRole("link", { name: "My workspace" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Orders" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Campaigns" })).toHaveCount(0);
  await expect(navigation.getByRole("link", { name: "Uploads" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "New campaign" })).toHaveCount(0);
});

test("explains OND performance learning from program to product", async ({ page }) => {
  await page.goto("/performance");
  await expect(page.getByRole("heading", { name: "Performance & Recommendations" })).toBeVisible();
  for (const filter of ["Program", "Store", "Display area", "Assignment", "Product", "Period / reset"]) {
    await expect(page.getByLabel(filter)).toBeVisible();
  }
  const summary = page.getByRole("region", { name: "OND performance summary" });
  await expect(summary.getByText("$18,500", { exact: true })).toBeVisible();
  await expect(summary.getByText("750", { exact: true })).toBeVisible();
  await expect(summary.getByText("$5,670", { exact: true })).toBeVisible();
  await expect(summary.getByText("$360", { exact: true })).toBeVisible();

  for (const question of ["Which display areas worked best?", "Which products repeatedly stocked out?", "Which allocations were too high?", "Which allocations were too low?", "Which bridge buys created value?", "Which bridge buys left excess inventory?", "Which reset periods caused issues?"]) {
    await expect(page.getByRole("heading", { name: question })).toBeVisible();
  }
  const learning = page.getByRole("heading", { name: "OND learning answers" }).locator("xpath=ancestor::section[1]");
  await expect(learning.getByText("Mock Harvest Red Feature", { exact: true }).first()).toBeVisible();
  await expect(learning.getByText("Mock Cream Liqueur Gift Pack", { exact: true }).first()).toBeVisible();
  await expect(learning.getByText(/Rule: Flag a product when stockout rate/)).toBeVisible();

  const results = page.getByRole("heading", { name: "OND measured results" }).locator("xpath=ancestor::section[1]");
  await expect(results.locator("tbody tr")).toHaveCount(6);
  await page.getByLabel("Product").selectOption({ label: "Mock Harvest Red Feature" });
  await expect(results.locator("tbody tr")).toHaveCount(2);
  await results.getByRole("button", { name: "Drill down" }).last().click();
  await expect(page.getByText("Recommended / actual order", { exact: true })).toBeVisible();
  await expect(page.getByText("Projected / actual residual", { exact: true })).toBeVisible();
  await expect(page.getByText("Bridge sell-through", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Crown Isle / Feature Area 1" })).toHaveAttribute("href", /\/display-areas\//);
  await expect(page.getByRole("link", { name: /Assignment/ })).toHaveAttribute("href", /\/programs\/.*\/allocations/);
});

test("keeps OND performance learning within desktop and tablet viewports", async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/performance");
    await expect(page.getByRole("heading", { name: "Performance & Recommendations" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

const crownIsleFloorplan = "/stores/10000000-0000-4000-8000-000000000001/floorplan";
const endcapAId = "40000000-0000-4000-8000-000000000001";
const crownW1Id = "42000000-0000-4000-8000-000000000020";
const ondProgramId = "c0000000-0000-4000-8000-000000000001";
const ondProgram = `/programs/${ondProgramId}`;
const ondAllocations = `${ondProgram}/allocations`;
const ondImport = `${ondProgram}/import`;
const ondFloorplan = `${crownIsleFloorplan}?program=${ondProgramId}`;
const crownIsleOrders = `/stores/10000000-0000-4000-8000-000000000001/orders?program=${ondProgramId}`;
const crownIsleWorkspace = "/stores/10000000-0000-4000-8000-000000000001/workspace";
const ondSeasonalExecution = "/executions/70000000-0000-4000-8000-000000000002";

test("links to available spreadsheet upload workflows", async ({ page }) => {
  await page.goto("/imports");
  await expect(page.getByRole("heading", { name: "Spreadsheet imports" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "OND allocation spreadsheet" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Monthly flyer spreadsheet" })).toBeVisible();
  await expect(page.getByText("Available", { exact: true })).toBeVisible();
  await expect(page.getByText("Planned", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Upload OND spreadsheet" })).toHaveAttribute("href", ondImport);
  await expect(page.getByRole("link", { name: "Create monthly flyer manually" })).toHaveAttribute("href", "/campaigns/new");
  await page.getByRole("link", { name: "Upload OND spreadsheet" }).click();
  await expect(page.getByRole("heading", { name: "OND 2026 legacy allocation import" })).toBeVisible();
});

test("creates campaign metadata and continues to the Product Master workspace", async ({ page }) => {
  await page.goto("/campaigns/new");
  await expect(page.getByRole("heading", { name: "New campaign" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Campaign planning steps" })).toBeVisible();
  for (const field of ["Campaign name", "Campaign type", "Owner", "Start date", "End date", "Supplier / partner", "Description"]) {
    await expect(page.getByLabel(field)).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Display requirements" })).toHaveCount(0);
  for (const removed of ["Minimum facings", "Minimum quantities", "Signage", "Display type", "Priority", "Execution notes", "Prescriptive"]) {
    await expect(page.getByText(removed, { exact: true })).toHaveCount(0);
  }
  await expect(page.getByLabel("Campaign type").getByRole("option", { name: "OND" })).toHaveCount(1);
  await page.getByLabel("Campaign name").fill("Synthetic Phase 1 Campaign");
  await page.getByLabel("Campaign type").selectOption("OND");
  await page.getByRole("button", { name: "Create campaign and continue" }).click();
  await expect(page).toHaveURL(/\/campaigns\/[^/]+\/products$/);
  await expect(page.getByRole("heading", { name: "Synthetic Phase 1 Campaign" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Campaign planning steps" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add products" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Bulk add SKUs" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Import known-format spreadsheet" })).toBeEnabled();
  await expect(page.getByRole("status")).toContainText("Synthetic Phase 1 Campaign created and saved");
  const campaignUrl = page.url().replace(/\/products$/, "");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Synthetic Phase 1 Campaign" })).toBeVisible();
  await page.goto("/campaigns");
  await page.getByRole("link", { name: "Synthetic Phase 1 Campaign", exact: true }).click();
  await expect(page).toHaveURL(campaignUrl);
  await page.getByRole("link", { name: "Edit details" }).click();
  await page.getByLabel("Description").fill("Updated and persisted campaign details");
  await page.getByRole("button", { name: "Save campaign" }).click();
  await expect(page.getByRole("status")).toContainText("changes saved");
  await page.reload();
  await expect(page.getByText("Updated and persisted campaign details", { exact: true })).toBeVisible();
  await expect(page.getByText("Total products", { exact: true })).toBeVisible();
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  await expect(page.getByText("Review required", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to Displays" })).toBeDisabled();
});

test("adds and manages Product Master campaign products", async ({ page }) => {
  await page.goto("/campaigns/new");
  await page.getByLabel("Campaign name").fill("Product Master Intake Test");
  await page.getByRole("button", { name: "Create campaign and continue" }).click();
  await expect(page).toHaveURL(/\/campaigns\/[^/]+\/products$/);

  await page.getByRole("button", { name: "Add products" }).click();
  const dialog = page.getByRole("dialog", { name: "Add products" });
  const search = dialog.getByLabel("Search Product Master");
  await search.fill("MOCK-1001");
  await expect(dialog.getByText("Coastal Lager 12 Pack", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Case pack: 2/)).toBeVisible();
  await search.fill("Harvest Red");
  await expect(dialog.getByText("MOCK-2001", { exact: true })).toBeVisible();
  await search.fill("MOCK-");
  await dialog.locator("label").filter({ hasText: "MOCK-1001" }).getByRole("checkbox").check();
  await dialog.locator("label").filter({ hasText: "MOCK-2001" }).getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Add selected products" }).click();

  await expect(page.getByRole("row", { name: /MOCK-1001.*Coastal Lager 12 Pack.*Beer/ })).toBeVisible();
  const coastalRow = page.getByRole("row", { name: /MOCK-1001/ });
  await coastalRow.getByLabel("Role for MOCK-1001").selectOption("Optional");
  await coastalRow.getByLabel("Required MOCK-1001").uncheck();
  await expect(coastalRow).toContainText("Optional");

  await page.getByRole("button", { name: "Add products" }).click();
  const inactiveDialog = page.getByRole("dialog", { name: "Add products" });
  await inactiveDialog.getByLabel("Search Product Master").fill("MOCK-OLD-9001");
  await expect(inactiveDialog.getByText("Inactive · Review", { exact: true })).toBeVisible();
  await inactiveDialog.locator("label").filter({ hasText: "MOCK-OLD-9001" }).getByRole("checkbox").check();
  await inactiveDialog.getByRole("button", { name: "Add selected products" }).click();
  await expect(page.getByRole("row", { name: /MOCK-OLD-9001.*Inactive.*Review/ })).toBeVisible();
  await expect(page.getByText("Review required", { exact: true }).locator("xpath=following-sibling::dd")).toHaveText("1");

  await page.getByRole("button", { name: "Add products" }).click();
  const duplicateDialog = page.getByRole("dialog", { name: "Add products" });
  await duplicateDialog.getByLabel("Search Product Master").fill("MOCK-1001");
  await expect(duplicateDialog.getByText("Already added", { exact: true })).toBeVisible();
  await expect(duplicateDialog.locator("label").filter({ hasText: "MOCK-1001" }).getByRole("checkbox")).toBeDisabled();
  await duplicateDialog.getByRole("button", { name: "Close" }).click();

  await page.getByRole("row", { name: /MOCK-2001/ }).getByRole("button", { name: "Remove MOCK-2001" }).click();
  await expect(page.getByRole("row", { name: /MOCK-2001/ })).toHaveCount(0);

  const campaignUrl = page.url().replace(/\/products$/, "");
  await page.goto(campaignUrl);
  await expect(page.getByRole("navigation", { name: "Campaign planning steps" }).getByRole("link", { name: /Products.*warning/ })).toBeVisible();
});

test("reviews bulk SKUs and creates a pending campaign product", async ({ page }) => {
  await page.goto("/campaigns/new");
  await page.getByLabel("Campaign name").fill("Bulk SKU Intake Test");
  await page.getByRole("button", { name: "Create campaign and continue" }).click();

  await page.getByRole("button", { name: "Bulk add SKUs" }).click();
  const bulkDialog = page.getByRole("dialog", { name: "Bulk add SKUs" });
  await bulkDialog.getByLabel("Paste SKUs").fill("MOCK-1001\nMOCK-1002, 001234\tMOCK-1001\nABC???");
  await bulkDialog.getByRole("button", { name: "Review SKUs" }).click();
  await expect(bulkDialog.getByText("MATCHED", { exact: true })).toBeVisible();
  await expect(bulkDialog.getByText("NEW / UNKNOWN", { exact: true })).toBeVisible();
  await expect(bulkDialog.getByText("INVALID", { exact: true })).toBeVisible();
  await expect(bulkDialog.getByText("Submitted", { exact: true }).locator("xpath=following-sibling::p")).toHaveText("4");
  await expect(bulkDialog.getByText("001234", { exact: true })).toBeVisible();
  await expect(bulkDialog.getByText("ABC???", { exact: true })).toBeVisible();

  await bulkDialog.getByRole("button", { name: "Resolve new products" }).click();
  const pendingDialog = page.getByRole("dialog", { name: "Create pending product" });
  await expect(pendingDialog.getByLabel("Pending product SKU")).toHaveValue("001234");
  await pendingDialog.getByLabel("Pending product name").fill("Synthetic Bulk Product");
  await pendingDialog.getByLabel("Pending product category").fill("Wine");
  await pendingDialog.getByLabel("Pending product brand").fill("Synthetic Estate");
  await pendingDialog.getByLabel("Pending product case pack").fill("6");
  await pendingDialog.getByRole("button", { name: "Create pending product" }).click();

  await bulkDialog.getByRole("button", { name: "Add matched products" }).click();
  await expect(page.getByRole("row", { name: /001234.*Synthetic Bulk Product.*New.*Needs Product Master Review/ })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("1 product need review");

  await page.getByRole("button", { name: "Bulk add SKUs" }).click();
  const duplicateDialog = page.getByRole("dialog", { name: "Bulk add SKUs" });
  await duplicateDialog.getByLabel("Paste SKUs").fill("MOCK-1001");
  await duplicateDialog.getByRole("button", { name: "Review SKUs" }).click();
  await expect(duplicateDialog.getByText("ALREADY ADDED", { exact: true })).toBeVisible();
  await expect(duplicateDialog.getByText("MOCK-1001 · Coastal Lager 12 Pack", { exact: true })).toBeVisible();
  await duplicateDialog.getByRole("button", { name: "Close" }).click();
  await page.getByRole("link", { name: "Continue to Displays" }).click();
  await expect(page).toHaveURL(/\/campaigns\/[^/]+\/display$/);
  await expect(page.getByRole("heading", { name: "Bulk SKU Intake Test" })).toBeVisible();
});

test("summarizes campaign workflow status without legacy display requirements", async ({ page }) => {
  await page.goto("/campaigns/50000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("heading", { name: "Product readiness" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Display planning" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stores" })).toBeVisible();
  await expect(page.getByText("Display type", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Assign stores" }).first()).toBeVisible();
});

test("validates and applies campaign product spreadsheets in the Products workflow", async ({ page }) => {
  await page.goto("/campaigns/new");
  await page.getByLabel("Campaign name").fill("Campaign Product Import Test");
  await page.getByRole("button", { name: "Create campaign and continue" }).click();
  await page.getByRole("button", { name: "Import known-format spreadsheet" }).click();
  const dialog = page.getByRole("dialog", { name: "Upload campaign products" });
  await dialog.locator('input[type="file"]').setInputFiles({ name: "campaign-products.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(createCascadiaOndWorkbook([[
    "SKU", "Role", "Required", "Notes"], ["MOCK-1001", "Feature", "Yes", "Imported feature"], ["001234", "Core", "No", ""], ["ABC???", "Feature", "Yes", ""]])) as never });
  await expect(dialog.getByText("Matched", { exact: true }).locator("xpath=following-sibling::p")).toHaveText("1");
  await expect(dialog.getByText("Pending new", { exact: true }).locator("xpath=following-sibling::p")).toHaveText("1");
  await expect(dialog.getByText("Invalid", { exact: true }).locator("xpath=following-sibling::p")).toHaveText("1");
  await expect(page.getByRole("row", { name: /MOCK-1001/ })).toHaveCount(0);

  await dialog.getByRole("button", { name: "Resolve pending" }).click();
  const pending = page.getByRole("dialog", { name: "Resolve pending product" });
  await pending.getByLabel("Pending import product name").fill("Imported Pending Product");
  await pending.getByLabel("Pending import category").fill("Wine");
  await pending.getByRole("button", { name: "Create pending product" }).click();
  await dialog.getByRole("button", { name: "Omit row 4" }).click();
  await dialog.getByRole("button", { name: "Apply approved products" }).click();
  await expect(page.getByRole("row", { name: /MOCK-1001.*Feature/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /001234.*Imported Pending Product.*New.*Needs Product Master Review/ })).toBeVisible();

  await page.getByRole("button", { name: "Import known-format spreadsheet" }).click();
  const duplicate = page.getByRole("dialog", { name: "Upload campaign products" });
  await duplicate.locator('input[type="file"]').setInputFiles({ name: "campaign-products-duplicate.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(createCascadiaOndWorkbook([[
    "SKU", "Role", "Required", "Notes"], ["MOCK-1001", "Feature", "Yes", ""]])) as never });
  await expect(duplicate.getByText("Duplicate", { exact: true }).locator("xpath=following-sibling::p")).toHaveText("1");
});

test("reviews and applies the known Cascadia OND workbook", async ({ page }, testInfo) => {
  await page.goto(ondImport);
  await expect(page.getByRole("heading", { name: "OND 2026 legacy allocation import" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Required columns" })).toBeVisible();
  const bytes = createCascadiaOndWorkbook();
  await page.getByLabel("Choose OND allocation workbook").setInputFiles({ name: "cascadia-ond-allocation-v1.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(bytes) as never });
  await expect(page.getByRole("heading", { name: "Import review" })).toBeVisible();
  await expect(page.getByText("3 ready", { exact: true })).toBeVisible();
  await expect(page.getByText("0 errors", { exact: true })).toBeVisible();
  await expect(page.getByText("18", { exact: true })).toBeVisible();
  for (const viewport of [{ width: 1280, height: 900 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`import-review-${viewport.width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Approve import" }).click();
  await expect(page.getByRole("button", { name: "Import applied" })).toBeVisible();
  await page.getByRole("link", { name: "Open imported allocations" }).click();
  await page.getByLabel("Store").selectOption({ label: "Eagle Creek" });
  await expect(page.getByText("2 of 6 assignments", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: /24 total 18 \+ 6/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: /14 total 14/ })).toBeVisible();
});

test("resolves an ambiguous reset date inside import review", async ({ page }) => {
  const rows = structuredClone(cascadiaOndRows);
  rows[1][9] = "";
  rows[1][10] = "Reset Nov 12 for holiday assortment";
  await page.goto(ondImport);
  await page.locator('input[type="file"]').setInputFiles({ name: "ond-warning.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(createCascadiaOndWorkbook(rows)) });
  await expect(page.getByText("1 review", { exact: true })).toBeVisible();
  await page.getByLabel("Reset date for row 2").fill("2026-11-12");
  await page.getByRole("button", { name: "Apply resolution" }).click();
  await expect(page.getByText("3 ready", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve import" })).toBeVisible();
});

test("completes and reviews an OND display assignment", async ({ page }) => {
  await page.goto(ondSeasonalExecution);
  await expect(page.getByRole("heading", { name: "Autumn Gathering" })).toBeVisible();
  await expect(page.getByText("OND 2026", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("4 · Feature Area 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Assignment period", { exact: true })).toBeVisible();
  await expect(page.getByText("No reset scheduled", { exact: true })).toBeVisible();

  const products = page.getByRole("heading", { name: "Assignment products" }).locator("xpath=ancestor::section[1]");
  await expect(products.getByText("MOCK-OND-1001", { exact: false })).toBeVisible();
  await expect(products.getByText("10 cases", { exact: true })).toBeVisible();
  await expect(products.getByText("5 cases on hand", { exact: true })).toBeVisible();
  await expect(products.getByText(/2 inbound/)).toBeVisible();
  await expect(products.getByText("Mock Coastal Distribution", { exact: true }).first()).toBeVisible();

  await page.getByLabel("Unavailable SKU").first().check();
  await page.getByLabel("Request an approved substitution").check();
  await page.getByLabel("Completion note").fill("Synthetic OND execution with one stock gap.");
  await page.getByLabel("Completion photo").setInputFiles("tests/fixtures/ond-display.jpg");
  await page.getByRole("button", { name: "Submit completion" }).click();

  await expect(page.getByRole("heading", { name: "Compliance review" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assignment requirements" })).toBeVisible();
  for (const check of ["Correct persistent display used", "Required assignment products present", "Required signage present", "Minimum merchandising requirement met", "Only approved substitutions used", "No major execution-time stock gaps"]) {
    await expect(page.getByText(check, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("50%", { exact: true })).toBeVisible();
  await expect(page.getByText("ond-display.jpg", { exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic OND execution with one stock gap.", { exact: true })).toBeVisible();
  await expect(page.getByText("Approval requested", { exact: true })).toBeVisible();
  await expect(page.getByText("Recommended order", { exact: true })).toHaveCount(0);
  await expect(page.getByText("On order", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByRole("status")).toContainText("saved");
});

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

test("creates a supplier order batch and records inbound stock", async ({ page }) => {
  await page.goto(crownIsleOrders);
  const createOrder = page.getByRole("button", { name: "Create supplier order" }).first();
  await expect(createOrder).toBeVisible();
  await createOrder.click();
  await expect(page.getByRole("status")).toContainText("Supplier order");
  await expect(page.getByText("Submitted orders", { exact: true })).toBeVisible();
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
  await editor.getByLabel("Destination display").selectOption({ label: "Display 1 · Endcap A" });
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
  await expect(page.getByRole("heading", { name: "Program store scope" })).toBeVisible();
  await expect(page.getByLabel("Include Crown Isle")).toBeChecked();
  await expect(page.getByLabel("Include Eagle Creek")).toBeChecked();
  await expect(page.getByText("Nov 12 reset", { exact: true })).toBeVisible();
  await expect(page.getByText("Upcoming resets", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Display 1 · Endcap A/)).toBeVisible();
  await expect(page.getByText(/Display 3 · Cooler Doors 1-4/)).toBeVisible();

  await expect(page.getByRole("link", { name: /Open store/ }).first()).toHaveAttribute("href", "/stores/10000000-0000-4000-8000-000000000001/workspace");
  await expect(page.getByRole("link", { name: "Review display assignments" })).toHaveAttribute("href", ondFloorplan);
  await expect(page.getByRole("link", { name: "Review orders" })).toHaveAttribute("href", "#ordering-exceptions");
});

test("publishes OND into versioned execution and ordering work", async ({ page }) => {
  await page.goto(ondProgram);
  await page.getByRole("button", { name: "Publish to stores" }).click();
  await expect(page.getByRole("status")).toContainText("Program published · version 1");
  await expect(page.getByRole("status")).toContainText("4 execution tasks and 8 order recommendations generated");
  await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: /Open store/ }).first().click();
  await expect(page.getByText("OND 2026 reset", { exact: true })).toBeVisible();
  await expect(page.getByText("Display 1 · Due Nov 12, 2026", { exact: true })).toBeVisible();
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
    await page.evaluate(() => window.scrollTo(0, 0));
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
  await expect(canvas.getByRole("button", { name: /category space/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Base floorplan" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Campaign placements" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Category layout" }).click();
  await expect(canvas.getByRole("button", { name: /category space/ })).toHaveCount(21);
  await expect(canvas.getByRole("button", { name: /, Available,/ })).toHaveCount(31);
  await expect(canvas.getByRole("button", { name: /W1, Wine Large Display zone 1, Available/ })).toBeVisible();

  await canvas.getByRole("button", { name: /W1, Wine Large Display zone 1/ }).click();

  await expect(page).toHaveURL(new RegExp(`\\?area=${crownW1Id}$`));
  await expect(page.getByRole("heading", { name: "Wine Large Display zone 1" })).toBeVisible();
  await expect(page.getByText("Local W1 · Global CI-W1", { exact: true })).toBeVisible();
  await expect(page.getByText("Crown Isle.docx; Master Display Naming.xlsx", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Persistent Display Area Profile" })).toHaveAttribute("href", `/display-areas/${crownW1Id}`);
  await expect(page.getByRole("main").getByRole("link", { name: /Store workspace/ })).toHaveAttribute("href", "/stores/10000000-0000-4000-8000-000000000001/workspace");
});

test("toggles, selects, and edits a regular Crown Isle category space", async ({ page }) => {
  await page.goto(crownIsleFloorplan);
  const canvas = page.getByLabel("Crown Isle merchandising floorplan");
  const categoryToggle = page.getByRole("button", { name: "Category layout" });

  await categoryToggle.click();
  await canvas.getByRole("button", { name: "Vodka category space" }).click();
  await expect(page.getByRole("heading", { name: "Vodka" })).toBeVisible();
  await expect(page.getByText("18", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Edit category space" }).click();
  await page.getByLabel("Subcategory").fill("Core vodka");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Core vodka", { exact: true })).toBeVisible();
});

test("renders representative imported store layouts with category overlays", async ({ page }, testInfo) => {
  const stores = [
    ["Allandale", "10000000-0000-4000-8000-000000000003", "allandale.png", 40, 73, 13],
    ["Caddy Bay", "10000000-0000-4000-8000-000000000004", "caddy-bay.png", 30, 66, 12],
    ["Port Alberni", "10000000-0000-4000-8000-000000000009", "port-alberni.png", 36, 60, 10],
    ["Quadra", "10000000-0000-4000-8000-000000000010", "quadra.png", 54, 98, 22],
    ["Royal Bay", "10000000-0000-4000-8000-000000000011", "royal-bay.png", 37, 70, 18],
    ["Uptown", "10000000-0000-4000-8000-000000000012", "uptown.png", 30, 84, 27],
  ] as const;
  for (const [name, id, asset, mapped, total, displayCount] of stores) {
    await page.goto(`/stores/${id}/floorplan`);
    const canvas = page.getByLabel(`${name} merchandising floorplan`);
    await expect(canvas).toBeVisible();
    await expect(canvas.getByAltText(`${name} store layout background`)).toHaveAttribute("src", `/floorplans/${asset}`);
    await page.getByRole("button", { name: "Category layout" }).click();
    await expect(canvas.getByRole("button", { name: /category space/ })).toHaveCount(mapped);
    await expect(page.getByText(`${mapped} mapped · ${total} source-backed category spaces · ${displayCount} display areas`)).toBeVisible();
    await expect(canvas.getByRole("button", { name: /W1,/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${asset.replace(".png", "")}-layout.png`), fullPage: true });
  }
});

test("opens verified display metadata for Crown Isle, Eagle Creek, Royal Bay, and Quadra", async ({ page }, testInfo) => {
  const stores = [
    ["Crown Isle", "10000000-0000-4000-8000-000000000001"],
    ["Eagle Creek", "10000000-0000-4000-8000-000000000002"],
    ["Royal Bay", "10000000-0000-4000-8000-000000000011"],
    ["Quadra", "10000000-0000-4000-8000-000000000010"],
  ] as const;

  for (const [name, storeId] of stores) {
    await page.goto(`/stores/${storeId}/floorplan`);
    const canvas = page.getByLabel(`${name} merchandising floorplan`);
    await expect(canvas.getByAltText(`${name} store layout background`)).toBeVisible();
    await canvas.getByRole("button", { name: /W1,/ }).click();
    await expect(page.getByText(new RegExp(`Local W1 · Global .*W1`))).toBeVisible();
    await expect(page.getByText(/\.docx; Master Display Naming\.xlsx/, { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit Display Area" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${name.toLowerCase().replaceAll(" ", "-")}-verified-displays.png`), fullPage: true });
  }

  await page.getByRole("link", { name: "Edit Display Area" }).click();
  await page.getByLabel("Notes").fill("Representative E2E correction.");
  await page.getByRole("button", { name: "Save display area" }).click();
  await expect(page.getByText("Representative E2E correction.", { exact: true })).toBeVisible();
});

test("selects an active verified area during campaign allocation", async ({ page }) => {
  await page.goto("/campaigns/50000000-0000-4000-8000-000000000004/assign");
  await page.getByRole("button", { name: "Include all stores" }).click();
  await page.getByRole("button", { name: "Suggest for all stores" }).first().click();
  await page.getByRole("button", { name: "Choose / quantities" }).first().click();
  const location = page.getByLabel("Physical display area").first();
  await location.selectOption("42000000-0000-4000-8000-000000000010");
  await expect(location).toHaveValue("42000000-0000-4000-8000-000000000010");
  await expect(page.getByText(/Multi Front end 1 \(M1\)/).first()).toBeVisible();
});

test("creates and edits a DisplayArea while protecting referenced areas", async ({ page }) => {
  await page.goto(`/stores/10000000-0000-4000-8000-000000000004/display-areas/new`);
  await page.getByLabel("Display number").fill("1");
  await page.getByLabel("Global code").fill("CB-TEST-01");
  await page.getByLabel("Name").fill("Buyer-defined feature");
  await page.getByLabel("Description").fill("Human-defined promotional location.");
  await page.getByLabel("Capacity").fill("To be verified");
  await page.getByRole("button", { name: "Save display area" }).click();
  await expect(page.getByRole("heading", { name: "Buyer-defined feature" })).toBeVisible();
  await page.getByRole("link", { name: "Edit Display Area" }).click();
  await page.getByLabel("Name").fill("Verified buyer feature");
  await page.getByLabel("Verification").selectOption("verified");
  await page.getByLabel("Source reference").fill("Buyer verification test");
  await page.getByRole("button", { name: "Save display area" }).click();
  await expect(page.getByRole("heading", { name: "Verified buyer feature" })).toBeVisible();

  await page.goto(`/display-areas/${endcapAId}/edit`);
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("alert")).toContainText("Deactivate it instead");
});

test("supports direct floorplan selection and linked destinations", async ({ page }) => {
  await page.goto(`${crownIsleFloorplan}?area=${crownW1Id}`);
  await expect(page.getByRole("heading", { name: "Wine Large Display zone 1" })).toBeVisible();
  await expect(page.getByLabel(/W1, Wine Large Display zone 1, Selected/)).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("link", { name: "Persistent Display Area Profile" }).click();
  await expect(page.getByRole("heading", { name: "Crown Isle / Wine Large Display zone 1" })).toBeVisible();

  await page.goto(`${crownIsleFloorplan}?area=${crownW1Id}`);
  await page.getByRole("main").getByRole("link", { name: /Store workspace/ }).click();
  await expect(page.getByRole("heading", { name: "Crown Isle merchandising workspace" })).toBeVisible();
});

test("selects a floorplan display area with the keyboard", async ({ page }) => {
  await page.goto(crownIsleFloorplan);
  const area = page.getByLabel("Crown Isle merchandising floorplan").getByRole("button", { name: /W1, Wine Large Display zone 1/ });

  await area.focus();
  await expect(area).toBeFocused();
  await area.press("Enter");

  await expect(page).toHaveURL(new RegExp(`\\?area=${crownW1Id}$`));
  await expect(page.getByRole("heading", { name: "Wine Large Display zone 1" })).toBeVisible();
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
  await page.getByRole("button", { name: /W1, Wine Large Display zone 1/ }).click();
  await expect(page.getByRole("heading", { name: "Wine Large Display zone 1" })).toBeVisible();
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
  { path: "/campaigns/50000000-0000-4000-8000-000000000001", heading: "September Beer Feature" },
  { path: "/campaigns/50000000-0000-4000-8000-000000000001/products", heading: "September Beer Feature" },
  { path: "/imports", heading: "Spreadsheet imports" },
  { path: ondProgram, heading: "OND 2026" },
  { path: ondAllocations, heading: "OND 2026 allocations" },
  { path: ondImport, heading: "OND 2026 legacy allocation import" },
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
    await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "OND Program" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Uploads" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).not.toContainText(/OND \d{4}/);
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
