/**
 * System Health Service (Phase 9)
 *
 * Aggregates health checks for every subsystem in the production stack:
 *   - database (PostgreSQL via Prisma)
 *   - environment (required env vars present)
 *   - ffmpeg (binary accessible and functional)
 *   - remotionRenderer (configured and entry point present)
 *   - cvWorker (FastAPI CV service reachable + models loaded)
 *   - exportQueue (active render jobs in-process snapshot)
 *
 * Overall status rules:
 *   any check status === "error"         → overall "unhealthy"
 *   any check status === "degraded"      → overall "degraded"
 *   all checks "ok" or "unconfigured"    → overall "healthy"
 *   "unconfigured" means disabled by env; non-fatal
 */

import { spawn } from "child_process";
import path from "path";
import { promises as fs } from "fs";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getCvWorkerHealth } from "@/lib/media/cv-worker-client";
import { REMOTION_RENDERER_ENABLED } from "@/lib/media/remotion-renderer";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ServiceStatus = "ok" | "degraded" | "unconfigured" | "error";
export type OverallStatus = "healthy" | "degraded" | "unhealthy";

export interface ServiceCheck {
  status: ServiceStatus;
  latencyMs?: number;
  version?: string | null;
  error?: string | null;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  overall: OverallStatus;
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: ServiceCheck;
    environment: ServiceCheck;
    ffmpeg: ServiceCheck;
    remotionRenderer: ServiceCheck;
    cvWorker: ServiceCheck;
    exportQueue: ServiceCheck;
  };
}

// ── Required env vars ─────────────────────────────────────────────────────────

const REQUIRED_ENV_VARS = [
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "DATABASE_URL",
] as const;

const WARN_ENV_VARS = [
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
] as const;

// ── Individual checks ─────────────────────────────────────────────────────────

async function checkDatabase(): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    await (prisma as { $queryRaw: (query: TemplateStringsArray) => Promise<unknown> }).$queryRaw`SELECT 1`;
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function checkEnvironment(): ServiceCheck {
  const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k]);
  const missingOptional = WARN_ENV_VARS.filter((k) => !process.env[k]);

  if (missing.length > 0) {
    return { status: "error", error: `Missing required env vars: ${missing.join(", ")}` };
  }
  if (missingOptional.length > 0) {
    return {
      status: "degraded",
      details: { missingOptional, hint: "Some AI features may be unavailable." },
    };
  }
  return { status: "ok" };
}

async function checkFfmpeg(): Promise<ServiceCheck> {
  const start = Date.now();

  // FFMPEG_PATH is injected by next.config.mjs via the `env` block using the
  // resolved ffmpeg-static path. Use that directly — never require("ffmpeg-static")
  // inside the server bundle because webpack resolves it to a vendor-chunk path.
  const binary =
    process.env.FFMPEG_PATH ??
    "/opt/homebrew/bin/ffmpeg";  // macOS Homebrew fallback

  return new Promise((resolve) => {
    let output = "";
    const child = spawn(binary, ["-version"], { stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (d: Buffer) => { output += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { output += d.toString(); });
    child.on("error", (err: Error) => {
      resolve({ status: "error", latencyMs: Date.now() - start, error: err.message });
    });
    child.on("close", (code: number) => {
      const latencyMs = Date.now() - start;
      if (code === 0) {
        const version = output.match(/ffmpeg version ([^\s]+)/)?.[1] ?? null;
        resolve({ status: "ok", latencyMs, version });
      } else {
        resolve({ status: "error", latencyMs, error: `ffmpeg exited ${code}` });
      }
    });
  });
}

async function checkRemotionRenderer(): Promise<ServiceCheck> {
  if (!REMOTION_RENDERER_ENABLED) {
    return {
      status: "unconfigured",
      details: { hint: "Set REMOTION_RENDERER_ENABLED=true to enable animated caption exports." },
    };
  }

  try {
    // Verify the composition entry point exists
    const entryPoint = path.join(process.cwd(), "remotion-compositions", "index.ts");
    await fs.access(entryPoint);

    // Verify @remotion/renderer is importable
    await import("@remotion/renderer");

    // Resolve Chrome path — Remotion uses Puppeteer/Chrome for headless rendering
    const chromePath =
      process.env.PUPPETEER_EXECUTABLE_PATH ??
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

    let chromeStatus = "not checked";
    try {
      await fs.access(chromePath);
      chromeStatus = "found";
    } catch {
      chromeStatus = "not found at expected path";
    }

    return {
      status: chromeStatus === "found" ? "ok" : "degraded",
      details: {
        crf: Number(process.env.REMOTION_EXPORT_CRF ?? 18),
        audioBitrate: process.env.REMOTION_EXPORT_AUDIO_BITRATE ?? "256k",
        concurrency: Number(process.env.REMOTION_CONCURRENCY ?? 1),
        mode: process.env.REMOTION_RENDERER_MODE ?? "node",
        chromePath,
        chromeStatus,
      },
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkCvWorker(): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const result = await getCvWorkerHealth();
    if (!result.configured) {
      return {
        status: "unconfigured",
        details: { hint: "Set CV_WORKER_URL to enable local CV detection." },
      };
    }

    const latencyMs = result.latencyMs ?? Date.now() - start;

    if (result.status === "unreachable") {
      return { status: "error", latencyMs, error: result.error ?? "CV worker unreachable" };
    }

    const details: Record<string, unknown> = {
      url: result.url,
      version: result.health?.version ?? null,
      models: result.health?.models ?? {},
      dependencies: result.health?.dependencies ?? {},
    };

    return {
      status: result.status === "healthy" ? "ok" : "degraded",
      latencyMs,
      version: result.health?.version ?? null,
      details,
    };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function checkExportQueue(): ServiceCheck {
  try {
    // Dynamic import to avoid circular deps — render-queue is the only consumer
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getExportQueueSnapshot } = require("@/lib/render-queue") as {
      getExportQueueSnapshot: () => { activeJobs: number; stages: Record<string, number> };
    };
    const snapshot = getExportQueueSnapshot();
    return {
      status: "ok",
      details: {
        activeJobs: snapshot.activeJobs,
        stages: snapshot.stages,
      },
    };
  } catch {
    return { status: "ok", details: { activeJobs: 0, stages: {} } };
  }
}

// ── Aggregation ───────────────────────────────────────────────────────────────

function aggregate(checks: Record<string, ServiceCheck>): OverallStatus {
  const statuses = Object.values(checks).map((c) => c.status);
  if (statuses.includes("error")) return "unhealthy";
  if (statuses.includes("degraded")) return "degraded";
  return "healthy";
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run all health checks in parallel and return the aggregated system health.
 * Never throws — individual check failures are captured in their ServiceCheck.
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const checkStart = Date.now();

  const [database, ffmpeg, remotionRenderer, cvWorker] = await Promise.all([
    checkDatabase().catch((e): ServiceCheck => ({ status: "error", error: String(e) })),
    checkFfmpeg().catch((e): ServiceCheck => ({ status: "error", error: String(e) })),
    checkRemotionRenderer().catch((e): ServiceCheck => ({ status: "error", error: String(e) })),
    checkCvWorker().catch((e): ServiceCheck => ({ status: "error", error: String(e) })),
  ]);

  const environment = checkEnvironment();
  const exportQueue = checkExportQueue();

  const services = { database, environment, ffmpeg, remotionRenderer, cvWorker, exportQueue };
  const overall = aggregate(services);

  logger.info("health:system_check", {
    overall,
    durationMs: Date.now() - checkStart,
    services: Object.fromEntries(
      Object.entries(services).map(([k, v]) => [k, { status: v.status, latencyMs: v.latencyMs }])
    ),
  });

  return {
    overall,
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0",
    uptime: process.uptime(),
    services,
  };
}
