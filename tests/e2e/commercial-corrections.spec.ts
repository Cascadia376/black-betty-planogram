import { expect } from '@playwright/test';
import { test } from './localTest';

const inboxKey = 'black-betty-promotion-intelligence-demo-v1';

test('buyer can correct a SKU after loading evidence and retain receipts for both reviewed identities', async ({ page }, testInfo) => {
  await page.route('**/*.supabase.co/**', route => route.abort());
  await page.goto('/opportunities');
  await page.getByRole('button', { name: 'Load synthetic example', exact: true }).click();
  await page.getByRole('button', { name: 'Extract and capture', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review opportunity', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reconcile Product Master', exact: true }).click();
  await expect(page.getByText('MATCHED', { exact: true })).toBeVisible();
  async function loadFixture() {
    await page.getByLabel('Evidence start date').fill('2026-01-01');
    await page.getByLabel('Evidence end date').fill('2026-01-03');
    await page.getByRole('button', { name: 'Load synthetic commercial fixture', exact: true }).click();
    await expect(page.getByText('SYNTHETIC commercial fixture · no live sales validation', { exact: true })).toBeVisible();
  }
  await loadFixture();
  await page.getByRole('button', { name: 'Save review', exact: true }).click();
  await expect(page.getByText('Retained decision receipts (1)', { exact: true })).toBeVisible();
  const original = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).workspace.opportunities[0].intelligence.commercialDecisions, inboxKey);
  await loadFixture();
  await page.getByLabel('SKU interpretation', { exact: true }).fill('MOCK-1002');
  await expect(page.getByText('SYNTHETIC commercial fixture · no live sales validation', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Load synthetic commercial fixture', exact: true })).toBeDisabled();
  await expect(page.getByText(/Save the SKU correction, then reconcile Product Master/)).toBeVisible();
  await page.getByRole('button', { name: 'Save review', exact: true }).click();
  try {
    await expect(page.getByText('UNMATCHED', { exact: true })).toBeVisible();
  } finally {
    const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).workspace.opportunities[0], inboxKey);
    console.log(JSON.stringify({ probe: 'loaded-evidence-sku-correction', savedSku: state.supplierSku, resolution: state.intelligence.resolution, receiptCount: state.intelligence.commercialDecisions.length, error: await page.getByRole('alert').allTextContents() }));
    await page.screenshot({ path: testInfo.outputPath('sku-correction.png'), fullPage: true });
  }
  await expect(page.getByRole('button', { name: 'Load synthetic commercial fixture', exact: true })).toBeDisabled();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).workspace.opportunities[0].intelligence.commercialDecisions, inboxKey)).toEqual(original);
  await page.getByRole('button', { name: 'Reconcile Product Master', exact: true }).click();
  await expect(page.getByText('MATCHED', { exact: true })).toBeVisible();
  await loadFixture();
  await page.getByRole('button', { name: 'Save review', exact: true }).click();
  await expect(page.getByText('Retained decision receipts (2)', { exact: true })).toBeVisible();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).workspace.opportunities[0], inboxKey);
  expect(saved.supplierSku).toBe('MOCK-1002');
  expect(saved.intelligence.commercialDecisions.map((decision: { receipt: { sku: string } }) => decision.receipt.sku)).toEqual(['MOCK-1001', 'MOCK-1002']);
  expect(saved.intelligence.commercialDecisions[0]).toEqual(original[0]);
});

test('inbox reload blocks review writes until its captured revision has returned', async ({ page }) => {
  await page.goto('/opportunities');
  await page.getByRole('button', { name: 'Load synthetic example', exact: true }).click();
  await page.getByRole('button', { name: 'Extract and capture', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review opportunity', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    // Use the loaded URL, including Vite's revision query when present, so the
    // delayed method belongs to this page's actual repository instance.
    const path = performance.getEntriesByType('resource').map(entry => entry.name).find(name => new URL(name).pathname === '/src/services/promotion/repository.ts');
    if (!path) throw new Error('Loaded repository module was not found');
    const { DemoIntelligenceRepository } = await import(path);
    const load = DemoIntelligenceRepository.prototype.load;
    let delayed = false;
    DemoIntelligenceRepository.prototype.load = async function () {
      const captured = await load.call(this);
      if (delayed) return captured;
      delayed = true;
      return new Promise(resolve => Object.assign(window, { finishInboxReload: () => resolve(captured) }));
    };
  });
  await page.getByText('Capture a communication', { exact: true }).click();
  await page.getByRole('button', { name: 'Reload inbox', exact: true }).click();
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { finishInboxReload?: () => void }).finishInboxReload)).toBe('function');
  console.log(JSON.stringify({ probe: 'pending-inbox-reload', saveEnabled: await page.getByRole('button', { name: 'Save review', exact: true }).isEnabled() }));
  try {
    await expect(page.getByRole('button', { name: 'Save review', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Reload inbox', exact: true })).toBeDisabled();
  } finally {
    await page.evaluate(() => (window as unknown as { finishInboxReload(): void }).finishInboxReload());
  }
  await expect(page.getByRole('button', { name: 'Save review', exact: true })).toBeEnabled();
  await page.getByLabel('Buyer decision').selectOption('UNDER_CONSIDERATION');
  await page.getByRole('button', { name: 'Save review', exact: true }).click();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).workspace.opportunities[0].status, inboxKey)).toBe('UNDER_CONSIDERATION');
  await expect(page.getByLabel('Buyer decision')).toHaveValue('UNDER_CONSIDERATION');
});
