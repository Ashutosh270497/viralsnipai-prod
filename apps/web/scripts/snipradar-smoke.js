#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

function describeFetchError(error) {
  const code = error?.cause?.code || error?.code;
  if (code === "ECONNREFUSED") {
    return `Could not reach ${BASE_URL}. Start the web app before running SnipRadar smoke.`;
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
  console.log(`SnipRadar smoke test on ${BASE_URL}`);
  const cookie = await demoLogin();
  console.log("Authenticated demo session ready.");

  const checks = [
    { path: "/api/snipradar", method: "GET", expect: [200] },
    { path: "/api/snipradar/discover-data", method: "GET", expect: [200] },
    { path: "/api/snipradar/create-data", method: "GET", expect: [200] },
    { path: "/api/snipradar/accounts", method: "GET", expect: [200] },
    { path: "/api/snipradar/templates", method: "GET", expect: [200] },
    { path: "/api/snipradar/style", method: "GET", expect: [200] },
    {
      path: "/api/snipradar/engagement?niche=tech&status=all&page=1&pageSize=10&sortBy=score&minScore=0",
      method: "GET",
      expect: [200],
    },
    { path: "/api/snipradar/metrics?periodDays=30", method: "GET", expect: [200] },
    { path: "/api/snipradar/health", method: "GET", expect: [200] },
    { path: "/api/snipradar/scheduled/runs?limit=5", method: "GET", expect: [200] },
    { path: "/api/snipradar/maintenance/repair", method: "POST", expect: [200] },
    { path: "/api/snipradar/scheduled/process", method: "POST", expect: [200] },
    { path: "/api/snipradar/scheduled/cron", method: "POST", expect: [401] },
  ];

  let failed = 0;

  for (const check of checks) {
    const res = await request(
      check.path,
      cookie,
      check.method === "POST" ? { method: "POST", body: "{}" } : {}
    );
    const pass = check.expect.includes(res.status);
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
  console.error("Smoke test crashed:", describeFetchError(error));
  process.exit(1);
});
