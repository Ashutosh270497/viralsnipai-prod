import { test, expect, Page } from "@playwright/test";

const projectName = `Regression Project ${Date.now()}`;

async function loginAsDemo(page: Page) {
  await page.goto("/signin?dev-bypass=true");
  await expect
    .poll(
      async () => {
        const session = await page.request.get("/api/auth/session");
        if (!session.ok()) return null;
        const payload = await session.json().catch(() => null);
        return payload?.user?.id ?? null;
      },
      { timeout: 25000 }
    )
    .not.toBeNull();

  await page.context().addCookies([
    {
      name: "clippers_ecosystem",
      value: "youtube",
      domain: "localhost",
      path: "/",
    },
  ]);

  await page.goto("/dashboard");
  await page.waitForURL(/\/dashboard(\?.*)?$/, { timeout: 20000 });
}

async function createProjectViaApi(page: Page, title: string) {
  const createResponse = await page.request.post("/api/projects", {
    data: {
      title,
      topic: "Playwright repurpose smoke",
    },
  });

  expect(createResponse.status(), "project creation should succeed").toBe(201);
  const payload = await createResponse.json();
  expect(payload?.project?.id).toBeTruthy();
  return payload.project.id as string;
}

test.describe("repurpose 3-page smoke flow", () => {
  test("auth to ingest/editor/export journey", async ({ page }) => {
    await test.step("authenticate via demo", async () => {
      await loginAsDemo(page);
      await expect(page).toHaveURL(/\/(dashboard|niche-discovery|keyword-research|repurpose)(\?.*)?$/);
    });

    let projectId: string;
    await test.step("create a project", async () => {
      projectId = await createProjectViaApi(page, projectName);
      expect(projectId.length).toBeGreaterThan(10);
    });

    await test.step("verify ingest page + selector wiring", async () => {
      await page.goto(`/repurpose?projectId=${projectId}`);
      await expect(page.getByRole("heading", { name: /Repurpose OS/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Step 1 Ingest & Detect/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Source Video/i })).toBeVisible();
      await expect(page.getByText(/Paste a YouTube link or upload a local file/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /^Fetch$/i })).toBeVisible();
    });

    await test.step("ingest controls are visible", async () => {
      await expect(page.getByRole("button", { name: /Auto-detect highlights/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /AI Detection/i })).toBeVisible();
    });

    await test.step("editor and export pages enforce no-asset guard", async () => {
      await page.goto(`/repurpose/editor?projectId=${projectId}`);
      await expect(page.getByRole("link", { name: /Step 2 Edit & Enhance/i })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByRole("heading", { name: /No media found/i })).toBeVisible();

      await page.goto(`/repurpose/export?projectId=${projectId}`);
      await expect(page.getByRole("link", { name: /Step 3 Export & Translate/i })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByRole("heading", { name: /No media found/i })).toBeVisible();
    });

    await test.step("sub-navigation remains available on guarded pages", async () => {
      await expect(page.getByRole("link", { name: /Step 1 Ingest & Detect/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Step 2 Edit & Enhance/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Step 3 Export & Translate/i })).toBeVisible();
    });
  });
});
