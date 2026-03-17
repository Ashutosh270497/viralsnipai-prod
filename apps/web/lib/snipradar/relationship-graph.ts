import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  buildRelationshipInteractionSummary,
  buildRelationshipPriorityScore,
  defaultLeadNextAction,
  mergeRelationshipStage,
  normalizeRelationshipHandle,
  normalizeRelationshipTags,
  stageFromOpportunityStatus,
  type RelationshipInteractionType,
  type RelationshipLeadStage,
} from "@/lib/snipradar/relationships";

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

type UpsertLeadParams = {
  userId: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  xUserId?: string | null;
  trackedAccountId?: string | null;
  followerCount?: number | null;
  source: string;
  stage?: RelationshipLeadStage;
  stageMode?: "merge" | "force";
  nextAction?: string | null;
  followUpAt?: Date | null;
  notes?: string | null;
  tags?: string[];
  savedOpportunityDelta?: number;
  replyDelta?: number;
  inboxCaptureDelta?: number;
  markTracked?: boolean;
};

type RecordInteractionParams = {
  userId: string;
  leadId: string;
  type: RelationshipInteractionType;
  summary: string;
  content?: string | null;
  trackedAccountId?: string | null;
  opportunityId?: string | null;
  inboxItemId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function upsertRelationshipLead(params: UpsertLeadParams) {
  const normalizedHandle = normalizeRelationshipHandle(params.username);
  if (!normalizedHandle) {
    return null;
  }

  const existing = await prisma.xRelationshipLead.findUnique({
    where: {
      userId_normalizedHandle: {
        userId: params.userId,
        normalizedHandle,
      },
    },
  });

  const stage =
    params.stageMode === "force"
      ? params.stage ?? (existing?.stage as RelationshipLeadStage | undefined) ?? "new"
      : mergeRelationshipStage(
          (existing?.stage as RelationshipLeadStage | undefined) ?? "new",
          params.stage ?? null
        );

  const savedOpportunityCount = Math.max(
    0,
    (existing?.savedOpportunityCount ?? 0) + (params.savedOpportunityDelta ?? 0)
  );
  const replyCount = Math.max(0, (existing?.replyCount ?? 0) + (params.replyDelta ?? 0));
  const inboxCaptureCount = Math.max(
    0,
    (existing?.inboxCaptureCount ?? 0) + (params.inboxCaptureDelta ?? 0)
  );
  const followerCount =
    params.followerCount ?? existing?.followerCount ?? null;
  const tracked = Boolean(params.markTracked || params.trackedAccountId || existing?.trackedAccountId);
  const followUpAt =
    params.followUpAt !== undefined
      ? params.followUpAt
      : existing?.followUpAt ?? (stage === "follow_up" ? addDays(2) : null);
  const nextAction =
    params.nextAction !== undefined
      ? params.nextAction
      : existing?.nextAction ?? defaultLeadNextAction(stage);
  const notes =
    params.notes !== undefined ? params.notes : existing?.notes ?? null;
  const personaTags = normalizeRelationshipTags([...(existing?.personaTags ?? []), ...(params.tags ?? [])]);
  const priorityScore = buildRelationshipPriorityScore({
    stage,
    followerCount,
    savedOpportunityCount,
    replyCount,
    inboxCaptureCount,
    tracked,
    dueFollowUp: Boolean(followUpAt && followUpAt.getTime() <= Date.now()),
  });
  const now = new Date();

  if (existing) {
    return prisma.xRelationshipLead.update({
      where: { id: existing.id },
      data: {
        trackedAccountId: params.trackedAccountId ?? existing.trackedAccountId,
        xUserId: params.xUserId ?? existing.xUserId,
        username: params.username.replace(/^@/, ""),
        displayName: params.displayName ?? existing.displayName,
        avatarUrl: params.avatarUrl ?? existing.avatarUrl,
        followerCount,
        stage,
        source: existing.source || params.source,
        personaTags,
        notes,
        nextAction,
        followUpAt,
        priorityScore,
        savedOpportunityCount,
        replyCount,
        inboxCaptureCount,
        trackedAt:
          params.markTracked && !existing.trackedAt ? now : existing.trackedAt,
        lastInteractionAt: now,
        lastReplyAt:
          (params.replyDelta ?? 0) > 0 ? now : existing.lastReplyAt,
      },
    });
  }

  return prisma.xRelationshipLead.create({
    data: {
      userId: params.userId,
      trackedAccountId: params.trackedAccountId ?? null,
      xUserId: params.xUserId ?? null,
      username: params.username.replace(/^@/, ""),
      normalizedHandle,
      displayName: params.displayName ?? null,
      avatarUrl: params.avatarUrl ?? null,
      followerCount,
      stage,
      source: params.source,
      personaTags,
      notes,
      nextAction,
      followUpAt,
      priorityScore,
      savedOpportunityCount,
      replyCount,
      inboxCaptureCount,
      trackedAt: params.markTracked ? now : null,
      lastInteractionAt: now,
      lastReplyAt: (params.replyDelta ?? 0) > 0 ? now : null,
    },
  });
}

export async function recordRelationshipInteraction(params: RecordInteractionParams) {
  const metadata =
    params.metadata !== undefined
      ? (params.metadata as Prisma.InputJsonValue)
      : Prisma.JsonNull;

  return prisma.xRelationshipInteraction.create({
    data: {
      userId: params.userId,
      leadId: params.leadId,
      trackedAccountId: params.trackedAccountId ?? null,
      opportunityId: params.opportunityId ?? null,
      inboxItemId: params.inboxItemId ?? null,
      type: params.type,
      summary: params.summary,
      content: params.content ?? null,
      metadata,
    },
  });
}

export async function syncLeadFromOpportunity(params: {
  userId: string;
  opportunity: {
    id: string;
    tweetId: string;
    authorXUserId?: string | null;
    authorUsername: string;
    authorName: string;
    authorAvatar?: string | null;
    status: string;
    score: number;
    text: string;
  };
}) {
  const stage = stageFromOpportunityStatus(params.opportunity.status);
  if (stage === "new") {
    return null;
  }

  const lead = await upsertRelationshipLead({
    userId: params.userId,
    username: params.opportunity.authorUsername,
    displayName: params.opportunity.authorName,
    avatarUrl: params.opportunity.authorAvatar ?? null,
    xUserId: params.opportunity.authorXUserId ?? null,
    source: "engagement",
    stage,
    savedOpportunityDelta: params.opportunity.status === "saved" ? 1 : 0,
    replyDelta: params.opportunity.status === "replied" ? 1 : 0,
    nextAction:
      params.opportunity.status === "replied"
        ? "Check whether this conversation converts into a follow-up or profile visit."
        : undefined,
    followUpAt: params.opportunity.status === "replied" ? addDays(2) : undefined,
  });

  if (!lead) return null;

  await recordRelationshipInteraction({
    userId: params.userId,
    leadId: lead.id,
    opportunityId: params.opportunity.id,
    type: params.opportunity.status === "replied" ? "opportunity_replied" : "opportunity_saved",
    summary: buildRelationshipInteractionSummary({
      type: params.opportunity.status === "replied" ? "opportunity_replied" : "opportunity_saved",
      username: params.opportunity.authorUsername,
      text: params.opportunity.text,
    }),
    content: params.opportunity.text,
    metadata: {
      tweetId: params.opportunity.tweetId,
      opportunityScore: params.opportunity.score,
    },
  });

  return lead;
}

export async function syncLeadFromInboxReply(params: {
  userId: string;
  item: {
    id: string;
    authorUsername: string | null;
    authorDisplayName: string | null;
    authorAvatarUrl: string | null;
    trackedAccountId: string | null;
    text: string | null;
    generatedReply: string | null;
  };
}) {
  if (!params.item.authorUsername) {
    return null;
  }

  const lead = await upsertRelationshipLead({
    userId: params.userId,
    username: params.item.authorUsername,
    displayName: params.item.authorDisplayName,
    avatarUrl: params.item.authorAvatarUrl,
    trackedAccountId: params.item.trackedAccountId,
    source: "extension_reply",
    stage: "follow_up",
    replyDelta: 1,
    nextAction: "Send the drafted reply, then check for a response in your next engagement block.",
    followUpAt: addDays(2),
  });

  if (!lead) return null;

  await recordRelationshipInteraction({
    userId: params.userId,
    leadId: lead.id,
    inboxItemId: params.item.id,
    trackedAccountId: params.item.trackedAccountId,
    type: "reply_generated",
    summary: buildRelationshipInteractionSummary({
      type: "reply_generated",
      username: params.item.authorUsername,
      text: params.item.text,
    }),
    content: params.item.generatedReply,
    metadata: {
      sourceText: params.item.text,
    },
  });

  return lead;
}

export async function syncLeadFromTrackedAccount(params: {
  userId: string;
  trackedAccount: {
    id: string;
    trackedXUserId: string;
    trackedUsername: string;
    trackedDisplayName: string;
    profileImageUrl: string | null;
    followerCount: number;
    niche: string | null;
  };
  inboxItemId?: string | null;
}) {
  const lead = await upsertRelationshipLead({
    userId: params.userId,
    username: params.trackedAccount.trackedUsername,
    displayName: params.trackedAccount.trackedDisplayName,
    avatarUrl: params.trackedAccount.profileImageUrl,
    xUserId: params.trackedAccount.trackedXUserId,
    trackedAccountId: params.trackedAccount.id,
    followerCount: params.trackedAccount.followerCount,
    source: "tracked_account",
    stage: "priority",
    markTracked: true,
    tags: params.trackedAccount.niche ? [params.trackedAccount.niche] : [],
    nextAction: "Engage on their next relevant post and watch for reciprocity.",
  });

  if (!lead) return null;

  await recordRelationshipInteraction({
    userId: params.userId,
    leadId: lead.id,
    trackedAccountId: params.trackedAccount.id,
    inboxItemId: params.inboxItemId ?? null,
    type: "author_tracked",
    summary: buildRelationshipInteractionSummary({
      type: "author_tracked",
      username: params.trackedAccount.trackedUsername,
    }),
    metadata: {
      followerCount: params.trackedAccount.followerCount,
      niche: params.trackedAccount.niche,
    },
  });

  return lead;
}

export async function backfillRelationshipGraph(userId: string) {
  const [trackedAccounts, opportunities, inboxReplies] = await Promise.all([
    prisma.xTrackedAccount.findMany({
      where: {
        userId,
        isActive: true,
        relationshipLead: { is: null },
      },
      select: {
        id: true,
        trackedXUserId: true,
        trackedUsername: true,
        trackedDisplayName: true,
        profileImageUrl: true,
        followerCount: true,
        niche: true,
      },
      take: 40,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.xEngagementOpportunity.findMany({
      where: {
        userId,
        status: { in: ["saved", "replied"] },
        relationshipInteractions: { none: {} },
      },
      select: {
        id: true,
        tweetId: true,
        authorXUserId: true,
        authorUsername: true,
        authorName: true,
        authorAvatar: true,
        status: true,
        score: true,
        text: true,
      },
      take: 60,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.xResearchInboxItem.findMany({
      where: {
        userId,
        authorUsername: { not: null },
        generatedReply: { not: null },
        relationshipInteractions: {
          none: {
            type: "reply_generated",
          },
        },
      },
      select: {
        id: true,
        authorUsername: true,
        authorDisplayName: true,
        authorAvatarUrl: true,
        trackedAccountId: true,
        text: true,
        generatedReply: true,
      },
      take: 60,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  await Promise.allSettled([
    ...trackedAccounts.map((trackedAccount) =>
      syncLeadFromTrackedAccount({
        userId,
        trackedAccount: {
          id: trackedAccount.id,
          trackedXUserId: trackedAccount.trackedXUserId,
          trackedUsername: trackedAccount.trackedUsername,
          trackedDisplayName: trackedAccount.trackedDisplayName,
          profileImageUrl: trackedAccount.profileImageUrl ?? null,
          followerCount: trackedAccount.followerCount,
          niche: trackedAccount.niche ?? null,
        },
      })
    ),
    ...opportunities.map((opportunity) =>
      syncLeadFromOpportunity({
        userId,
        opportunity: {
          id: opportunity.id,
          tweetId: opportunity.tweetId,
          authorXUserId: opportunity.authorXUserId ?? null,
          authorUsername: opportunity.authorUsername,
          authorName: opportunity.authorName,
          authorAvatar: opportunity.authorAvatar ?? null,
          status: opportunity.status,
          score: opportunity.score,
          text: opportunity.text,
        },
      })
    ),
    ...inboxReplies.map((item) =>
      syncLeadFromInboxReply({
        userId,
        item: {
          id: item.id,
          authorUsername: item.authorUsername,
          authorDisplayName: item.authorDisplayName,
          authorAvatarUrl: item.authorAvatarUrl,
          trackedAccountId: item.trackedAccountId,
          text: item.text,
          generatedReply: item.generatedReply,
        },
      })
    ),
  ]);
}
