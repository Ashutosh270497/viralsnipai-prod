/**
 * In-memory sliding-window rate limiter for API routes.
 * For production at scale, replace Map with Redis (Upstash).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000).unref?.();

export interface RateLimitConfig {
  /** Unique identifier for this rate limit rule */
  id: string;
  /** Maximum requests allowed per window */
  limit: number;
  /** Window duration in seconds */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

/**
 * Check and increment rate limit for a given key.
 * @param identifier - Usually userId or IP address
 * @param config - Rate limit configuration
 */
export function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  const key = `${config.id}:${identifier}`;
  const now = Date.now();
  const windowMs = config.windowSec * 1000;

  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    // New window
    const newEntry: RateLimitEntry = { count: 1, resetAt: now + windowMs };
    store.set(key, newEntry);
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt: newEntry.resetAt,
      retryAfterSec: 0,
    };
  }

  if (entry.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
    retryAfterSec: 0,
  };
}

/**
 * Build rate limit response headers
 */
export function rateLimitHeaders(result: RateLimitResult, config: RateLimitConfig): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(config.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed ? {} : { 'Retry-After': String(result.retryAfterSec) }),
  };
}

// Pre-defined rate limit configs for AI endpoints
export const RATE_LIMITS = {
  /** Hook generation: 20 per minute per user */
  hookGenerate: { id: 'hook-generate', limit: 20, windowSec: 60 },
  /** Script generation: 10 per minute per user */
  scriptGenerate: { id: 'script-generate', limit: 10, windowSec: 60 },
  /** Highlight generation: 5 per minute per user */
  highlightGenerate: { id: 'highlight-generate', limit: 5, windowSec: 60 },
  /** Imagen: 10 per minute per user */
  imagenGenerate: { id: 'imagen-generate', limit: 10, windowSec: 60 },
  /** Veo: 3 per minute per user */
  veoGenerate: { id: 'veo-generate', limit: 3, windowSec: 60 },
  /** Thumbnail: 20 per minute per user */
  thumbnailGenerate: { id: 'thumbnail-generate', limit: 20, windowSec: 60 },
  /** Content calendar: 5 per 5 minutes per user */
  contentCalendar: { id: 'content-calendar', limit: 5, windowSec: 300 },
  /** Title generator: 30 per minute per user */
  titleGenerate: { id: 'title-generate', limit: 30, windowSec: 60 },
} as const;
