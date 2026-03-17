import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

type RateLimitRule = {
  name: string;
  windowMs: number;
  maxHits: number;
};

type RateLimitBucket = {
  timestamps: number[];
  lastTouchedAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
  resetAt: number;
  violatedRule?: string;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();
const MAX_BUCKETS = 10_000;

function compactTimestamps(timestamps: number[], now: number, maxWindowMs: number): number[] {
  return timestamps.filter((ts) => now - ts < maxWindowMs);
}

function garbageCollectBuckets(now: number) {
  if (rateLimitBuckets.size <= MAX_BUCKETS) return;

  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (now - bucket.lastTouchedAt > 15 * 60 * 1000) {
      rateLimitBuckets.delete(key);
    }
  }
}

export function consumeSnipRadarRateLimit(
  scope: string,
  actorKey: string,
  rules: RateLimitRule[]
): RateLimitResult {
  const now = Date.now();
  const maxWindowMs = Math.max(...rules.map((rule) => rule.windowMs));
  const bucketKey = `${scope}:${actorKey}`;
  const existing = rateLimitBuckets.get(bucketKey);
  const timestamps = compactTimestamps(existing?.timestamps ?? [], now, maxWindowMs);

  for (const rule of rules) {
    const hitsInWindow = timestamps.filter((ts) => now - ts < rule.windowMs).length;
    if (hitsInWindow >= rule.maxHits) {
      const oldestRelevant = timestamps.find((ts) => now - ts < rule.windowMs) ?? now;
      const retryAfterMs = Math.max(1, rule.windowMs - (now - oldestRelevant));
      return {
        allowed: false,
        limit: rule.maxHits,
        remaining: 0,
        retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        resetAt: oldestRelevant + rule.windowMs,
        violatedRule: rule.name,
      };
    }
  }

  timestamps.push(now);
  rateLimitBuckets.set(bucketKey, {
    timestamps,
    lastTouchedAt: now,
  });
  garbageCollectBuckets(now);

  const primaryRule = rules[0];
  const hitsInPrimaryWindow = timestamps.filter((ts) => now - ts < primaryRule.windowMs).length;

  return {
    allowed: true,
    limit: primaryRule.maxHits,
    remaining: Math.max(0, primaryRule.maxHits - hitsInPrimaryWindow),
    retryAfterSec: 0,
    resetAt: now + primaryRule.windowMs,
  };
}

export function buildSnipRadarRateLimitHeaders(result: RateLimitResult): HeadersInit {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
  };

  if (!result.allowed && result.retryAfterSec > 0) {
    headers["Retry-After"] = String(result.retryAfterSec);
  }

  return headers;
}

/**
 * Rate limit rules for the SnipRadar Assistant chat endpoint.
 *
 * Two tiers:
 *   burst  — 5 messages / 60 s   → prevents rapid-fire spam
 *   hourly — 20 messages / 3600 s → reasonable cap for free users
 *
 * Both rules are evaluated simultaneously; violating either blocks the request.
 */
export const ASSISTANT_CHAT_RATE_LIMIT_RULES = [
  { name: "burst",  windowMs: 60 * 1000,        maxHits: 5  },
  { name: "hourly", windowMs: 60 * 60 * 1000,   maxHits: 20 },
] as const;

export function extractMachineSecret(req: NextRequest): string | null {
  return (
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null
  );
}

export function timingSafeSecretEqual(provided: string | null | undefined, expected: string | null | undefined) {
  if (!provided || !expected) return false;

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
