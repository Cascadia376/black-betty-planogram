import { expect } from "@playwright/test";
import { test } from "./localTest";
import { DEMO_SOURCE } from "../../src/services/promotion/demoExtractor";
const inboxKey = "black-betty-promotion-intelligence-demo-v1";
async function capture(page: import("@playwright/test").Page, text = DEMO_SOURCE) {
  const content = page.getByLabel("Communication content");
  if (!await content.isVisible()) await page.getByText("Capture a communication", { exact: true }).click();
  await page.getByLabel("Document title").fill("Synthetic supplier email");
  await content.fill(text);
  await page.getByRole("button", { name: "Extract and capture", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review opportunity", exact: true })).toBeVisible();
}
for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
  test(`buyer capture, correct, approve and recover campaign handoff at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.route("**/*.supabase.co/**", (route) => route.abort());
    const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/opportunities");
    await expect(page.getByRole("heading", { name: "Promotion Intelligence", exact: true })).toBeVisible();
    await expect(page.getByText("DEMO · literal extraction · browser storage")).toBeVisible();
    await capture(page);
    await expect(page.getByText("Insufficient Evidence", { exact: true })).toBeVisible();
    await expect(page.getByText("Missing or conflicting cost", { exact: true })).toBeVisible();
    await page.getByLabel("Product interpretation").fill("Jeremy reviewed Coastal Lager");
    await page.getByLabel("Jeremy’s judgement and corrections").fill("Positive discount response; cost and November dates need confirmation.");
    await page.getByText("Correct commercial interpretations", { exact: true }).click();
    await page.getByLabel("Buyer correction: format").fill("Use current Product Master 12-pack; supplier clarification requested");
    await page.getByLabel("Buyer decision").selectOption("UNDER_CONSIDERATION");
    await page.getByRole("button", { name: "Save review", exact: true }).click();
    await expect(page.getByLabel("Product interpretation")).toHaveValue("Jeremy reviewed Coastal Lager");
    await page.getByRole("button", { name: "Reconcile Product Master", exact: true }).click();
    await expect(page.getByText("MATCHED", { exact: true })).toBeVisible();
    await page.getByLabel("Buyer decision").selectOption("APPROVED");
    await page.getByRole("button", { name: "Save review", exact: true }).click();
    await page.getByLabel("New campaign name").fill(`Synthetic Betty draft ${viewport.width}`);
    await page.getByLabel("Confirmed campaign start").fill("2027-11-01");
    await page.getByLabel("Confirmed campaign end").fill("2027-11-30");
    // Simulate a failed inbox acknowledgement after the campaign has committed.
    await page.evaluate((key) => {
      const original = Storage.prototype.setItem;
      let fail = true;
      Storage.prototype.setItem = function(k, value) { if (fail && k === key && value.includes('"ADDED_TO_CAMPAIGN"')) { fail = false; throw new Error("Synthetic inbox failure"); } return original.call(this, k, value); };
    }, inboxKey);
    await page.getByRole("button", { name: "Add approved opportunity to campaign", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Synthetic inbox failure");
    await page.getByRole("button", { name: "Add approved opportunity to campaign", exact: true }).click();
    await expect(page).toHaveURL(/\/campaigns\/[^/]+\/products$/);
    await expect(page.getByRole("heading", { name: `Synthetic Betty draft ${viewport.width}`, exact: true })).toBeVisible();
    await expect(page.getByText("MOCK-1001", { exact: true }).first()).toBeVisible();
    await page.goto("/opportunities");
    await page.getByRole("button", { name: /Jeremy reviewed Coastal Lager/ }).click();
    await expect(page.getByRole("link", { name: "Open campaign draft", exact: true })).toBeVisible();
    const revision = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), inboxKey);
    expect(revision.workspace.sources).toHaveLength(1); expect(revision.workspace.opportunities[0].status).toBe("ADDED_TO_CAMPAIGN");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath(`promotion-inbox-${viewport.width}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}
test("duplicate capture, conflicting evidence and source deletion preserve history", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/opportunities");
  await capture(page);
  await capture(page);
  await expect(page.getByRole("status")).toContainText("already captured");
  await capture(page, DEMO_SOURCE + "\nPrice: $9.99 alternate offer");
  await expect(page.getByText("Conflicting price: buyer correction required", { exact: true })).toBeVisible();
  await page.getByLabel("Possible duplicate — review before associating").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Associate evidence with selected opportunity", exact: true }).click();
  await expect(page.getByText("Associated evidence", { exact: false })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Coastal Lager/ }).first().click();
  await expect(page.getByText("Conflicting price: buyer correction required", { exact: true })).toBeVisible();
  await page.getByText("Source retention and deletion", { exact: true }).click();
  await page.getByRole("button", { name: "Delete source", exact: true }).first().click();
  const revision = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), inboxKey);
  expect(revision.workspace.sources[0].text).toBe("");
  expect(revision.workspace.opportunities.every((o: { intelligence: { claims: Array<{ sourceId: string }> } }) => o.intelligence.claims.every((c) => c.sourceId !== revision.workspace.sources[0].id))).toBeTruthy();
});
