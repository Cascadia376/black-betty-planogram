import { expect, test, type Page } from "@playwright/test";

declare const process: { env: Record<string, string | undefined> };

const jeremyEmail = process.env.E2E_JEREMY_EMAIL;
const jeremyPassword = process.env.E2E_JEREMY_PASSWORD;
const cherieEmail = process.env.E2E_CHERIE_EMAIL;
const cheriePassword = process.env.E2E_CHERIE_PASSWORD;
const campaignId = process.env.E2E_SHARED_CAMPAIGN_ID;
const credentialsReady = Boolean(jeremyEmail && jeremyPassword && cherieEmail && cheriePassword && campaignId);

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Merchandising Dashboard" })).toBeVisible();
}

test("Jeremy and Cherie share changes and receive a stale-save conflict", async ({ browser, baseURL }) => {
  test.skip(!credentialsReady, "Set both buyer credentials and E2E_SHARED_CAMPAIGN_ID to run the production collaboration gate.");

  const jeremyContext = await browser.newContext({ baseURL });
  const cherieContext = await browser.newContext({ baseURL });
  const jeremy = await jeremyContext.newPage();
  const cherie = await cherieContext.newPage();

  try {
    await signIn(jeremy, jeremyEmail!, jeremyPassword!);
    await signIn(cherie, cherieEmail!, cheriePassword!);

    const editPath = `/campaigns/${campaignId}/edit`;
    await Promise.all([jeremy.goto(editPath), cherie.goto(editPath)]);
    const originalDescription = await jeremy.getByLabel("Description").inputValue();
    const marker = `Jeremy shared-edit verification ${new Date().toISOString()}`;

    await jeremy.getByLabel("Description").fill(marker);
    await jeremy.getByRole("button", { name: "Save campaign" }).click();
    await expect(jeremy.getByRole("status")).toContainText("changes saved");

    await cherie.getByLabel("Description").fill("Cherie stale-save verification");
    await cherie.getByRole("button", { name: "Save campaign" }).click();
    await expect(cherie.getByRole("alert")).toContainText("changed after you opened it");

    await cherie.reload();
    await expect(cherie.getByLabel("Description")).toHaveValue(marker);
    await cherie.getByLabel("Description").fill(originalDescription);
    await cherie.getByRole("button", { name: "Save campaign" }).click();
    await expect(cherie.getByRole("status")).toContainText("changes saved");
  } finally {
    await Promise.all([jeremyContext.close(), cherieContext.close()]);
  }
});
