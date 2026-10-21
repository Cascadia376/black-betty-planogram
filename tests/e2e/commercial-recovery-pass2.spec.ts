import { expect } from "@playwright/test";
import { test } from "./localTest";
import { DEMO_SOURCE } from "../../src/services/promotion/demoExtractor";
const inboxKey = "black-betty-promotion-intelligence-demo-v1";
const modulePath = "/src/services/promotion/repository.ts";

test("two tabs serialize demo writes and reject the stale writer with native Web Locks", async ({ page, context }) => {
  await context.route("**/*.supabase.co/**", route => route.abort());
  await page.goto("/opportunities");
  const other = await context.newPage(); await other.goto("/opportunities");
  await page.evaluate(key => {
    void navigator.locks.request(key, () => new Promise<void>(resolve => { Object.assign(window, { releaseCommercialLock: resolve }); }));
  }, inboxKey);
  await expect.poll(() => page.evaluate(async () => (await navigator.locks.query()).held?.length)).toBe(1);
  const write = (target: typeof page, volume: number) => target.evaluate(async ({ path, volume }) => {
    const { DemoIntelligenceRepository } = await import(path);
    const workspace = { sources: [], opportunities: [], priorities: { volume, margin: 0, lift: 0 } };
    try { return { saved: await new DemoIntelligenceRepository(localStorage).save(workspace, 0) }; }
    catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
  }, { path: modulePath, volume });
  const first = write(page, 1), second = write(other, 2);
  await expect.poll(() => page.evaluate(async () => (await navigator.locks.query()).pending?.length)).toBe(2);
  await page.evaluate(() => (window as unknown as { releaseCommercialLock(): void }).releaseCommercialLock());
  const results = await Promise.all([first, second]);
  expect(results.filter(result => result.saved)).toHaveLength(1);
  expect(results.filter(result => result.error?.includes("Promotion inbox changed"))).toHaveLength(1);
  const persisted = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), inboxKey);
  expect(persisted.version).toBe(1);
  expect(persisted).toEqual(results.find(result => result.saved)!.saved);
  await other.close();
});

test("unsupported browser retains evidence inspection and refuses a demo mutation", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "locks", { value: undefined }));
  await page.goto("/opportunities");
  await page.getByRole("button", { name: "Load synthetic example", exact: true }).click();
  await page.getByRole("button", { name: "Extract and capture", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Demo inbox changes require Web Locks");
  expect(await page.evaluate(key => localStorage.getItem(key), inboxKey)).toBeNull();
  await expect(page.getByLabel("Communication content")).not.toBeEmpty();
  await page.getByRole("button", { name: "Reload inbox", exact: true }).click();
  await expect(page.getByText("Capture a source to begin.")).toBeVisible();
});

test("deleting a source removes current comparison eligibility and preserves historical receipts", async ({ page }, testInfo) => {
  page.on("dialog", dialog => dialog.accept());
  await page.route("**/*.supabase.co/**", route => route.abort());
  await page.goto("/opportunities");
  for (const text of [DEMO_SOURCE, DEMO_SOURCE + "\nJeremy: Second distinct synthetic offer"]) {
    const content = page.getByLabel("Communication content");
    if (!await content.isVisible()) await page.getByText("Capture a communication", { exact: true }).click();
    await content.fill(text);
    await page.getByRole("button", { name: "Extract and capture", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Review opportunity", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Reconcile Product Master", exact: true }).click();
    await expect(page.getByText("MATCHED", { exact: true })).toBeVisible();
    await page.getByLabel("Evidence start date").fill("2026-01-01");
    await page.getByLabel("Evidence end date").fill("2026-01-03");
    await page.getByRole("button", { name: "Load synthetic commercial fixture", exact: true }).click();
    await expect(page.getByText("SYNTHETIC commercial fixture · no live sales validation", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Save review", exact: true }).click();
    await expect(page.getByText("Retained decision receipts (1)", { exact: true })).toBeVisible();
  }
  await page.getByText("Ranking priorities", { exact: true }).click();
  await page.getByLabel("volume weight", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Save priorities", exact: true }).click();
  await page.getByText("Compare retained commercial evidence", { exact: true }).click();
  await expect(page.getByText(/Comparable Evidence · Identical source revision/)).toBeVisible();
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), inboxKey);
  await page.getByText("Source retention and deletion", { exact: true }).click();
  await page.getByRole("button", { name: "Delete source", exact: true }).first().click();
  await expect(page.getByText(/Insufficient Evidence · Every opportunity needs qualified evidence/)).toBeVisible();
  await expect(page.getByText("No retained receipt matches the current product identity.", { exact: true })).toBeVisible();
  await expect(page.getByText(/SKU MOCK-1001 · 2026-01-01 to 2026-01-03 · Stores .*SYNTHETIC \/ qualified/).first()).toBeVisible();
  await page.getByRole("button", { name: /Source deleted/ }).click();
  await expect(page.getByText("UNMATCHED", { exact: true })).toBeVisible();
  await expect(page.getByText("Retained decision receipts (1)", { exact: true })).toBeVisible();
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), inboxKey);
  expect(after.workspace.opportunities[0].intelligence.commercialDecisions).toEqual(before.workspace.opportunities[0].intelligence.commercialDecisions);
  // A workspace saved by PR13 may already contain the old stale product mapping.
  after.workspace.opportunities[0].authoritativeSku = before.workspace.opportunities[0].authoritativeSku;
  after.workspace.opportunities[0].productId = before.workspace.opportunities[0].productId;
  after.workspace.opportunities[0].intelligence.resolution = "MATCHED";
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: inboxKey, value: after });
  await page.reload();
  await page.getByText("Compare retained commercial evidence", { exact: true }).click();
  await expect(page.getByText(/Insufficient Evidence · Every opportunity needs qualified evidence/)).toBeVisible();
  await expect(page.getByText("No retained receipt matches the current product identity.", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("source-deleted-comparison.png"), fullPage: true });
});
