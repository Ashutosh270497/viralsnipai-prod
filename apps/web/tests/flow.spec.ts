import { test, expect, Page } from "@playwright/test";

const projectName = `Automation Project ${Date.now()}`;

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
      topic: "Playwright repurpose regression",
    },
  });

  expect(createResponse.status(), "project creation should succeed").toBe(201);
  const payload = await createResponse.json();
  expect(payload?.project?.id).toBeTruthy();
  return payload.project.id as string;
}

test.describe("repurpose flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test("navigates ingest -> editor -> export with project context", async ({ page }) => {
    const projectId = await createProjectViaApi(page, projectName);

    await page.goto(`/repurpose?projectId=${projectId}`);
    await expect(page.getByRole("heading", { name: /Repurpose OS/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Step 1 Ingest & Detect/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Source Video/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Edit & Enhance/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Export & Translate/i })).toBeVisible();

    await page.goto(`/repurpose/editor?projectId=${projectId}`);
    await expect(page.getByRole("link", { name: /Step 2 Edit & Enhance/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /No media found/i })).toBeVisible();

    await page.goto(`/repurpose/export?projectId=${projectId}`);
    await expect(page.getByRole("link", { name: /Step 3 Export & Translate/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /No media found/i })).toBeVisible();
  });
});
