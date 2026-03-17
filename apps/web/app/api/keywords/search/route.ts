export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { createDefaultKeywordResearchOrchestrator } from "@/lib/keywords/keyword-research-orchestrator";
import { detectKeywordScript, normalizeKeywordForLocale } from "@/lib/keywords/localization";
import {
  buildOutcomeSignalProfile,
  scoreKeywordAgainstOutcome,
} from "@/lib/keywords/outcome-feedback";
import {
  getKeywordSearchQueue,
  KeywordSearchQueueSaturatedError,
  KeywordSearchQueueTimeoutError,
} from "@/lib/keywords/search-queue";
import { getKeywordRuntimeMetricsCollector } from "@/lib/keywords/runtime-metrics";
import {
  checkKeywordQuota,
  projectUsageAfterConsume,
  recordKeywordUsage,
} from "@/lib/keywords/monetization";

const searchSchema = z.object({
  keyword: z
    .string()
    .min(2, "Keyword must be at least 2 characters")
    .max(120, "Keyword must be 120 characters or less"),
  niche: z.string().optional(),
  country: z.string().length(2).optional(),
  language: z.string().min(2).max(5).optional(),
});

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function getEnvInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return clampInt(parsed, min, max);
}

function normalizeKeywordInput(keyword: string): string {
  return keyword.trim().replace(/\s+/g, " ");
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function buildServerTimingHeader(entries: Array<{ name: string; durationMs: number }>): string {
  return entries
    .filter((entry) => Number.isFinite(entry.durationMs) && entry.durationMs >= 0)
    .map((entry) => `${entry.name};dur=${Math.round(entry.durationMs * 100) / 100}`)
    .join(", ");
}

/**
 * POST /api/keywords/search
 * Search and analyze a keyword for YouTube SEO
 */
export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  const runtimeMetrics = getKeywordRuntimeMetricsCollector();
  const queue = getKeywordSearchQueue();

  const respond = (
    body: unknown,
    status: number,
    meta?: {
      source?: "cache" | "fresh" | "fallback";
      cacheHit?: boolean;
      queueWaitMs?: number;
      cacheLookupMs?: number;
      researchDurationMs?: number;
      queueSnapshot?: ReturnType<typeof queue.getStats>;
      telemetry?: Record<string, unknown>;
    },
  ) => {
    const durationMs = Date.now() - requestStartedAt;
    const response = NextResponse.json(body, { status });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set(
      "Server-Timing",
      buildServerTimingHeader([
        { name: "keywords_total", durationMs },
        { name: "keywords_cache_lookup", durationMs: meta?.cacheLookupMs ?? 0 },
        { name: "keywords_queue_wait", durationMs: meta?.queueWaitMs ?? 0 },
        { name: "keywords_research", durationMs: meta?.researchDurationMs ?? 0 },
      ]),
    );

    runtimeMetrics.record({
      durationMs,
      queueWaitMs: meta?.queueWaitMs ?? 0,
      status,
      cacheHit: meta?.cacheHit ?? false,
      source: meta?.source ?? "fallback",
    });

    const queueSnapshot = meta?.queueSnapshot ?? queue.getStats();
    const context = {
      route: "/api/keywords/search",
      method: "POST",
      status,
      durationMs,
      queueWaitMs: meta?.queueWaitMs ?? 0,
      cacheHit: meta?.cacheHit ?? false,
      source: meta?.source ?? "fallback",
      queue: {
        active: queueSnapshot.active,
        queued: queueSnapshot.queued,
        concurrency: queueSnapshot.concurrency,
        maxQueueSize: queueSnapshot.maxQueueSize,
      },
      ...(meta?.telemetry ?? {}),
    };

    if (status >= 500) {
      logger.error("[Keywords API] Search request failed", context);
    } else if (status >= 400) {
      logger.warn("[Keywords API] Search request warning", context);
    } else {
      logger.info("[Keywords API] Search request completed", context);
    }

    return response;
  };

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return respond({ error: "Unauthorized" }, 401, {
        source: "fallback",
        telemetry: { reason: "UNAUTHORIZED" },
      });
    }

    const body = await request.json();
    const result = searchSchema.safeParse(body);

    if (!result.success) {
      return respond({ error: "Validation failed", details: result.error.flatten() }, 400, {
        source: "fallback",
        telemetry: { reason: "VALIDATION_FAILED" },
      });
    }

    const { keyword, niche, country, language } = result.data;
    const userId = session.user.id;
    const isProduction = process.env.NODE_ENV === "production";
    const keywordNormalizedInput = normalizeKeywordInput(keyword);
    const tokenCount = keywordNormalizedInput.split(/\s+/).filter(Boolean).length;
    const searchQuota = await checkKeywordQuota(userId, "searches");

    if (!searchQuota.allowed) {
      return respond(
        {
          error: "Keyword search limit reached for this billing period.",
          message:
            searchQuota.tier === "free"
              ? "You reached your free keyword search limit. Upgrade to Starter for more monthly searches."
              : "You reached your keyword search limit. Upgrade your plan for higher limits.",
          usage: searchQuota,
          upgrade: {
            required: true,
            targetPlan: searchQuota.tier === "free" ? "starter" : "creator",
            path: "/pricing",
          },
        },
        403,
        {
          source: "fallback",
          telemetry: { reason: "PLAN_LIMIT_REACHED", tier: searchQuota.tier },
        },
      );
    }
    const usageAfterSearch = projectUsageAfterConsume(searchQuota, 1);

    const cacheTtlHours = getEnvInt("KEYWORD_CACHE_TTL_HOURS", 24, 1, 168);
    const cacheTtlMs = cacheTtlHours * 60 * 60 * 1000;
    const maxKeywordTokens = getEnvInt("KEYWORD_SEARCH_MAX_TOKENS", 15, 2, 25);
    const maxPerMinute = getEnvInt("KEYWORD_SEARCH_RATE_LIMIT_PER_MINUTE", 12, 1, 120);
    const maxPerDay = getEnvInt("KEYWORD_SEARCH_RATE_LIMIT_PER_DAY", 250, 10, 5000);

    if (tokenCount > maxKeywordTokens) {
      return respond(
        {
          error: `Keyword has too many tokens (${tokenCount}). Keep it under ${maxKeywordTokens} words.`,
        },
        400,
        {
          source: "fallback",
          telemetry: { reason: "TOKEN_LIMIT_EXCEEDED", tokenCount, maxKeywordTokens },
        },
      );
    }

    try {
      if ((prisma as any).keywordResearch) {
        const now = Date.now();
        const [minuteCount, dayCount] = await Promise.all([
          prisma.keywordResearch.count({
            where: {
              userId,
              lastUpdated: { gte: new Date(now - 60_000) },
            },
          }),
          prisma.keywordResearch.count({
            where: {
              userId,
              lastUpdated: { gte: new Date(now - 24 * 60 * 60 * 1000) },
            },
          }),
        ]);

        if (minuteCount >= maxPerMinute || dayCount >= maxPerDay) {
          return respond(
            {
              error: "Keyword search rate limit reached. Please wait and try again.",
              limits: {
                perMinute: maxPerMinute,
                perDay: maxPerDay,
              },
            },
            429,
            {
              source: "fallback",
              telemetry: {
                reason: "RATE_LIMIT_REACHED",
                minuteCount,
                dayCount,
              },
            },
          );
        }
      }
    } catch (rateLimitError) {
      console.warn("[Keywords] Rate-limit guard check failed:", rateLimitError);
    }

    // Check for cached results (less than 24 hours old)
    const cacheLookupStartedAt = Date.now();
    try {
      if ((prisma as any).keywordResearch) {
        const cached = await prisma.keywordResearch.findFirst({
          where: {
            userId,
            keyword: keywordNormalizedInput.toLowerCase(),
            lastUpdated: {
              gte: new Date(Date.now() - cacheTtlMs),
            },
          },
        });

        if (cached) {
          const normalizedKeyword = normalizeKeywordForLocale(keywordNormalizedInput);
          const lastUpdatedAt = cached.lastUpdated ? new Date(cached.lastUpdated) : new Date();
          const ageSeconds = Math.max(0, Math.floor((Date.now() - lastUpdatedAt.getTime()) / 1000));
          const staleInSeconds = Math.max(0, Math.floor(cacheTtlMs / 1000) - ageSeconds);
          try {
            await recordKeywordUsage(userId, "searches", {
              cacheHit: true,
              keyword: keywordNormalizedInput.toLowerCase(),
            });
          } catch (usageError) {
            logger.warn("[Keywords API] Failed to record keyword search usage", {
              userId,
              keyword: keywordNormalizedInput.toLowerCase(),
              error: usageError instanceof Error ? usageError.message : String(usageError),
            });
          }

          return respond(
            {
              ...cached,
              cached: true,
              dataQuality: {
                source: "cache_replay",
                confidence: "medium",
                warnings: [`Returned cached analysis from ${lastUpdatedAt.toISOString()}.`],
              },
              searchVolumeSource: "youtube_total_results_proxy",
              relatedKeywordClusters: {},
              repurposeReadinessScore: 0,
              platformFit: { youtube: 0, x: 0, instagram: 0 },
              scoreBreakdown: null,
              freshnessTimestamp: lastUpdatedAt.toISOString(),
              cacheMetadata: {
                hit: true,
                ttlSeconds: Math.floor(cacheTtlMs / 1000),
                ageSeconds,
                staleInSeconds,
                strategy: "keyword_research_db_ttl",
              },
              discoveryMetadata: null,
              partialResponse: false,
              localization: {
                normalizedKeyword,
                script: detectKeywordScript(keywordNormalizedInput),
                localeVariants: [normalizedKeyword],
                regionBoostApplied: (country ?? "US").toUpperCase() === "IN",
              },
              relatedKeywords: parseJsonValue<string[]>(cached.relatedKeywords, []),
              topVideos: parseJsonValue<unknown[]>(cached.topVideos, []),
              runtime: {
                mode: "cache",
                queue: queue.getStats(),
              },
              usage: usageAfterSearch,
            },
            200,
            {
              source: "cache",
              cacheHit: true,
              cacheLookupMs: Date.now() - cacheLookupStartedAt,
              telemetry: { cache: "hit" },
            },
          );
        }
      }
    } catch (cacheError) {
      // Model might not exist yet - continue with fresh search
      console.warn("[Keywords] Cache check failed:", cacheError);
    }

    const queueSnapshotBefore = queue.getStats();
    const orchestrator = createDefaultKeywordResearchOrchestrator();
    let queueWaitMs = 0;
    let researchDurationMs = 0;

    let analysis: Awaited<ReturnType<typeof orchestrator.research>> | null = null;

    try {
      const queueResult = await queue.execute(
        () =>
          orchestrator.research(
            {
              keyword: keywordNormalizedInput,
              niche,
              country: (country ?? "US").toUpperCase(),
              language: (language ?? "en").toLowerCase(),
            },
            { allowMockFallback: !isProduction },
          ),
        {
          timeoutMs: getEnvInt("KEYWORD_SEARCH_TASK_TIMEOUT_MS", 25_000, 2000, 120_000),
        },
      );
      analysis = queueResult.value;
      queueWaitMs = queueResult.queueWaitMs;
      researchDurationMs = queueResult.runDurationMs;
    } catch (queueError) {
      if (queueError instanceof KeywordSearchQueueSaturatedError) {
        const snapshot = queue.getStats();
        return respond(
          {
            error: "Keyword research is currently at capacity. Please retry in a moment.",
            code: "KEYWORD_QUEUE_SATURATED",
            queue: {
              queued: snapshot.queued,
              maxQueueSize: snapshot.maxQueueSize,
            },
          },
          503,
          {
            source: "fallback",
            cacheHit: false,
            queueWaitMs: 0,
            queueSnapshot: snapshot,
            telemetry: { reason: "QUEUE_SATURATED" },
          },
        );
      }
      if (queueError instanceof KeywordSearchQueueTimeoutError) {
        return respond(
          {
            error: "Keyword analysis timed out while waiting for data providers. Please retry.",
            code: "KEYWORD_QUEUE_TIMEOUT",
          },
          504,
          {
            source: "fallback",
            cacheHit: false,
            queueWaitMs: 0,
            telemetry: { reason: "QUEUE_TIMEOUT" },
          },
        );
      }
      throw queueError;
    }

    if (!analysis) {
      return respond({ error: "Failed to produce keyword analysis." }, 500, {
        source: "fallback",
        telemetry: { reason: "NO_ANALYSIS_RESULT" },
      });
    }

    const outcomeProfile = await buildOutcomeSignalProfile({ userId });
    const outcomeFit = scoreKeywordAgainstOutcome(outcomeProfile, keywordNormalizedInput);
    const adjustedOpportunityScore = Math.max(
      1,
      Math.min(100, analysis.opportunityScore + outcomeFit.adjustment),
    );
    const scoreBreakdown = {
      ...analysis.scoreBreakdown,
      finalScore: adjustedOpportunityScore,
      topDrivers:
        outcomeFit.adjustment !== 0
          ? ["creatorFeedback", ...analysis.scoreBreakdown.topDrivers].slice(0, 3)
          : analysis.scoreBreakdown.topDrivers,
    };

    // Try to save to database
    let savedRecord = null;
    try {
      if ((prisma as any).keywordResearch) {
        savedRecord = await prisma.keywordResearch.create({
          data: {
            userId,
            keyword: keywordNormalizedInput.toLowerCase(),
            searchVolume: analysis.searchVolume,
            competition: analysis.competition.score,
            difficulty: analysis.competition.difficulty,
            trendDirection: analysis.trendDirection,
            avgViews: analysis.metrics.avgViews,
            avgLikes: analysis.metrics.avgLikes,
            avgComments: analysis.metrics.avgComments,
            estimatedCPM: analysis.estimatedCPM,
            relatedKeywords: analysis.relatedKeywords,
            topVideos: analysis.topVideos,
            searchIntent: analysis.searchIntent,
            lastUpdated: new Date(),
          },
        });
      }
    } catch (saveError) {
      // Database model might not exist yet - that's okay
      console.warn("[Keywords] Failed to save research:", saveError);
    }

    const response = {
      id: savedRecord?.id || null,
      keyword: keywordNormalizedInput.toLowerCase(),
      searchVolume: analysis.searchVolume,
      searchVolumeSource: analysis.searchVolumeSource,
      competition: analysis.competition.score,
      difficulty: analysis.competition.difficulty,
      recommendation: analysis.competition.recommendation,
      competitionBreakdown: analysis.competition.breakdown,
      baseOpportunityScore: analysis.opportunityScore,
      opportunityScore: adjustedOpportunityScore,
      scoreBreakdown,
      repurposeReadinessScore: analysis.repurposeReadinessScore,
      trendDirection: analysis.trendDirection,
      searchIntent: analysis.searchIntent,
      platformFit: analysis.platformFit,
      estimatedCPM: analysis.estimatedCPM,
      metrics: {
        avgViews: analysis.metrics.avgViews,
        avgLikes: analysis.metrics.avgLikes,
        avgComments: analysis.metrics.avgComments,
        avgDuration: analysis.metrics.avgDuration,
        engagementRate: analysis.metrics.engagementRate,
        topChannelDominance: analysis.metrics.topChannelDominance,
        averageVideoAge: analysis.metrics.averageVideoAge,
      },
      topVideos: analysis.topVideos,
      relatedKeywords: analysis.relatedKeywords,
      relatedKeywordClusters: analysis.relatedKeywordClusters,
      dataQuality: analysis.dataQuality,
      localization: analysis.localization,
      freshnessTimestamp: analysis.freshnessTimestamp,
      cacheMetadata: {
        hit: false,
        ttlSeconds: Math.floor(cacheTtlMs / 1000),
        ageSeconds: 0,
        staleInSeconds: Math.floor(cacheTtlMs / 1000),
        strategy: "keyword_research_db_ttl",
      },
      discoveryMetadata: analysis.discoveryMetadata ?? null,
      partialResponse: (analysis.discoveryMetadata?.queriesFailed ?? 0) > 0,
      closedLoop: {
        version: "rolling_v1",
        feedbackWeight: outcomeProfile.feedbackWeight,
        outcomeSignalsUsed: outcomeProfile.outcomeSignalsUsed,
        rollingWindowDays: outcomeProfile.windowDays,
        dominantOutcomeIntent: outcomeProfile.dominantOutcomeIntent,
        creatorFitScore: outcomeFit.creatorFitScore,
        tokenFitScore: outcomeFit.tokenFitScore,
        intentFitScore: outcomeFit.intentFitScore,
        adjustment: outcomeFit.adjustment,
        matchedOutcomeTokens: outcomeFit.matchedTokens,
      },
      cached: false,
      runtime: {
        mode: "fresh",
        queueWaitMs,
        researchDurationMs,
        queue: queueSnapshotBefore,
      },
      usage: usageAfterSearch,
    };

    try {
      await recordKeywordUsage(userId, "searches", {
        cacheHit: false,
        keyword: keywordNormalizedInput.toLowerCase(),
        partialResponse: response.partialResponse,
      });
    } catch (usageError) {
      logger.warn("[Keywords API] Failed to record keyword search usage", {
        userId,
        keyword: keywordNormalizedInput.toLowerCase(),
        error: usageError instanceof Error ? usageError.message : String(usageError),
      });
    }

    return respond(response, 200, {
      source: "fresh",
      cacheHit: false,
      queueWaitMs,
      cacheLookupMs: Date.now() - cacheLookupStartedAt,
      researchDurationMs,
      queueSnapshot: queueSnapshotBefore,
      telemetry: {
        cache: "miss",
        partialResponse: response.partialResponse,
      },
    });
  } catch (error) {
    console.error("[Keywords] Search error:", error);

    if (error instanceof Error && error.message.startsWith("YOUTUBE_API_")) {
      return respond(
        {
          error: "Keyword data provider is unavailable right now. Please try again shortly.",
          code: error.message,
        },
        503,
        {
          source: "fallback",
          telemetry: {
            reason: "PROVIDER_UNAVAILABLE",
            providerCode: error.message,
          },
        },
      );
    }

    return respond({ error: "Failed to search keyword" }, 500, {
      source: "fallback",
      telemetry: { reason: "UNHANDLED_ERROR" },
    });
  }
}
