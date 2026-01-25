import { test, expect, Page } from "@playwright/test";

const projectName = `Regression Project ${Date.now()}`;

async function loginAsDemo(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: /try the demo workspace/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
}

async function selectRepurposeProject(page: Page, projectTitle: string) {
  const trigger = page.locator("button:has-text('Select project')");
  await trigger.waitFor({ state: "visible", timeout: 15000 });
  await trigger.click();
  const option = page.getByRole("option", { name: projectTitle, exact: true });
  await option.waitFor({ state: "visible", timeout: 15000 });
  await option.click();
  await expect(trigger).toHaveText(new RegExp(projectTitle, "i"), { timeout: 15000 });
  await page.getByRole("heading", { name: /Latest asset/i }).waitFor({ state: "visible", timeout: 15000 });
}

test.describe("legacy UI smoke flow", () => {
  test("auth to billing journey", async ({ page }) => {
    await test.step("authenticate via demo", async () => {
      await loginAsDemo(page);
      await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    });

    let projectId: string | undefined;
    await test.step("create a project", async () => {
      const createResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/projects") && response.request().method() === "POST"
      );

      await page.getByRole("button", { name: /new project/i }).click();
      await page.getByLabel(/project title/i).fill(projectName);
      await page.getByRole("button", { name: /create project/i }).click();

      const createResponse = await createResponsePromise;
      try {
        const payload = await createResponse.json();
        projectId = payload?.project?.id ?? undefined;
      } catch {
        projectId = undefined;
      }

      await page.goto("/projects");

      const projectLocator = projectId
        ? page.locator(`a[href="/projects/${projectId}"]`)
        : page.getByRole("heading", { name: projectName });

      await expect(projectLocator).toBeVisible({ timeout: 15000 });
    });

    await test.step("verify upload surface", async () => {
      await page.goto(projectId ? `/repurpose?projectId=${projectId}` : "/repurpose");
      await expect(page.getByRole("heading", { name: /RepurposeOS/i })).toBeVisible();
      if (!projectId) {
        await selectRepurposeProject(page, projectName);
      } else {
        await page.getByRole("heading", { name: /Latest asset/i }).waitFor({ state: "visible", timeout: 15000 });
      }
      await expect(page.getByText(/Upload a long-form video/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /Upload/i })).toBeEnabled();
    });

    await test.step("trim & captions controls are accessible", async () => {
      await expect(page.getByRole("button", { name: /Auto-detect highlights/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Clips/i })).toBeVisible();
      await expect(page.getByText(/Review candidate clips/i)).toBeVisible();
    });

    await test.step("template and export panels render", async () => {
      await expect(page.getByRole("heading", { name: /Export presets/i })).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/Queue renders/i)).toBeVisible();
    });

    await test.step("download actions visible", async () => {
      await page.getByRole("heading", { name: /Latest asset/i }).scrollIntoViewIfNeeded();
      const downloadLink = page.getByRole("link", { name: /Download/i }).first();
      if ((await downloadLink.count()) > 0) {
        await expect(downloadLink).toBeVisible();
      } else {
        await expect(page.getByText(/Upload to get started/i)).toBeVisible();
      }
    });

    await test.step("billing page reachable", async () => {
      await page.goto("/billing");
      await expect(page.getByRole("heading", { name: /Billing/i })).toBeVisible();
      await expect(page.getByText(/Current plan/i)).toBeVisible();
    });
  });
});
