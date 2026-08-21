import { expect, test } from "@playwright/test";

test("loads the merchandising platform scaffold", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Merchandising Platform" })).toBeVisible();
  await expect(page.getByText("Crown Isle")).toBeVisible();
});

