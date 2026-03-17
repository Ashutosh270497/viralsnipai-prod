export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { backfillRelationshipGraph } from "@/lib/snipradar/relationship-graph";
import {
  RELATIONSHIP_LEAD_STAGES,
  type RelationshipLeadStage,
} from "@/lib/snipradar/relationships";

function serializeLead(lead: {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  followerCount: number | null;
  stage: string;
  source: string;
  personaTags: string[];
  notes: string | null;
  nextAction: string | null;
  followUpAt: Date | null;
  priorityScore: number;
  savedOpportunityCount: number;
  replyCount: number;
  inboxCaptureCount: number;
  trackedAt: Date | null;
  lastInteractionAt: Date | null;
  lastReplyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  trackedAccount: {
    id: string;
    trackedUsername: string;
    trackedDisplayName: string;
    followerCount: number;
    niche: string | null;
  } | null;
  interactions: Array<{
    id: string;
    type: string;
    summary: string;
    content: string | null;
    metadata: unknown;
    createdAt: Date;
  }>;
}) {
  return {
    id: lead.id,
    username: lead.username,
    displayName: lead.displayName,
    avatarUrl: lead.avatarUrl,
    followerCount: lead.followerCount,
    stage: lead.stage,
    source: lead.source,
    personaTags: lead.personaTags,
    notes: lead.notes,
    nextAction: lead.nextAction,
    followUpAt: lead.followUpAt?.toISOString() ?? null,
    priorityScore: lead.priorityScore,
    savedOpportunityCount: lead.savedOpportunityCount,
    replyCount: lead.replyCount,
    inboxCaptureCount: lead.inboxCaptureCount,
    trackedAt: lead.trackedAt?.toISOString() ?? null,
    lastInteractionAt: lead.lastInteractionAt?.toISOString() ?? null,
    lastReplyAt: lead.lastReplyAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    trackedAccount: lead.trackedAccount
      ? {
          id: lead.trackedAccount.id,
          trackedUsername: lead.trackedAccount.trackedUsername,
          trackedDisplayName: lead.trackedAccount.trackedDisplayName,
          followerCount: lead.trackedAccount.followerCount,
          niche: lead.trackedAccount.niche,
        }
      : null,
    interactions: lead.interactions.map((interaction) => ({
      id: interaction.id,
      type: interaction.type,
      summary: interaction.summary,
      content: interaction.content,
      metadata: interaction.metadata,
      createdAt: interaction.createdAt.toISOString(),
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await backfillRelationshipGraph(user.id);

    const stageParam = request.nextUrl.searchParams.get("stage") ?? "all";
    const stageFilter = RELATIONSHIP_LEAD_STAGES.includes(stageParam as RelationshipLeadStage)
      ? (stageParam as RelationshipLeadStage)
      : null;
    const dueOnly = request.nextUrl.searchParams.get("due") === "true";
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
    const limit = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get("limit") ?? 30)));

    const where = {
      userId: user.id,
      ...(stageFilter ? { stage: stageFilter } : {}),
      ...(dueOnly
        ? {
            followUpAt: { lte: new Date() },
            ...(stageFilter ? {} : { stage: { not: "closed" } }),
          }
        : {}),
      ...(q
        ? {
            OR: [
              { username: { contains: q, mode: "insensitive" as const } },
              { displayName: { contains: q, mode: "insensitive" as const } },
              { notes: { contains: q, mode: "insensitive" as const } },
              { nextAction: { contains: q, mode: "insensitive" as const } },
              { personaTags: { has: q.toLowerCase() } },
            ],
          }
        : {}),
    };

    const [leads, stageCounts, totalLeads, dueFollowUps, priorityLeads, repliesThisWeek] =
      await Promise.all([
        prisma.xRelationshipLead.findMany({
          where,
          orderBy: [
            { priorityScore: "desc" },
            { followUpAt: "asc" },
            { lastInteractionAt: "desc" },
          ],
          take: limit,
          include: {
            trackedAccount: {
              select: {
                id: true,
                trackedUsername: true,
                trackedDisplayName: true,
                followerCount: true,
                niche: true,
              },
            },
            interactions: {
              orderBy: { createdAt: "desc" },
              take: 6,
              select: {
                id: true,
                type: true,
                summary: true,
                content: true,
                metadata: true,
                createdAt: true,
              },
            },
          },
        }),
        prisma.xRelationshipLead.groupBy({
          by: ["stage"],
          where: { userId: user.id },
          _count: { _all: true },
        }),
        prisma.xRelationshipLead.count({ where: { userId: user.id } }),
        prisma.xRelationshipLead.count({
          where: {
            userId: user.id,
            stage: { not: "closed" },
            followUpAt: { lte: new Date() },
          },
        }),
        prisma.xRelationshipLead.count({
          where: {
            userId: user.id,
            stage: { in: ["priority", "follow_up"] },
          },
        }),
        prisma.xRelationshipInteraction.count({
          where: {
            userId: user.id,
            type: { in: ["reply_generated", "opportunity_replied"] },
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

    return NextResponse.json({
      summary: {
        totalLeads,
        dueFollowUps,
        priorityLeads,
        repliesThisWeek,
        stageCounts: stageCounts.reduce<Record<string, number>>((acc, item) => {
          acc[item.stage] = item._count._all;
          return acc;
        }, {}),
      },
      leads: leads.map(serializeLead),
    });
  } catch (error) {
    console.error("[SnipRadar Relationships] GET error:", error);
    return NextResponse.json({ error: "Failed to load relationship graph" }, { status: 500 });
  }
}
