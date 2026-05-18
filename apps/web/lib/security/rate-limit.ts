import { ErrorCodes } from "@/lib/api/response";

export type V1RateLimitRule = {
  name: string;
  windowMs: number;
  maxHits: number;
};

export type V1RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
  violatedRule?: string;
  headers: Record<string, string>;
  actorKey: string;
};

type Bucket = {
  timestamps: number[];
  lastTouchedAt: number;
};

const memoryBuckets = new Map<string, Bucket>();
const MAX_BUCKETS = 20_000;
let warnedMissingRedis = false;

export const V1_RATE_LIMITS = {
  SIGNUP: [{ name: "15min", windowMs: 15 * 60 * 1000, maxHits: 5 }],
  LOGIN: [{ name: "15min", windowMs: 15 * 60 * 1000, maxHits: 10 }],
  UPLOAD: [
    { name: "10min", windowMs: 10 * 60 * 1000, maxHits: 5 },
    { name: "hour", windowMs: 60 * 60 * 1000, maxHits: 20 },
  ],
  YOUTUBE_INGEST: [
    { name: "10min", windowMs: 10 * 60 * 1000, maxHits: 5 },
    { name: "hour", windowMs: 60 * 60 * 1000, maxHits: 20 },
  ],
  GENERATE_PROMPTS: [
    { name: "10min", windowMs: 10 * 60 * 1000, maxHits: 10 },
    { name: "day", windowMs: 24 * 60 * 60 * 1000, maxHits: 50 },
  ],
  AUTO_HIGHLIGHTS: [
    { name: "10min", windowMs: 10 * 60 * 1000, maxHits: 5 },
    { name: "day", windowMs: 24 * 60 * 60 * 1000, maxHits: 30 },
  ],
  CAPTIONS: [{ name: "10min", windowMs: 10 * 60 * 1000, maxHits: 20 }],
  EXPORT: [
    { name: "10min", windowMs: 10 * 60 * 1000, maxHits: 10 },
    { name: "day", windowMs: 24 * 60 * 60 * 1000, maxHits: 50 },
  ],
} as const satisfies Record<string, V1RateLimitRule[]>;

export async function consumeV1RateLimit({
  request,
  userId,
  routeKey,
  rules,
  actorOverride,
}: {
  request: Request;
  userId?: string | null;
  routeKey: string;
  rules: readonly V1RateLimitRule[];
  actorOverride?: string | null;
}): Promise<V1RateLimitResult> {
  const actorKey = actorOverride || userId || requestIp(request);
  const redis = getUpstashConfig();
  const result = redis
    ? await consumeWithUpstash({ actorKey, routeKey, rules, redis })
    : consumeWithMemory({ actorKey, routeKey, rules });

  return { ...result, actorKey };
}

export function rateLimitResponse(result: V1RateLimitResult, message = "Too many requests.") {
  return Response.json(
    {
      success: false,
      error: {
        code: ErrorCodes.RATE_LIMIT_EXCEEDED,
        message,
        details: {
          limit: result.limit,
          remaining: result.remaining,
          resetAt: new Date(result.resetAt).toISOString(),
          retryAfterSec: result.retryAfterSec,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      },
    },
    { status: 429, headers: result.headers },
  );
}

export function getV1RateLimiterHealth() {
  const configured = Boolean(getUpstashConfig());
  const warnings: string[] = [];
  if (!configured && process.env.NODE_ENV === "production") {
    warnings.push(
      "UPSTASH_REDIS_REST_URL/TOKEN are not configured; V1 rate limiter is using in-memory fallback.",
    );
  }
  return {
    configured,
    backend: configured ? "upstash" : "memory",
    warnings,
    memoryBucketCount: memoryBuckets.size,
  };
}

function consumeWithMemory({
  actorKey,
  routeKey,
  rules,
}: {
  actorKey: string;
  routeKey: string;
  rules: readonly V1RateLimitRule[];
}): V1RateLimitResult {
  maybeWarnMissingRedis();
  const now = Date.now();
  const maxWindowMs = Math.max(...rules.map((rule) => rule.windowMs));
  const bucketKey = `${routeKey}:${actorKey}`;
  const existing = memoryBuckets.get(bucketKey);
  const timestamps = (existing?.timestamps ?? []).filter((ts) => now - ts < maxWindowMs);

  for (const rule of rules) {
    const hits = timestamps.filter((ts) => now - ts < rule.windowMs).length;
    if (hits >= rule.maxHits) {
      const oldestRelevant = timestamps.find((ts) => now - ts < rule.windowMs) ?? now;
      const resetAt = oldestRelevant + rule.windowMs;
      return buildResult({
        allowed: false,
        limit: rule.maxHits,
        remaining: 0,
        resetAt,
        retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
        violatedRule: rule.name,
      });
    }
  }

  timestamps.push(now);
  memoryBuckets.set(bucketKey, { timestamps, lastTouchedAt: now });
  garbageCollectMemory(now);

  const primary = rules[0];
  const primaryHits = timestamps.filter((ts) => now - ts < primary.windowMs).length;
  return buildResult({
    allowed: true,
    limit: primary.maxHits,
    remaining: Math.max(0, primary.maxHits - primaryHits),
    resetAt: now + primary.windowMs,
    retryAfterSec: 0,
  });
}

async function consumeWithUpstash({
  actorKey,
  routeKey,
  rules,
  redis,
}: {
  actorKey: string;
  routeKey: string;
  rules: readonly V1RateLimitRule[];
  redis: { url: string; token: string };
}): Promise<V1RateLimitResult> {
  try {
    const now = Date.now();
    for (const rule of rules) {
      const key = `${routeKey}:${rule.name}:${actorKey}`;
      const count = await upstashCommand<number>(redis, ["INCR", key]);
      if (count === 1) {
        await upstashCommand(redis, ["PEXPIRE", key, String(rule.windowMs)]);
      }
      const ttlMs = Math.max(0, await upstashCommand<number>(redis, ["PTTL", key]));
      const resetAt = now + ttlMs;
      if (count > rule.maxHits) {
        return buildResult({
          allowed: false,
          limit: rule.maxHits,
          remaining: 0,
          resetAt,
          retryAfterSec: Math.max(1, Math.ceil(ttlMs / 1000)),
          violatedRule: rule.name,
        });
      }
    }

    const primary = rules[0];
    return buildResult({
      allowed: true,
      limit: primary.maxHits,
      remaining: primary.maxHits - 1,
      resetAt: Date.now() + primary.windowMs,
      retryAfterSec: 0,
    });
  } catch (error) {
    console.warn("[rate-limit] Upstash unavailable; falling back to memory", error);
    return consumeWithMemory({ actorKey, routeKey, rules });
  }
}

async function upstashCommand<T = unknown>(
  redis: { url: string; token: string },
  command: string[],
): Promise<T> {
  const path = command.map((segment) => encodeURIComponent(segment)).join("/");
  const response = await fetch(`${redis.url.replace(/\/$/, "")}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redis.token}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Upstash command failed with ${response.status}`);
  }
  const payload = await response.json();
  if (payload?.error) {
    throw new Error(String(payload.error));
  }
  return payload.result as T;
}

function buildResult(input: Omit<V1RateLimitResult, "headers" | "actorKey">): V1RateLimitResult {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(input.limit),
    "X-RateLimit-Remaining": String(input.remaining),
    "X-RateLimit-Reset": String(Math.ceil(input.resetAt / 1000)),
  };
  if (!input.allowed && input.retryAfterSec > 0) {
    headers["Retry-After"] = String(input.retryAfterSec);
  }
  return { ...input, headers, actorKey: "" };
}

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

function maybeWarnMissingRedis() {
  if (warnedMissingRedis || process.env.NODE_ENV !== "production") return;
  warnedMissingRedis = true;
  console.warn(
    "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN are not configured; using in-memory fallback.",
  );
}

function requestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown-ip"
  );
}

function garbageCollectMemory(now: number) {
  if (memoryBuckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of memoryBuckets.entries()) {
    if (now - bucket.lastTouchedAt > 24 * 60 * 60 * 1000) {
      memoryBuckets.delete(key);
    }
  }
}
