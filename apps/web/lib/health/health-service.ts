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
import { randomUUID } from "crypto";
import path from "path";
import { promises as fs } from "fs";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getEnvValidationReport, getProductionWarnings } from "@/lib/config/env";
import { getCvWorkerHealth } from "@/lib/media/cv-worker-client";
import { REMOTION_RENDERER_ENABLED } from "@/lib/media/remotion-renderer";
import { getV1UploadConfigWarnings } from "@/lib/media/v1-media-policy";
import { getV1RateLimiterHealth } from "@/lib/security/rate-limit";
import { getStorageDriver } from "@/lib/storage";

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
    storage: ServiceCheck;
    rateLimiter: ServiceCheck;
    aiProviders: ServiceCheck;
    billing: ServiceCheck;
    smtp: ServiceCheck;
    deployment: ServiceCheck;
  };
  warnings: string[];
}

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
  const report = getEnvValidationReport();
  if (!report.ok) {
    return {
      status: process.env.NODE_ENV === "production" ? "error" : "degraded",
      error: `Missing required env vars: ${report.missingRequired.join(", ")}`,
      details: {
        environment: report.environment,
        groups: report.groups,
        missingRequired: report.missingRequired,
        warnings: report.warnings,
      },
    };
  }
  if (report.warnings.length > 0) {
    return {
      status: "degraded",
      details: {
        environment: report.environment,
        groups: report.groups,
        warnings: report.warnings,
      },
    };
  }
  return { status: "ok", details: { environment: report.environment, groups: report.groups } };
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
      return {
        status: "degraded",
        latencyMs,
        error: result.error ?? "CV worker unreachable; FFmpeg fallback remains available.",
      };
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

async function checkStorage(): Promise<ServiceCheck> {
  const config = getV1UploadConfigWarnings();
  const deepCheck = process.env.HEALTH_DEEP_CHECK === "true";
  if (config.storageDriver === "s3" && deepCheck) {
    const deep = await runS3DeepCheck().catch((error): ServiceCheck => ({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      details: config,
    }));
    if (deep.status === "error") return deep;
  }
  return {
    status: config.warnings.length > 0 ? "degraded" : "ok",
    details: { ...config, deepCheck },
    error: config.warnings.length > 0 ? config.warnings.join(" ") : null,
  };
}

function checkRateLimiter(): ServiceCheck {
  const health = getV1RateLimiterHealth();
  return {
    status: health.warnings.length > 0 ? "degraded" : "ok",
    details: health,
    error: health.warnings.length > 0 ? health.warnings.join(" ") : null,
  };
}

function checkAiProviders(): ServiceCheck {
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const openRouterConfigured = Boolean(process.env.OPENROUTER_API_KEY);
  return {
    status: openaiConfigured && openRouterConfigured ? "ok" : "degraded",
    details: {
      openaiConfigured,
      openRouterConfigured,
      providerBoundary: "OpenAI transcription/timing; OpenRouter reasoning/ranking/scoring/metadata",
    },
    error: openaiConfigured && openRouterConfigured ? null : "One or more AI provider keys are missing.",
  };
}

function checkBilling(): ServiceCheck {
  const configured = Boolean(
    process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      process.env.RAZORPAY_WEBHOOK_SECRET &&
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  );
  return {
    status: configured ? "ok" : "degraded",
    details: {
      razorpayKeyConfigured: Boolean(process.env.RAZORPAY_KEY_ID),
      razorpayWebhookSecretConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
      publicCheckoutKeyConfigured: Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID),
    },
    error: configured ? null : "Razorpay is not fully configured.",
  };
}

function checkSmtp(): ServiceCheck {
  const configured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
  return {
    status: configured ? "ok" : "unconfigured",
    details: {
      configured,
      fromConfigured: Boolean(process.env.EMAIL_FROM),
      replyToConfigured: Boolean(process.env.EMAIL_REPLY_TO),
    },
  };
}

function checkDeployment(): ServiceCheck {
  const webConcurrency = Number.parseInt(process.env.WEB_CONCURRENCY ?? "1", 10);
  const warnings = getProductionWarnings().filter((warning) => warning.includes("WEB_CONCURRENCY"));
  return {
    status: warnings.length > 0 ? "degraded" : "ok",
    details: {
      nodeEnv: process.env.NODE_ENV ?? "development",
      vercel: Boolean(process.env.VERCEL),
      storageDriver: getStorageDriver(),
      webConcurrency: Number.isFinite(webConcurrency) ? webConcurrency : 1,
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0",
      warnings,
    },
    error: warnings.length > 0 ? warnings.join(" ") : null,
  };
}

async function runS3DeepCheck(): Promise<ServiceCheck> {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    return { status: "error", error: "S3_BUCKET is required for S3 storage deep health check." };
  }

  const key = `health-checks/${randomUUID()}.txt`;
  const client = new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
  });

  const startedAt = Date.now();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: "ok",
      ContentType: "text/plain",
    }),
  );
  await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

  return {
    status: "ok",
    latencyMs: Date.now() - startedAt,
    details: { driver: "s3", bucketConfigured: true, deepCheck: true },
  };
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

  const [database, ffmpeg, remotionRenderer, cvWorker, storage] = await Promise.all([
    checkDatabase().catch((e): ServiceCheck => ({ status: "error", error: String(e) })),
    checkFfmpeg().catch((e): ServiceCheck => ({ status: "error", error: String(e) })),
    checkRemotionRenderer().catch((e): ServiceCheck => ({ status: "error", error: String(e) })),
    checkCvWorker().catch((e): ServiceCheck => ({ status: "error", error: String(e) })),
    checkStorage().catch((e): ServiceCheck => ({ status: "error", error: String(e) })),
  ]);

  const environment = checkEnvironment();
  const exportQueue = checkExportQueue();
  const rateLimiter = checkRateLimiter();
  const aiProviders = checkAiProviders();
  const billing = checkBilling();
  const smtp = checkSmtp();
  const deployment = checkDeployment();

  const services = {
    database,
    environment,
    ffmpeg,
    remotionRenderer,
    cvWorker,
    exportQueue,
    storage,
    rateLimiter,
    aiProviders,
    billing,
    smtp,
    deployment,
  };
  const overall = aggregate(services);
  const warnings = Object.values(services)
    .flatMap((service) => {
      const serviceWarnings = Array.isArray(service.details?.warnings)
        ? (service.details.warnings as string[])
        : [];
      return [...serviceWarnings, ...(service.error && service.status === "degraded" ? [service.error] : [])];
    })
    .filter(Boolean);

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
    warnings,
  };
}
