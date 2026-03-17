export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { incrementUsage } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { searchTrendingConversations } from "@/lib/integrations/x-api";
import { attachServerTiming, logSnipRadarApiTelemetry } from "@/lib/snipradar/api-telemetry";
import {
  requireSnipRadarFeature,
  requireSnipRadarUsage,
} from "@/lib/snipradar/billing-gates-server";
import { isDbPoolSaturationError } from "@/lib/snipradar/db-resilience";
import { getActiveClient } from "@/lib/openrouter-client";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";

const ENGAGEMENT_REPLY_TARGET = getActiveClient(null, "snipradarEngagementReplies");

const COOLDOWN_MS = 10 * 60 * 1000;
const ENGAGEMENT_CACHE_TTL_MS = 5_000;
const engagementQueryCache = new Map<string, { data: unknown; expiresAt: number }>();

type OpportunityStatus = "new" | "saved" | "replied" | "ignored";
type SortBy = "score" | "recent" | "engagement";

function parseStatus(status: string | null): OpportunityStatus | null {
  if (!status || status === "all") return null;
  if (status === "new" || status === "saved" || status === "replied" || status === "ignored") {
    return status;
  }
  return null;
}

function parseSortBy(sortBy: string | null): SortBy {
  if (sortBy === "recent" || sortBy === "engagement") return sortBy;
  return "score";
}

function calcOpportunityScore(metrics: {
  likes?: number;
  retweets?: number;
  replies?: number;
  impressions?: number;
}, createdAtISO: string): number {
  const likes = metrics.likes ?? 0;
  const retweets = metrics.retweets ?? 0;
  const replies = metrics.replies ?? 0;
  const impressions = metrics.impressions ?? 0;
  const weighted = likes + retweets * 2 + replies * 3;
  const velocityBase = impressions > 0 ? (weighted / impressions) * 100 : weighted / 100;
  const ageHours = Math.max(
    1,
    (Date.now() - new Date(createdAtISO).getTime()) / (1000 * 60 * 60)
  );
  const freshnessMultiplier = Math.max(0.6, Math.min(1.4, 24 / ageHours));
  return Math.max(1, Math.min(100, Math.round(velocityBase * freshnessMultiplier * 10)));
}

/**
 * GET /api/snipradar/engagement
 * Query params:
 * - niche=tech
 * - status=all|new|saved|replied|ignored
 * - page=1
 * - pageSize=10
 * - refresh=true (fetch from X API, upsert to DB)
 * - nextToken=<x_search_next_token>
 */
export async function GET(req: NextRequest) {
  const requestStartedAt = Date.now();
  let cacheKey: string | null = null;
  let currentUserId: string | undefined;
  const respond = (
    body: unknown,
    status = 200,
    meta?: Record<string, unknown>,
    headers?: HeadersInit
  ) => {
    const response = NextResponse.json(body, { status, headers });
    attachServerTiming(response, "snipradar_engagement_get", requestStartedAt);
    logSnipRadarApiTelemetry({
      route: "/api/snipradar/engagement",
      method: "GET",
      status,
      durationMs: Date.now() - requestStartedAt,
      userId: currentUserId,
      meta,
    });
    return response;
  };
  try {
    const user = await getCurrentUser();
    currentUserId = user?.id;
    if (!user) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const engagementGate = await requireSnipRadarFeature(
      user.id,
      "engagementFinder",
      "Engagement Finder is available on Plus and Pro plans."
    );
    if (!engagementGate.ok) {
      return engagementGate.response;
    }

    const { searchParams } = req.nextUrl;
    const requestedNiche = (searchParams.get("niche") || "tech").trim().toLowerCase();
    const refresh = searchParams.get("refresh") === "true";
    const nextToken = searchParams.get("nextToken") || undefined;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.max(1, Math.min(25, Number(searchParams.get("pageSize") ?? 10)));
    const statusFilter = parseStatus(searchParams.get("status"));
    const sortBy = parseSortBy(searchParams.get("sortBy"));
    const q = searchParams.get("q")?.trim() ?? "";
    const minScore = Math.max(0, Math.min(100, Number(searchParams.get("minScore") ?? 0)));
    let effectiveNiche = requestedNiche;
    cacheKey = `${user.id}:${effectiveNiche}:${statusFilter ?? "all"}:${page}:${pageSize}:${sortBy}:${minScore}:${q}`;

    if (!refresh) {
      const cached = engagementQueryCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return respond(cached.data, 200, { cache: "hit" });
      }
    }

    if (refresh) {
      const usageGate = await requireSnipRadarUsage(user.id, "engagement_opp", {
        feature: "engagementFinder",
        message: "You have reached the engagement opportunity limit for your current plan this month.",
      });
      if (!usageGate.ok) {
        return usageGate.response;
      }

      const rateLimit = consumeSnipRadarRateLimit("snipradar:engagement:refresh", user.id, [
        {
          name: "refresh-cooldown",
          windowMs: COOLDOWN_MS,
          maxHits: 1,
        },
      ]);
      if (!rateLimit.allowed) {
        return respond(
          { error: `Please wait ${Math.ceil(rateLimit.retryAfterSec / 60)} minutes before refreshing.` },
          429,
          { rateLimited: true, retryAfterSec: rateLimit.retryAfterSec },
          buildSnipRadarRateLimitHeaders(rateLimit)
        );
      }

      const trackedAccounts = await prisma.xTrackedAccount.findMany({
        where: { userId: user.id },
        select: { niche: true },
        take: 20,
      });
      const niches = trackedAccounts
        .map((a) => a.niche)
        .filter(Boolean)
        .map((value) => value!.trim().toLowerCase()) as string[];
      const topTrackedNiche = niches[0] ?? "tech";
      const shouldAutoPickNiche =
        effectiveNiche.length === 0 || effectiveNiche === "auto" || effectiveNiche === "all";
      if (shouldAutoPickNiche) {
        effectiveNiche = topTrackedNiche;
      }

      let results = await searchTrendingConversations({
        query: effectiveNiche,
        minLikes: 40,
        minReplies: 5,
        maxResults: 20,
        nextToken,
      });
      if ((results.data?.length ?? 0) === 0) {
        results = await searchTrendingConversations({
          query: effectiveNiche,
          minLikes: 10,
          minReplies: 1,
          maxResults: 20,
          nextToken,
        });
      }

      const userMap = new Map<
        string,
        { username: string; name: string; profile_image_url?: string }
      >();
      if (results.includes?.users) {
        for (const u of results.includes.users) {
          userMap.set(u.id, {
            username: u.username,
            name: u.name,
            profile_image_url: u.profile_image_url,
          });
        }
      }

      const now = new Date();
      const opportunities = (results.data ?? []).map((tweet) => {
        const author = userMap.get(tweet.author_id ?? "");
        const score = calcOpportunityScore(
          {
            likes: tweet.public_metrics?.like_count ?? 0,
            retweets: tweet.public_metrics?.retweet_count ?? 0,
            replies: tweet.public_metrics?.reply_count ?? 0,
            impressions: tweet.public_metrics?.impression_count ?? 0,
          },
          tweet.created_at
        );
        return {
          userId: user.id,
          tweetId: tweet.id,
          text: tweet.text,
          authorXUserId: tweet.author_id ?? null,
          authorUsername: author?.username ?? "unknown",
          authorName: author?.name ?? "Unknown",
          authorAvatar: author?.profile_image_url ?? null,
          likes: tweet.public_metrics?.like_count ?? 0,
          retweets: tweet.public_metrics?.retweet_count ?? 0,
          replies: tweet.public_metrics?.reply_count ?? 0,
          impressions: tweet.public_metrics?.impression_count ?? 0,
          niche: effectiveNiche,
          score,
          xCreatedAt: new Date(tweet.created_at),
          lastSeenAt: now,
        };
      });

      const existingTweetIds = new Set(
        (
          await prisma.xEngagementOpportunity.findMany({
            where: {
              userId: user.id,
              tweetId: { in: opportunities.map((item) => item.tweetId) },
            },
            select: { tweetId: true },
          })
        ).map((row) => row.tweetId)
      );

      const remaining =
        usageGate.state.usage.engagementOpps >= 0 && usageGate.state.limits.engagementFinder !== false
          ? usageGate.state.limits.engagementFinder.monthlyOpportunities === "unlimited"
            ? "unlimited"
            : Math.max(
                0,
                usageGate.state.limits.engagementFinder.monthlyOpportunities -
                  usageGate.state.usage.engagementOpps
              )
          : "unlimited";

      const existingOpportunities = opportunities.filter((item) => existingTweetIds.has(item.tweetId));
      const newOpportunities = opportunities.filter((item) => !existingTweetIds.has(item.tweetId));
      const creatableOpportunities =
        remaining === "unlimited" ? newOpportunities : newOpportunities.slice(0, remaining);
      const upsertTargets = [...existingOpportunities, ...creatableOpportunities];

      if (upsertTargets.length > 0) {
        await prisma.$transaction(
          upsertTargets.map((item) =>
            prisma.xEngagementOpportunity.upsert({
              where: { userId_tweetId: { userId: user.id, tweetId: item.tweetId } },
              update: {
                text: item.text,
                authorXUserId: item.authorXUserId,
                authorUsername: item.authorUsername,
                authorName: item.authorName,
                authorAvatar: item.authorAvatar,
                likes: item.likes,
                retweets: item.retweets,
                replies: item.replies,
                impressions: item.impressions,
                score: item.score,
                niche: item.niche,
                xCreatedAt: item.xCreatedAt,
                lastSeenAt: item.lastSeenAt,
              },
              create: {
                ...item,
                status: "new",
              },
            })
          )
        );
      }

      if (creatableOpportunities.length > 0) {
        await incrementUsage(user.id, "engagement_opp", creatableOpportunities.length);
      }
    }

    const baseWhereClause = {
      userId: user.id,
      niche: effectiveNiche,
      ...(minScore > 0 ? { score: { gte: minScore } } : {}),
      ...(q
        ? {
            OR: [
              { text: { contains: q, mode: "insensitive" as const } },
              { authorUsername: { contains: q, mode: "insensitive" as const } },
              { authorName: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const whereClause = {
      ...baseWhereClause,
      ...(statusFilter ? { status: statusFilter } : {}),
    };
    const orderBy =
      sortBy === "recent"
        ? [{ lastSeenAt: "desc" as const }, { createdAt: "desc" as const }]
        : sortBy === "engagement"
          ? [
              { replies: "desc" as const },
              { retweets: "desc" as const },
              { likes: "desc" as const },
              { lastSeenAt: "desc" as const },
            ]
          : [{ score: "desc" as const }, { lastSeenAt: "desc" as const }, { createdAt: "desc" as const }];

    const [total, rows, grouped] = await Promise.all([
      prisma.xEngagementOpportunity.count({ where: whereClause }),
      prisma.xEngagementOpportunity.findMany({
        where: whereClause,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.xEngagementOpportunity.groupBy({
        by: ["status"],
        where: baseWhereClause,
        _count: { _all: true },
      }),
    ]);

    const counts = {
      all: grouped.reduce((sum, g) => sum + g._count._all, 0),
      new: grouped.find((g) => g.status === "new")?._count._all ?? 0,
      saved: grouped.find((g) => g.status === "saved")?._count._all ?? 0,
      replied: grouped.find((g) => g.status === "replied")?._count._all ?? 0,
      ignored: grouped.find((g) => g.status === "ignored")?._count._all ?? 0,
    };

    const payload = {
      niche: effectiveNiche,
      sortBy,
      minScore,
      q,
      counts,
      conversations: rows.map((row) => ({
        id: row.id,
        tweetId: row.tweetId,
        text: row.text,
        authorUsername: row.authorUsername,
        authorName: row.authorName,
        authorAvatar: row.authorAvatar,
        score: row.score,
        status: row.status,
        replyCount: row.replyCount,
        metrics: {
          like_count: row.likes,
          retweet_count: row.retweets,
          reply_count: row.replies,
          impression_count: row.impressions,
        },
        createdAt: row.xCreatedAt.toISOString(),
      })),
      paging: {
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total,
      },
    };
    if (!refresh) {
      engagementQueryCache.set(cacheKey, {
        data: payload,
        expiresAt: Date.now() + ENGAGEMENT_CACHE_TTL_MS,
      });
    }
    return respond(payload, 200, { cache: refresh ? "refresh" : "miss" });
  } catch (error) {
    console.error("[SnipRadar Engagement] GET error:", error);
    if (cacheKey && isDbPoolSaturationError(error)) {
      const stale = engagementQueryCache.get(cacheKey);
      if (stale?.data) {
        return respond(stale.data, 200, { cache: "stale-fallback", degraded: true });
      }
      return respond(
        { error: "Database busy, retry shortly" },
        503,
        { error: "DB_POOL_SATURATED", degraded: true }
      );
    }
    const response = NextResponse.json({ error: "Failed to find conversations" }, { status: 500 });
    attachServerTiming(response, "snipradar_engagement_get", requestStartedAt);
    logSnipRadarApiTelemetry({
      route: "/api/snipradar/engagement",
      method: "GET",
      status: 500,
      durationMs: Date.now() - requestStartedAt,
      meta: { error: "GET_FAILED" },
    });
    return response;
  }
}

/**
 * POST /api/snipradar/engagement
 * Generate AI reply suggestions for a tweet
 * Body: { tweetText: string, authorUsername: string, niche: string, opportunityId?: string, tweetId?: string }
 */
export async function POST(req: NextRequest) {
  const requestStartedAt = Date.now();
  try {
    const user = await getCurrentUser();
    const respond = (
      body: unknown,
      status = 200,
      meta?: Record<string, unknown>
    ) => {
      const response = NextResponse.json(body, { status });
      attachServerTiming(response, "snipradar_engagement_reply", requestStartedAt);
      logSnipRadarApiTelemetry({
        route: "/api/snipradar/engagement",
        method: "POST",
        status,
        durationMs: Date.now() - requestStartedAt,
        userId: user?.id,
        meta,
      });
      return response;
    };
    if (!user) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const engagementGate = await requireSnipRadarFeature(
      user.id,
      "engagementFinder",
      "Engagement Finder is available on Plus and Pro plans."
    );
    if (!engagementGate.ok) {
      return engagementGate.response;
    }

    const body = await req.json();
    const { tweetText, authorUsername, niche, opportunityId, tweetId } = body as {
      tweetText: string;
      authorUsername: string;
      niche: string;
      opportunityId?: string;
      tweetId?: string;
    };

    if (!tweetText) {
      return respond({ error: "Tweet text is required" }, 400);
    }

    if (!ENGAGEMENT_REPLY_TARGET.client || !ENGAGEMENT_REPLY_TARGET.model) {
      return respond({ error: "AI not configured" }, 503);
    }

    const response = await ENGAGEMENT_REPLY_TARGET.client.chat.completions.create({
      model: ENGAGEMENT_REPLY_TARGET.model,
      messages: [
        {
          role: "system",
          content: `You are an expert at writing engaging X replies that add genuine value.

Rules:
1. Be specific and useful
2. Avoid generic praise
3. Keep each reply <=280 chars
4. Give 3 different angles: insight, question, practical tip

Return JSON object: { "replies": ["reply1", "reply2", "reply3"] }`,
        },
        {
          role: "user",
          content: `Tweet by @${authorUsername}: "${tweetText}"\nNiche: ${niche}\n\nGenerate 3 value-adding reply options.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return respond({ error: "AI returned empty response" }, 500);
    }

    let replies: string[] = [];
    try {
      const parsed = JSON.parse(content);
      replies = (parsed.replies ?? Object.values(parsed)) as string[];
    } catch {
      return respond({ error: "Failed to parse AI response" }, 500);
    }

    if (opportunityId) {
      await prisma.xEngagementOpportunity.updateMany({
        where: { id: opportunityId, userId: user.id },
        data: {
          status: "saved",
          replyCount: { increment: 1 },
          lastSeenAt: new Date(),
        },
      });
    } else if (tweetId) {
      await prisma.xEngagementOpportunity.updateMany({
        where: { tweetId, userId: user.id },
        data: {
          status: "saved",
          replyCount: { increment: 1 },
          lastSeenAt: new Date(),
        },
      });
    }

    return respond({
      replies: replies.slice(0, 3).map((r) => String(r).slice(0, 280)),
    });
  } catch (error: any) {
    if (error?.message?.startsWith("RATE_LIMIT:")) {
      const response = NextResponse.json(
        { error: "AI rate limit reached. Try again in a few minutes." },
        { status: 429 }
      );
      attachServerTiming(response, "snipradar_engagement_reply", requestStartedAt);
      logSnipRadarApiTelemetry({
        route: "/api/snipradar/engagement",
        method: "POST",
        status: 429,
        durationMs: Date.now() - requestStartedAt,
        meta: { error: "AI_RATE_LIMIT" },
      });
      return response;
    }
    console.error("[SnipRadar Engagement] POST error:", error);
    const response = NextResponse.json({ error: "Failed to generate replies" }, { status: 500 });
    attachServerTiming(response, "snipradar_engagement_reply", requestStartedAt);
    logSnipRadarApiTelemetry({
      route: "/api/snipradar/engagement",
      method: "POST",
      status: 500,
      durationMs: Date.now() - requestStartedAt,
      meta: { error: "POST_FAILED" },
    });
    return response;
  }
}
