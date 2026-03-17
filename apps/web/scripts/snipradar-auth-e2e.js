#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const FIXTURE_MARKER = "[SNIPRADAR_AUTH_E2E_FIXTURE]";
const E2E_X_USER_ID = "2244994945";
const E2E_X_USERNAME = "TwitterDev";

function describeFetchError(error) {
  const code = error?.cause?.code || error?.code;
  if (code === "ECONNREFUSED") {
    return `Could not reach ${BASE_URL}. Start the web app before running SnipRadar auth E2E.`;
  }
  return error instanceof Error ? error.message : String(error);
}

function parseSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function mergeCookieJar(existing, setCookieHeaders) {
  const jar = new Map();
  if (existing) {
    for (const part of existing.split(";")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) continue;
      jar.set(trimmed.slice(0, idx), trimmed.slice(idx + 1));
    }
  }
  for (const header of setCookieHeaders) {
    const first = String(header).split(";")[0];
    const idx = first.indexOf("=");
    if (idx <= 0) continue;
    const name = first.slice(0, idx).trim();
    const value = first.slice(idx + 1).trim();
    if (name && value) jar.set(name, value);
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function demoLogin() {
  let cookieJar = "";
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrf = await csrfRes.json();
  cookieJar = mergeCookieJar(cookieJar, parseSetCookies(csrfRes.headers));
  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    demo: "true",
    callbackUrl: `${BASE_URL}/dashboard`,
    json: "true",
  });
  const callbackRes = await fetch(`${BASE_URL}/api/auth/callback/demo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieJar,
    },
    body: body.toString(),
    redirect: "manual",
  });
  cookieJar = mergeCookieJar(cookieJar, parseSetCookies(callbackRes.headers));
  return cookieJar;
}

async function request(path, cookie, init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Cookie: cookie,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

function ensureErrorContract(response, expectedCode, label) {
  const payload = response.json ?? {};
  const hasContract =
    payload &&
    payload.success === false &&
    typeof payload.error === "string" &&
    typeof payload.code === "string";
  if (!hasContract) {
    throw new Error(`${label}: missing standardized error contract`);
  }
  if (expectedCode && payload.code !== expectedCode) {
    throw new Error(`${label}: expected code ${expectedCode}, got ${payload.code}`);
  }
}

async function getDemoUserId(cookie) {
  const session = await request("/api/auth/session", cookie);
  const userId = session.json?.user?.id;
  if (session.status !== 200 || !userId) {
    throw new Error(`Unable to resolve authenticated demo user (status: ${session.status})`);
  }
  return userId;
}

async function ensurePostingFixtures(userId) {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const threadGroupId = `snipradar-e2e-thread-${Date.now()}`;
  const LEGACY_E2E_X_USER_ID = "__snipradar_e2e_user__";

  try {
    await prisma.xAccount.updateMany({
      where: {
        userId,
        xUserId: LEGACY_E2E_X_USER_ID,
      },
      data: {
        isActive: false,
      },
    });

    const account = await prisma.xAccount.upsert({
      where: {
        userId_xUserId: {
          userId,
          xUserId: E2E_X_USER_ID,
        },
      },
      create: {
        userId,
        xUserId: E2E_X_USER_ID,
        xUsername: E2E_X_USERNAME,
        xDisplayName: "SnipRadar E2E",
        accessToken: "bearer-only",
        refreshToken: null,
        isActive: true,
      },
      update: {
        xUsername: E2E_X_USERNAME,
        xDisplayName: "SnipRadar E2E",
        accessToken: "bearer-only",
        refreshToken: null,
        isActive: true,
      },
      select: { id: true },
    });

    await prisma.tweetDraft.deleteMany({
      where: {
        userId,
        text: {
          startsWith: FIXTURE_MARKER,
        },
      },
    });

    const single = await prisma.tweetDraft.create({
      data: {
        userId,
        xAccountId: account.id,
        status: "draft",
        text: `${FIXTURE_MARKER} single draft for API contract validation`,
        hookType: "question",
        format: "one-liner",
        emotionalTrigger: "curiosity",
        viralPrediction: 42,
      },
      select: { id: true },
    });

    await prisma.tweetDraft.createMany({
      data: [
        {
          userId,
          xAccountId: account.id,
          status: "draft",
          text: `${FIXTURE_MARKER} thread draft 1`,
          threadGroupId,
          threadOrder: 1,
          hookType: "list",
          format: "thread",
          emotionalTrigger: "curiosity",
          viralPrediction: 44,
        },
        {
          userId,
          xAccountId: account.id,
          status: "draft",
          text: `${FIXTURE_MARKER} thread draft 2`,
          threadGroupId,
          threadOrder: 2,
          hookType: "list",
          format: "thread",
          emotionalTrigger: "curiosity",
          viralPrediction: 45,
        },
      ],
    });

    return {
      singleDraftId: single.id,
      threadGroupId,
    };
  } finally {
    await prisma.$disconnect();
  }
}

function assertPostingOutcome(response, label) {
  const allowedStatuses = new Set([200, 401, 403, 502]);
  if (!allowedStatuses.has(response.status)) {
    throw new Error(`${label}: unexpected status ${response.status}`);
  }
  if (response.status !== 200) {
    ensureErrorContract(response, null, label);
  }
}

async function main() {
  console.log(`SnipRadar auth E2E on ${BASE_URL}`);

  const unauthMetrics = await request("/api/snipradar/metrics?periodDays=30", "");
  console.log("unauth-metrics", unauthMetrics.status, {
    code: unauthMetrics.json?.code ?? null,
  });
  if (unauthMetrics.status !== 401) {
    throw new Error(`unauth-metrics expected 401, got ${unauthMetrics.status}`);
  }
  ensureErrorContract(unauthMetrics, "UNAUTHORIZED", "unauth-metrics");

  const cookie = await demoLogin();
  const userId = await getDemoUserId(cookie);
  const fixtures = await ensurePostingFixtures(userId);
  console.log("fixtures-ready", {
    userId,
    singleDraftId: fixtures.singleDraftId,
    threadGroupId: fixtures.threadGroupId,
  });

  const summary = await request("/api/snipradar?scope=summary&periodDays=7", cookie);
  console.log("summary", summary.status, {
    hasAuth: !!summary.json?.auth,
    reauthRequired: summary.json?.auth?.reauthRequired ?? null,
    authMessage: summary.json?.auth?.message ?? null,
  });

  const metrics = await request("/api/snipradar/metrics?periodDays=30", cookie);
  console.log("metrics", metrics.status, {
    hasAuth: !!metrics.json?.auth,
    reauthRequired: metrics.json?.auth?.reauthRequired ?? null,
    authMessage: metrics.json?.auth?.message ?? null,
  });

  const createData = await request("/api/snipradar/create-data", cookie);
  console.log("create-data", createData.status, {
    drafts: createData.json?.drafts?.length ?? 0,
    scheduledDrafts: createData.json?.scheduledDrafts?.length ?? 0,
    postedDrafts: createData.json?.postedDrafts?.length ?? 0,
  });

  const singlePost = await request(`/api/snipradar/drafts/${fixtures.singleDraftId}/post`, cookie, {
    method: "POST",
  });
  assertPostingOutcome(singlePost, "single-post");
  console.log("single-post", singlePost.status, {
    code: singlePost.json?.code ?? null,
    reauthRequired: singlePost.json?.reauthRequired ?? null,
  });

  const threadPost = await request("/api/snipradar/threads/post", cookie, {
    method: "POST",
    body: JSON.stringify({ threadGroupId: fixtures.threadGroupId }),
  });
  assertPostingOutcome(threadPost, "thread-post");
  console.log("thread-post", threadPost.status, {
    code: threadPost.json?.code ?? null,
    reauthRequired: threadPost.json?.reauthRequired ?? null,
  });

  const scheduler = await request("/api/snipradar/scheduled/process", cookie, {
    method: "POST",
    body: "{}",
  });
  console.log("scheduler-process", scheduler.status, scheduler.json?.error || "ok");

  const missingDraftPost = await request("/api/snipradar/drafts/nonexistent/post", cookie, {
    method: "POST",
  });
  console.log("single-post-missing", missingDraftPost.status, {
    code: missingDraftPost.json?.code ?? null,
  });
  if (missingDraftPost.status !== 404) {
    throw new Error(`single-post-missing expected 404, got ${missingDraftPost.status}`);
  }
  ensureErrorContract(missingDraftPost, "NOT_FOUND", "single-post-missing");

  const invalidThreadPayload = await request("/api/snipradar/threads/post", cookie, {
    method: "POST",
    body: JSON.stringify({}),
  });
  console.log("thread-post-invalid", invalidThreadPayload.status, {
    code: invalidThreadPayload.json?.code ?? null,
  });
  if (invalidThreadPayload.status !== 400) {
    throw new Error(`thread-post-invalid expected 400, got ${invalidThreadPayload.status}`);
  }
  ensureErrorContract(invalidThreadPayload, "BAD_REQUEST", "thread-post-invalid");

  const pass = summary.status === 200 && metrics.status === 200 && createData.status === 200 && scheduler.status === 200;
  if (!pass) process.exit(1);
}

main().catch((error) => {
  console.error("snipradar-auth-e2e crashed:", describeFetchError(error));
  process.exit(1);
});
