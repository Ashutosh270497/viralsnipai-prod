import "server-only";

import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXTAUTH_SECRET: z.string().optional(),
    NEXTAUTH_URL: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().optional(),
    DATABASE_URL: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
    STORAGE_DRIVER: z.enum(["local", "s3"]).optional(),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    BETTERSTACK_API_KEY: z.string().optional(),
    UPTIME_MONITOR_URL: z.string().optional(),
    UPSTASH_REDIS_REST_URL: z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    WEB_CONCURRENCY: z.string().optional(),
    VERCEL: z.string().optional(),
    MAX_UPLOAD_MB: z.string().optional(),
    DIRECT_TO_S3_UPLOAD_ENABLED: z.string().optional(),
  })
  .passthrough();

export type RuntimeEnv = z.infer<typeof envSchema>;

export type EnvValidationReport = {
  ok: boolean;
  environment: RuntimeEnv["NODE_ENV"];
  missingRequired: string[];
  warnings: string[];
  groups: {
    coreApp: boolean;
    auth: boolean;
    database: boolean;
    aiProviders: boolean;
    storage: boolean;
    billing: boolean;
    observability: boolean;
    rateLimiting: boolean;
    email: boolean;
  };
};

const PRODUCTION_REQUIRED = [
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "DATABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "STORAGE_DRIVER",
  "S3_BUCKET",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "NEXT_PUBLIC_RAZORPAY_KEY_ID",
] as const;

let cachedEnv: RuntimeEnv | null = null;
let cachedReport: EnvValidationReport | null = null;

export function getEnv(): RuntimeEnv {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
}

export function validateEnvForStartup(): EnvValidationReport {
  const report = buildEnvValidationReport();
  cachedReport = report;

  if (getEnv().NODE_ENV === "production" && !report.ok) {
    throw new Error(
      [
        "Production environment validation failed.",
        ...report.missingRequired.map((key) => `Missing required env: ${key}`),
      ].join("\n"),
    );
  }

  return report;
}

export function getProductionWarnings(): string[] {
  return getEnvValidationReport().warnings;
}

export function getEnvValidationReport(): EnvValidationReport {
  if (!cachedReport) {
    cachedReport = buildEnvValidationReport();
  }
  return cachedReport;
}

function buildEnvValidationReport(): EnvValidationReport {
  const env = getEnv();
  const missingRequired: string[] =
    env.NODE_ENV === "production"
      ? PRODUCTION_REQUIRED.filter((key) => !hasValue(env[key]))
      : [];
  const warnings: string[] = [];

  if (env.NODE_ENV === "production" && env.STORAGE_DRIVER !== "s3") {
    missingRequired.push("STORAGE_DRIVER=s3");
  }

  if (!hasValue(env.SENTRY_DSN)) {
    warnings.push("SENTRY_DSN is not configured; production error tracking is not active.");
  }
  if (!hasValue(env.BETTERSTACK_API_KEY) && !hasValue(env.UPTIME_MONITOR_URL)) {
    warnings.push("No uptime/log monitoring provider is configured.");
  }
  if (!hasValue(env.UPSTASH_REDIS_REST_URL) || !hasValue(env.UPSTASH_REDIS_REST_TOKEN)) {
    warnings.push("Upstash Redis is not configured; rate limiting falls back to process memory.");
  }
  if (!hasValue(env.SMTP_HOST) || !hasValue(env.SMTP_USER) || !hasValue(env.SMTP_PASSWORD)) {
    warnings.push("SMTP is not fully configured; password reset email delivery may be unavailable.");
  }

  const webConcurrency = Number.parseInt(env.WEB_CONCURRENCY ?? "1", 10);
  if (Number.isFinite(webConcurrency) && webConcurrency > 1) {
    warnings.push(
      "WEB_CONCURRENCY is greater than 1. V1 export queue is in-memory and should run as a single instance until a persistent queue is added.",
    );
  }

  const maxUploadMb = Number.parseInt(env.MAX_UPLOAD_MB ?? "500", 10);
  if (Number.isFinite(maxUploadMb) && maxUploadMb > 500) {
    warnings.push("MAX_UPLOAD_MB is above 500 while the current upload route buffers uploads in memory.");
  }

  return {
    ok: missingRequired.length === 0,
    environment: env.NODE_ENV,
    missingRequired: [...new Set(missingRequired)],
    warnings,
    groups: {
      coreApp: hasValue(env.NEXT_PUBLIC_APP_URL),
      auth: hasValue(env.NEXTAUTH_SECRET) && hasValue(env.NEXTAUTH_URL),
      database: hasValue(env.DATABASE_URL),
      aiProviders: hasValue(env.OPENAI_API_KEY) && hasValue(env.OPENROUTER_API_KEY),
      storage:
        env.STORAGE_DRIVER === "s3" &&
        hasValue(env.S3_BUCKET) &&
        hasValue(env.S3_REGION) &&
        hasValue(env.S3_ACCESS_KEY_ID) &&
        hasValue(env.S3_SECRET_ACCESS_KEY),
      billing:
        hasValue(env.RAZORPAY_KEY_ID) &&
        hasValue(env.RAZORPAY_KEY_SECRET) &&
        hasValue(env.RAZORPAY_WEBHOOK_SECRET) &&
        hasValue(env.NEXT_PUBLIC_RAZORPAY_KEY_ID),
      observability: hasValue(env.SENTRY_DSN) || hasValue(env.BETTERSTACK_API_KEY) || hasValue(env.UPTIME_MONITOR_URL),
      rateLimiting: hasValue(env.UPSTASH_REDIS_REST_URL) && hasValue(env.UPSTASH_REDIS_REST_TOKEN),
      email: hasValue(env.SMTP_HOST) && hasValue(env.SMTP_USER) && hasValue(env.SMTP_PASSWORD),
    },
  };
}

function hasValue(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
