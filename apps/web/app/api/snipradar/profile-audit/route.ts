export const dynamic = "force-dynamic";

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getCurrentDbUser } from "@/lib/auth";
import { generateProfileAuditInsights } from "@/lib/ai/profile-audit";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import { getTweetById, lookupUserById } from "@/lib/integrations/x-api";
import { prisma } from "@/lib/prisma";
import {
  buildProfileAudit,
  buildProfileAuditFingerprint,
  buildProfileAuditHistory,
  restoreProfileAuditFromSnapshot,
} from "@/lib/snipradar/profile-audit";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";
import { emitSnipRadarWebhookEvent } from "@/lib/snipradar/webhooks";
import { getUserTweetsWithAutoRefresh } from "@/lib/snipradar/x-auth";

const AUDIT_CACHE_TTL_MS = 30 * 60_000;
const AUDIT_SNAPSHOT_REUSE_MS = 30 * 60_000;
const AUDIT_SNAPSHOT_DEDUPE_MS = 12 * 60 * 60_000;
const AUDIT_HISTORY_LIMIT = 8;
const profileAuditCache = new Map<string, { data: unknown; expiresAt: number }>();

function buildFallbackAiInsight(audit: ReturnType<typeof buildProfileAudit>) {
  const strongest = audit.pillars
    .slice()
    .sort((a, b) => b.score / b.maxScore - a.score / a.maxScore)[0];
  const weakest = audit.pillars
    .slice()
    .sort((a, b) => a.score / a.maxScore - b.score / b.maxScore)[0];

  return {
    source: "heuristic_fallback" as const,
    executiveSummary: audit.summary,
    positioningAssessment:
      audit.pillars.find((pillar) => pillar.id === "positioning")?.summary ??
      "Positioning needs refinement.",
    conversionAssessment:
      audit.pillars.find((pillar) => pillar.id === "profile")?.summary ??
      "Profile conversion setup needs refinement.",
    contentAssessment:
      audit.pillars.find((pillar) => pillar.id === "cadence")?.summary ??
      "Content consistency needs refinement.",
    strengths: strongest ? [strongest.summary] : [],
    risks: weakest ? weakest.recommendations.slice(0, 2) : audit.quickWins.slice(0, 2),
    priorityFixes: audit.quickWins.slice(0, 4),
    bioRewrites: [],
    pinnedTweetAssessment: audit.stats.hasPinnedTweet
      ? "Pinned tweet detected. Refresh after AI is configured for a full pinned tweet critique."
      : "No pinned tweet detected. Add one to improve profile conversion.",
    pinnedTweetRecommendation: {
      headline: "Pin a proof-led authority post",
      bullets: [
        "Open with a sharp opinion, lesson, or proof point.",
        "Show why your angle is worth following.",
        "End with a clear CTA for the right audience.",
      ],
      cta: "Follow for more high-signal posts.",
      rationale: "A pinned post should convert profile visits into follows or outbound action.",
    },
    contentPillars: ["Opinions", "Tactical breakdowns", "Proof and case studies"],
    next7DaysPlan: audit.quickWins.slice(0, 5),
  };
}

function buildPayload(params: {
  audit: ReturnType<typeof buildProfileAudit>;
  auth?: {
    reauthRequired: boolean;
    message: string | null;
    refreshedToken: boolean;
  } | null;
  xUsername: string;
  sampleCount: number;
  pinnedTweetId: string | null;
  historyRows: Array<{
    id: string;
    score: number;
    grade: string;
    confidence: string;
    createdAt: Date;
    pillars: unknown;
  }>;
  generatedAt: Date;
  snapshotId: string | null;
  snapshotSource: "db_cache" | "db_persisted" | "live";
}) {
  const historyPoints = buildProfileAuditHistory(params.historyRows);
  const latestDelta =
    historyPoints.length >= 2
      ? historyPoints[historyPoints.length - 1]?.deltaFromPrevious ?? null
      : null;

  return {
    audit: params.audit,
    auth:
      params.auth ??
      {
        reauthRequired: false,
        message: null,
        refreshedToken: false,
      },
    history: {
      points: historyPoints,
      latestDelta,
      bestScore: historyPoints.length
        ? Math.max(...historyPoints.map((point) => point.score))
        : null,
      snapshotCount: historyPoints.length,
    },
    meta: {
      xUsername: params.xUsername,
      generatedAt: params.generatedAt.toISOString(),
      sampleCount: params.sampleCount,
      pinnedTweetId: params.pinnedTweetId,
      snapshotId: params.snapshotId,
      snapshotSource: params.snapshotSource,
    },
  };
}

function isRecent(date: Date, maxAgeMs: number) {
  return Date.now() - date.getTime() < maxAgeMs;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const refresh = request.nextUrl.searchParams.get("refresh") === "true";

    const cached = profileAuditCache.get(user.id);
    if (!refresh && cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(cached.data);
    }

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, isActive: true },
      select: {
        id: true,
        xUserId: true,
        xUsername: true,
        accessToken: true,
        refreshToken: true,
        tokenExpiresAt: true,
      },
    });

    if (!xAccount) {
      return NextResponse.json(
        {
          audit: null,
          auth: null,
          history: { points: [], latestDelta: null, bestScore: null, snapshotCount: 0 },
          message: "Connect your X account to run a profile audit.",
        },
        { status: 200 }
      );
    }

    const historyRows = await prisma.xProfileAuditSnapshot.findMany({
      where: {
        userId: user.id,
        xAccountId: xAccount.id,
      },
      select: {
        id: true,
        score: true,
        grade: true,
        confidence: true,
        headline: true,
        summary: true,
        quickWins: true,
        stats: true,
        pillars: true,
        ai: true,
        fingerprint: true,
        createdAt: true,
        xUsername: true,
      },
      orderBy: { createdAt: "desc" },
      take: AUDIT_HISTORY_LIMIT,
    });

    const latestSnapshot = historyRows[0] ?? null;
    if (!refresh && latestSnapshot && isRecent(latestSnapshot.createdAt, AUDIT_SNAPSHOT_REUSE_MS)) {
      const audit = restoreProfileAuditFromSnapshot({
        score: latestSnapshot.score,
        grade: latestSnapshot.grade,
        confidence: latestSnapshot.confidence,
        headline: latestSnapshot.headline,
        summary: latestSnapshot.summary,
        quickWins: latestSnapshot.quickWins,
        stats: latestSnapshot.stats,
        pillars: latestSnapshot.pillars,
        ai: latestSnapshot.ai,
      });

      const payload = buildPayload({
        audit,
        xUsername: latestSnapshot.xUsername,
        sampleCount: 0,
        pinnedTweetId: null,
        historyRows: historyRows.slice().reverse(),
        generatedAt: latestSnapshot.createdAt,
        snapshotId: latestSnapshot.id,
        snapshotSource: "db_cache",
      });

      profileAuditCache.set(user.id, {
        data: payload,
        expiresAt: Date.now() + AUDIT_CACHE_TTL_MS,
      });

      return NextResponse.json(payload);
    }

    const rateLimit = consumeSnipRadarRateLimit("snipradar:profile-audit", user.id, [
      {
        name: "burst",
        windowMs: SNIPRADAR.AI_RATE_LIMIT_BURST_WINDOW_MS,
        maxHits: Math.max(2, Math.floor(SNIPRADAR.AI_RATE_LIMIT_BURST_MAX_REQUESTS / 2)),
      },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before generating another AI profile audit." },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const [profile, tweetResult] = await Promise.all([
      lookupUserById(xAccount.xUserId),
      getUserTweetsWithAutoRefresh({
        account: {
          id: xAccount.id,
          xUserId: xAccount.xUserId,
          xUsername: xAccount.xUsername,
          accessToken: xAccount.accessToken,
          refreshToken: xAccount.refreshToken,
          tokenExpiresAt: xAccount.tokenExpiresAt,
        },
        maxResults: 40,
        startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        includeReplies: true,
      }),
    ]);

    if (!profile) {
      return NextResponse.json({ error: "Failed to load X profile for audit." }, { status: 502 });
    }

    const pinnedTweet = profile.pinned_tweet_id ? await getTweetById(profile.pinned_tweet_id) : null;

    const heuristicAudit = buildProfileAudit({
      profile,
      tweets: tweetResult.response.data ?? [],
      selectedNiche: user.selectedNiche ?? null,
    });
    const aiInsights =
      (await generateProfileAuditInsights({
        profile,
        tweets: tweetResult.response.data ?? [],
        pinnedTweet,
        heuristic: heuristicAudit,
        selectedNiche: user.selectedNiche ?? null,
      })) ?? buildFallbackAiInsight(heuristicAudit);

    const audit = {
      ...heuristicAudit,
      ai: aiInsights,
    };
    const fingerprint = createHash("sha256")
      .update(buildProfileAuditFingerprint(audit))
      .digest("hex");

    let persistedSnapshot = latestSnapshot;
    if (
      !latestSnapshot ||
      latestSnapshot.fingerprint !== fingerprint ||
      !isRecent(latestSnapshot.createdAt, AUDIT_SNAPSHOT_DEDUPE_MS)
    ) {
      persistedSnapshot = await prisma.xProfileAuditSnapshot.create({
        data: {
          userId: user.id,
          xAccountId: xAccount.id,
          xUserId: xAccount.xUserId,
          xUsername: xAccount.xUsername,
          score: audit.score,
          grade: audit.grade,
          confidence: audit.confidence,
          headline: audit.headline,
          summary: audit.summary,
          quickWins: audit.quickWins,
          stats: audit.stats,
          pillars: audit.pillars as unknown as Prisma.InputJsonValue,
          ai: (audit.ai ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
          fingerprint,
        },
        select: {
          id: true,
          score: true,
          grade: true,
          confidence: true,
          headline: true,
          summary: true,
          quickWins: true,
          stats: true,
          pillars: true,
          ai: true,
          fingerprint: true,
          createdAt: true,
          xUsername: true,
        },
      });
    }

    const persistedHistoryRows = await prisma.xProfileAuditSnapshot.findMany({
      where: {
        userId: user.id,
        xAccountId: xAccount.id,
      },
      select: {
        id: true,
        score: true,
        grade: true,
        confidence: true,
        createdAt: true,
        pillars: true,
      },
      orderBy: { createdAt: "desc" },
      take: AUDIT_HISTORY_LIMIT,
    });

    if (persistedSnapshot && persistedSnapshot.id !== latestSnapshot?.id) {
      const previousScore = latestSnapshot?.score ?? null;
      await emitSnipRadarWebhookEvent({
        userId: user.id,
        eventType: "profile_audit.score_updated",
        resourceType: "profile_audit_snapshot",
        resourceId: persistedSnapshot.id,
        payload: {
          snapshotId: persistedSnapshot.id,
          xUsername: xAccount.xUsername,
          score: audit.score,
          grade: audit.grade,
          previousScore,
          delta: previousScore === null ? null : audit.score - previousScore,
          generatedAt: persistedSnapshot.createdAt.toISOString(),
          origin: "profile_audit",
        },
      });
    }

    const payload = buildPayload({
      audit,
      auth: {
        reauthRequired: tweetResult.reauthRequired,
        message: tweetResult.authMessage,
        refreshedToken: tweetResult.refreshedToken,
      },
      xUsername: xAccount.xUsername,
      sampleCount: tweetResult.response.data?.length ?? 0,
      pinnedTweetId: profile.pinned_tweet_id ?? null,
      historyRows: persistedHistoryRows.slice().reverse(),
      generatedAt: persistedSnapshot?.createdAt ?? new Date(),
      snapshotId: persistedSnapshot?.id ?? null,
      snapshotSource: persistedSnapshot?.id === latestSnapshot?.id ? "live" : "db_persisted",
    });

    profileAuditCache.set(user.id, {
      data: payload,
      expiresAt: Date.now() + AUDIT_CACHE_TTL_MS,
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("RATE_LIMIT:")) {
      return NextResponse.json({ error: "AI rate limit reached. Try again in a few minutes." }, { status: 429 });
    }
    console.error("[SnipRadar Profile Audit] GET error:", error);
    return NextResponse.json({ error: "Failed to generate profile audit" }, { status: 500 });
  }
}
