#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

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

  return [...jar.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function demoLogin() {
  let cookieJar = "";
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfJson = await csrfRes.json();
  cookieJar = mergeCookieJar(cookieJar, parseSetCookies(csrfRes.headers));
  const csrfToken = csrfJson?.csrfToken;
  if (!csrfToken) {
    throw new Error("Failed to fetch csrf token");
  }

  const body = new URLSearchParams({
    csrfToken,
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
  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: cookieJar },
  });
  const session = await sessionRes.json().catch(() => null);

  if (!session?.user?.id) {
    throw new Error("Demo login failed to create session");
  }

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

async function main() {
  console.log(`Repurpose smoke test on ${BASE_URL}`);
  const cookie = await demoLogin();
  console.log("Authenticated demo session ready.");

  const projectTitle = `Repurpose Smoke ${Date.now()}`;
  const createProjectRes = await request("/api/projects", cookie, {
    method: "POST",
    body: JSON.stringify({
      title: projectTitle,
      topic: "Smoke validation",
    }),
  });

  if (createProjectRes.status !== 201 || !createProjectRes.json?.project?.id) {
    console.error("FAIL create project", createProjectRes.status, createProjectRes.text.slice(0, 280));
    process.exit(1);
  }

  const projectId = createProjectRes.json.project.id;
  console.log(`PASS create project -> ${projectId}`);

  const checks = [
    { path: "/api/projects", method: "GET", expect: [200] },
    { path: `/api/projects/${projectId}`, method: "GET", expect: [200] },
    {
      path: `/repurpose?projectId=${projectId}`,
      method: "GET",
      expect: [200],
    },
    {
      path: `/repurpose/editor?projectId=${projectId}`,
      method: "GET",
      expect: [200],
    },
    {
      path: `/repurpose/export?projectId=${projectId}`,
      method: "GET",
      expect: [200],
    },
    {
      path: "/api/repurpose/generate-prompts",
      method: "POST",
      body: {
        context: "Create high-retention clips for AI creators with stronger hooks.",
        contentType: "Tutorial",
        platform: "YouTube Shorts",
        useTemplate: true,
      },
      expect: [200, 400],
    },
    {
      path: "/api/repurpose/ingest",
      method: "POST",
      body: {
        projectId,
        sourceUrl: "not-a-valid-url",
      },
      expect: [400],
    },
    {
      path: "/api/repurpose/ingest",
      method: "POST",
      body: {
        projectId: `blocked-project-${Date.now()}`,
        sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
      expect: [403],
    },
  ];

  let failed = 0;

  for (const check of checks) {
    const init =
      check.method === "POST"
        ? { method: "POST", body: JSON.stringify(check.body || {}) }
        : {};

    const res = await request(check.path, cookie, init);
    const statusOk = check.expect.includes(res.status);
    const containsOk = !check.contains || res.text.includes(check.contains);
    const pass = statusOk && containsOk;

    if (!pass) {
      failed += 1;
      console.error(
        `FAIL ${check.method} ${check.path} -> ${res.status} ${res.text.slice(0, 280)}`
      );
    } else {
      console.log(`PASS ${check.method} ${check.path} -> ${res.status}`);
    }
  }

  if (failed > 0) {
    console.error(`Smoke test failed (${failed} checks failed).`);
    process.exit(1);
  }

  console.log("Smoke test passed.");
}

main().catch((error) => {
  console.error("Smoke test crashed:", error);
  process.exit(1);
});
