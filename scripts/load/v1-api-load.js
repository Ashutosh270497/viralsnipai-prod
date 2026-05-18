#!/usr/bin/env node

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const concurrency = Number.parseInt(process.env.LOAD_CONCURRENCY || "10", 10);
const rounds = Number.parseInt(process.env.LOAD_ROUNDS || "5", 10);

const scenarios = [
  { name: "health", method: "GET", path: "/api/health" },
  { name: "readiness", method: "GET", path: "/api/health/ready" },
];

async function requestScenario(scenario) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${scenario.path}`, {
    method: scenario.method,
    headers: { Accept: "application/json" },
  });
  await response.arrayBuffer();
  return {
    name: scenario.name,
    status: response.status,
    durationMs: Date.now() - startedAt,
    ok: response.status < 500,
  };
}

async function main() {
  const results = [];
  for (let round = 0; round < rounds; round += 1) {
    const batch = Array.from({ length: concurrency }, (_, index) => {
      const scenario = scenarios[index % scenarios.length];
      return requestScenario(scenario).catch((error) => ({
        name: scenario.name,
        status: 0,
        durationMs: 0,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    });
    results.push(...(await Promise.all(batch)));
  }

  const failures = results.filter((result) => !result.ok);
  const durations = results.map((result) => result.durationMs).sort((a, b) => a - b);
  const p95 = durations[Math.max(0, Math.ceil(durations.length * 0.95) - 1)] || 0;

  console.log(
    JSON.stringify(
      {
        baseUrl,
        total: results.length,
        failures: failures.length,
        errorRate: results.length ? failures.length / results.length : 0,
        p95Ms: p95,
        byStatus: results.reduce((acc, result) => {
          acc[result.status] = (acc[result.status] || 0) + 1;
          return acc;
        }, {}),
      },
      null,
      2,
    ),
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

void main();
