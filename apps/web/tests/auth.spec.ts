import { test, expect, Page } from "@playwright/test";

async function loginAsDemo(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: /try the demo workspace/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
}

test.describe("auth", () => {
  test("demo login flow", async ({ page }) => {
    await loginAsDemo(page);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });
});
