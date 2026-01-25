import { test, expect, Page } from "@playwright/test";

const projectName = `Automation Project ${Date.now()}`;

async function loginAsDemo(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: /try the demo workspace/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
}

test.describe("repurpose flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test("create project and view repurpose workspace", async ({ page }) => {
    await page.getByRole("button", { name: /new project/i }).click();
    await page.getByLabel(/project title/i).fill(projectName);
    await page.getByRole("button", { name: /create project/i }).click();
    await expect(page.getByText(projectName)).toBeVisible({ timeout: 10000 });

    await page.goto("/repurpose");
    await expect(page.getByRole("heading", { name: /RepurposeOS/i })).toBeVisible();
    const projectSelect = page.locator("button:has-text('Select project')");
    await projectSelect.waitFor({ state: "visible", timeout: 15000 });
    await projectSelect.click();
    const option = page.getByRole("option", { name: projectName, exact: true });
    await option.waitFor({ state: "visible" });
    await option.click();
    await expect(projectSelect).toHaveText(new RegExp(projectName, "i"), { timeout: 15000 });
    await page.getByRole("heading", { name: /Latest asset/i }).waitFor({ state: "visible", timeout: 15000 });
    await expect(page.getByText(/Export presets/i)).toBeVisible();
  });
});
