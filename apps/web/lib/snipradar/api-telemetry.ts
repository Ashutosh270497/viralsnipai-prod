import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

interface TelemetryInput {
  route: string;
  method: string;
  status: number;
  durationMs: number;
  userId?: string;
  meta?: Record<string, unknown>;
}

const telemetryWebhookUrl = process.env.SNIPRADAR_TELEMETRY_WEBHOOK_URL?.trim();
const successSampleRate = clampSampleRate(
  Number(process.env.SNIPRADAR_TELEMETRY_SUCCESS_SAMPLE_RATE ?? 0.05)
);
const warnSampleRate = clampSampleRate(
  Number(process.env.SNIPRADAR_TELEMETRY_WARN_SAMPLE_RATE ?? 0.5)
);

function clampSampleRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function shouldForward(status: number): boolean {
  if (!telemetryWebhookUrl) return false;
  if (status >= 500) return true;
  if (status >= 400) return Math.random() < warnSampleRate;
  return Math.random() < successSampleRate;
}

function forwardTelemetry(payload: Record<string, unknown>) {
  if (!telemetryWebhookUrl) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);

  void fetch(telemetryWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .catch((error) => {
      logger.warn("[SnipRadar API] telemetry forward failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => clearTimeout(timeout));
}

export function attachServerTiming(
  response: NextResponse,
  metricName: string,
  startedAt: number
): NextResponse {
  const durationMs = Date.now() - startedAt;
  response.headers.set("Server-Timing", `${metricName};dur=${durationMs}`);
  return response;
}

export function logSnipRadarApiTelemetry(input: TelemetryInput): void {
  const level = input.status >= 500 ? "error" : input.status >= 400 ? "warn" : "info";
  const bucket =
    input.durationMs > 2000 ? "slow_2s_plus" : input.durationMs > 1000 ? "slow_1s_plus" : "ok";

  const message = "[SnipRadar API] Request completed";
  const context = {
    route: input.route,
    method: input.method,
    status: input.status,
    durationMs: input.durationMs,
    performanceBucket: bucket,
    userId: input.userId,
    ...(input.meta ?? {}),
  };

  if (level === "error") {
    logger.error(message, context);
  } else if (level === "warn") {
    logger.warn(message, context);
  } else {
    logger.info(message, context);
  }

  if (shouldForward(input.status)) {
    forwardTelemetry({
      event: "snipradar_api_request",
      timestamp: new Date().toISOString(),
      ...context,
    });
  }
}
