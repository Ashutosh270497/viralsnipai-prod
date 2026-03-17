export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDefaultKeywordResearchOrchestrator } from "@/lib/keywords/keyword-research-orchestrator";
import { getKeywordSearchQueue } from "@/lib/keywords/search-queue";

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

function isAuthorizedMachineCall(req: NextRequest): boolean {
  const secret = process.env.KEYWORD_MAINTENANCE_CRON_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return provided === secret;
}

/**
 * POST /api/keywords/maintenance/refresh
 * Refreshes stale keyword records with fresh demand/trend/competition signals.
 * - User call: refreshes only current user's stale keyword records.
 * - Machine call (secret): can refresh globally or for a specific `?userId=...`.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const machineCall = isAuthorizedMachineCall(req);
    const session = machineCall ? null : await getServerSession(authOptions);
    if (!machineCall && !session?.user?.id) {
      const unauthorized = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      unauthorized.headers.set("Cache-Control", "no-store");
      unauthorized.headers.set("Server-Timing", `keywords_refresh;dur=${Date.now() - startedAt}`);
      return unauthorized;
    }

    if (!(prisma as any).keywordResearch) {
      const unavailable = NextResponse.json(
        { error: "Keyword research storage is unavailable." },
        { status: 503 },
      );
      unavailable.headers.set("Cache-Control", "no-store");
      unavailable.headers.set("Server-Timing", `keywords_refresh;dur=${Date.now() - startedAt}`);
      return unavailable;
    }

    const params = req.nextUrl.searchParams;
    const userId = machineCall ? (params.get("userId") ?? undefined) : session!.user!.id;
    const staleHours = clampInt(
      Number(params.get("staleHours") ?? getEnvInt("KEYWORD_HOT_REFRESH_STALE_HOURS", 18, 1, 168)),
      1,
      168,
    );
    const maxRecords = clampInt(
      Number(params.get("limit") ?? getEnvInt("KEYWORD_HOT_REFRESH_MAX_RECORDS", 12, 1, 200)),
      1,
      200,
    );
    const workerCount = clampInt(
      Number(params.get("workers") ?? getEnvInt("KEYWORD_HOT_REFRESH_WORKERS", 2, 1, 8)),
      1,
      8,
    );
    const country = (params.get("country") ?? process.env.KEYWORD_DEFAULT_COUNTRY ?? "IN")
      .trim()
      .toUpperCase();
    const language = (params.get("language") ?? process.env.KEYWORD_DEFAULT_LANGUAGE ?? "en")
      .trim()
      .toLowerCase();

    const staleThreshold = new Date(Date.now() - staleHours * 60 * 60 * 1000);
    const where = {
      ...(userId ? { userId } : {}),
      lastUpdated: { lt: staleThreshold },
    };

    const targets = await prisma.keywordResearch.findMany({
      where,
      orderBy: [{ lastUpdated: "asc" }, { updatedAt: "asc" }],
      take: maxRecords,
      select: {
        id: true,
        userId: true,
        keyword: true,
      },
    });

    if (targets.length === 0) {
      const response = NextResponse.json({
        refreshed: 0,
        failed: 0,
        scanned: 0,
        message: "No stale keyword records found for refresh.",
      });
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Server-Timing", `keywords_refresh;dur=${Date.now() - startedAt}`);
      return response;
    }

    const queue = getKeywordSearchQueue();
    const orchestrator = createDefaultKeywordResearchOrchestrator();
    const results: Array<{
      id: string;
      keyword: string;
      ok: boolean;
      queueWaitMs: number;
      researchDurationMs: number;
      error?: string;
    }> = [];

    let nextIndex = 0;
    const executeWorker = async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= targets.length) break;
        const target = targets[index];

        try {
          const queueResult = await queue.execute(() =>
            orchestrator.research(
              {
                keyword: target.keyword,
                country,
                language,
              },
              { allowMockFallback: process.env.NODE_ENV !== "production" },
            ),
          );

          await prisma.keywordResearch.update({
            where: { id: target.id },
            data: {
              searchVolume: queueResult.value.searchVolume,
              competition: queueResult.value.competition.score,
              difficulty: queueResult.value.competition.difficulty,
              trendDirection: queueResult.value.trendDirection,
              avgViews: queueResult.value.metrics.avgViews,
              avgLikes: queueResult.value.metrics.avgLikes,
              avgComments: queueResult.value.metrics.avgComments,
              estimatedCPM: queueResult.value.estimatedCPM,
              relatedKeywords: queueResult.value.relatedKeywords,
              topVideos: queueResult.value.topVideos,
              searchIntent: queueResult.value.searchIntent,
              lastUpdated: new Date(),
            },
          });

          results.push({
            id: target.id,
            keyword: target.keyword,
            ok: true,
            queueWaitMs: queueResult.queueWaitMs,
            researchDurationMs: queueResult.runDurationMs,
          });
        } catch (error) {
          results.push({
            id: target.id,
            keyword: target.keyword,
            ok: false,
            queueWaitMs: 0,
            researchDurationMs: 0,
            error: error instanceof Error ? error.message : "unknown_error",
          });
        }
      }
    };

    const poolSize = Math.min(workerCount, targets.length);
    await Promise.all(Array.from({ length: poolSize }, () => executeWorker()));

    const refreshed = results.filter((result) => result.ok).length;
    const failed = results.length - refreshed;
    const avgQueueWaitMs =
      refreshed > 0
        ? Math.round(
            (results
              .filter((result) => result.ok)
              .reduce((sum, result) => sum + result.queueWaitMs, 0) /
              refreshed) *
              100,
          ) / 100
        : 0;

    const response = NextResponse.json({
      refreshed,
      failed,
      scanned: targets.length,
      staleHours,
      country,
      language,
      avgQueueWaitMs,
      durationMs: Date.now() - startedAt,
      queue: queue.getStats(),
      failures:
        failed > 0
          ? results
              .filter((result) => !result.ok)
              .map((result) => ({
                keyword: result.keyword,
                error: result.error,
              }))
          : [],
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Server-Timing", `keywords_refresh;dur=${Date.now() - startedAt}`);
    return response;
  } catch (error) {
    console.error("[Keywords Maintenance] refresh error:", error);
    const response = NextResponse.json(
      { error: "Failed to refresh keyword cache." },
      { status: 500 },
    );
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Server-Timing", `keywords_refresh;dur=${Date.now() - startedAt}`);
    return response;
  }
}
