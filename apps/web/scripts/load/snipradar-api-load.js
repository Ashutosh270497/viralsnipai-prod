#!/usr/bin/env node

/**
 * Built-in load runner for SnipRadar APIs (no k6 dependency).
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 SNIPRADAR_AUTH_COOKIE='next-auth.session-token=...' pnpm --filter web run snipradar:load:node
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const AUTH_COOKIE = process.env.SNIPRADAR_AUTH_COOKIE || "";
const DEMO_LOGIN = process.env.SNIPRADAR_DEMO_LOGIN === "true";
const CONCURRENCY = Math.max(1, Number(process.env.SNIPRADAR_LOAD_CONCURRENCY || 30));
const ITERATIONS = Math.max(1, Number(process.env.SNIPRADAR_LOAD_ITERATIONS || 20));
const INCLUDE_QUEUE_ENDPOINTS = process.env.SNIPRADAR_LOAD_INCLUDE_QUEUE === "true";
const ENDPOINTS = [
  "/api/snipradar",
  "/api/snipradar/discover-data",
  "/api/snipradar/create-data",
  "/api/snipradar/engagement?niche=tech&status=all&page=1&pageSize=10&sortBy=score&minScore=0",
  "/api/snipradar/metrics?periodDays=30",
  "/api/snipradar/health",
  "/api/snipradar/scheduled/runs?limit=20",
].concat(INCLUDE_QUEUE_ENDPOINTS ? ["/api/snipradar/scheduled/process"] : []);

function parseServerTimingMs(headerValue) {
  if (!headerValue) return null;
  const match = String(headerValue).match(/dur=([\d.]+)/i);
  if (!match) return null;
  const ms = Number(match[1]);
  return Number.isFinite(ms) ? ms : null;
}

function describeFetchError(error) {
  const code = error?.cause?.code || error?.code;
  if (code === "ECONNREFUSED") {
    return `Could not reach ${BASE_URL}. Start the web app before running the SnipRadar load test.`;
  }
  return error instanceof Error ? error.message : String(error);
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function createMetrics() {
  const map = new Map();
  for (const endpoint of ENDPOINTS) {
    map.set(endpoint, {
      latencies: [],
      serverTiming: [],
      statusCounts: new Map(),
      errors: 0,
    });
  }
  return map;
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
    throw new Error("Failed to fetch csrf token for demo login");
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
  const sessionJson = await sessionRes.json().catch(() => null);
  if (!sessionJson?.user?.id) {
    throw new Error("Demo login did not establish authenticated session");
  }

  return cookieJar;
}

async function hitEndpoint(endpoint, metrics) {
  const record = metrics.get(endpoint);
  const url = `${BASE_URL}${endpoint}`;
  const headers = {};
  if (globalThis.__SNIPRADAR_COOKIE) {
    headers.Cookie = globalThis.__SNIPRADAR_COOKIE;
  }

  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method: endpoint.includes("/scheduled/process") ? "POST" : "GET",
      headers,
      ...(endpoint.includes("/scheduled/process") ? { body: "{}" } : {}),
    });
    const elapsed = Date.now() - startedAt;
    const timingMs = parseServerTimingMs(res.headers.get("server-timing"));

    record.latencies.push(elapsed);
    if (timingMs !== null) {
      record.serverTiming.push(timingMs);
    }
    const count = record.statusCounts.get(res.status) || 0;
    record.statusCounts.set(res.status, count + 1);
  } catch {
    const elapsed = Date.now() - startedAt;
    record.latencies.push(elapsed);
    record.errors += 1;
  }
}

async function worker(metrics) {
  for (let i = 0; i < ITERATIONS; i++) {
    for (const endpoint of ENDPOINTS) {
      await hitEndpoint(endpoint, metrics);
    }
  }
}

function formatStatusCounts(statusCounts) {
  const entries = [...statusCounts.entries()].sort((a, b) => a[0] - b[0]);
  return entries.map(([code, count]) => `${code}:${count}`).join(" ");
}

async function main() {
  console.log(`SnipRadar API load test`);
  console.log(`BASE_URL=${BASE_URL}`);
  console.log(`CONCURRENCY=${CONCURRENCY}`);
  console.log(`ITERATIONS=${ITERATIONS}`);
  console.log(`ENDPOINTS=${ENDPOINTS.length}`);
  console.log(`INCLUDE_QUEUE_ENDPOINTS=${INCLUDE_QUEUE_ENDPOINTS}`);
  console.log("");

  if (!AUTH_COOKIE && DEMO_LOGIN) {
    globalThis.__SNIPRADAR_COOKIE = await demoLogin();
    console.log("Authenticated via demo login.");
  } else {
    globalThis.__SNIPRADAR_COOKIE = AUTH_COOKIE;
  }

  const metrics = createMetrics();
  const startedAt = Date.now();

  const workers = Array.from({ length: CONCURRENCY }, () => worker(metrics));
  await Promise.all(workers);

  const totalDurationMs = Date.now() - startedAt;
  const requestsPerEndpoint = CONCURRENCY * ITERATIONS;
  const totalRequests = requestsPerEndpoint * ENDPOINTS.length;

  console.log(`Total requests: ${totalRequests}`);
  console.log(`Total duration: ${(totalDurationMs / 1000).toFixed(2)}s`);
  console.log(`Approx RPS: ${(totalRequests / (totalDurationMs / 1000)).toFixed(1)}`);
  console.log("");

  let totalErrors = 0;
  let maxP95 = 0;

  for (const endpoint of ENDPOINTS) {
    const record = metrics.get(endpoint);
    const p50 = percentile(record.latencies, 50);
    const p95 = percentile(record.latencies, 95);
    const p99 = percentile(record.latencies, 99);
    const mean = avg(record.latencies);
    const stMean = avg(record.serverTiming);
    totalErrors += record.errors;
    maxP95 = Math.max(maxP95, p95);

    console.log(`Endpoint: ${endpoint}`);
    console.log(
      `  count=${record.latencies.length} err=${record.errors} status=[${formatStatusCounts(record.statusCounts)}]`
    );
    console.log(
      `  latency(ms): p50=${p50.toFixed(1)} p95=${p95.toFixed(1)} p99=${p99.toFixed(1)} avg=${mean.toFixed(1)} serverTimingAvg=${stMean.toFixed(1)}`
    );
  }

  console.log("");
  const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
  console.log(`Error rate: ${(errorRate * 100).toFixed(2)}%`);
  console.log(`Worst endpoint p95: ${maxP95.toFixed(1)}ms`);

  if (errorRate > 0.03 || maxP95 > 1200) {
    console.error("Load test thresholds failed (errorRate<=3%, worst p95<=1200ms)");
    process.exit(1);
  }
  console.log("Load test thresholds passed.");
}

main().catch((error) => {
  console.error("Load test crashed:", describeFetchError(error));
  process.exit(1);
});
