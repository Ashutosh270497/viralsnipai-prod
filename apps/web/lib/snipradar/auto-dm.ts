import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { searchRepliesToTweet } from "@/lib/integrations/x-api";
import { sendDirectMessageWithAutoRefresh } from "@/lib/snipradar/x-auth";

const DEFAULT_AUTOMATION_DAILY_CAP = 50;
const MAX_AUTOMATION_DAILY_CAP = 250;
const GLOBAL_SAFE_DAILY_DM_CAP = Math.max(
  25,
  Math.min(250, Number(process.env.SNIPRADAR_AUTO_DM_GLOBAL_DAILY_CAP ?? 250))
);
const DEFAULT_REPLY_FETCH_LIMIT = Math.max(
  10,
  Math.min(100, Number(process.env.SNIPRADAR_AUTO_DM_FETCH_LIMIT ?? 50))
);

type AutomationWithAccount = Awaited<ReturnType<typeof loadAutomations>>[number];

export type AutoDmProcessSource = "api_user" | "api_cron" | "scheduled_poll" | "inngest";

export type AutoDmProcessResult = {
  source: AutoDmProcessSource;
  userId?: string;
  automationsProcessed: number;
  repliesEvaluated: number;
  matchedReplies: number;
  sent: number;
  failed: number;
  rateLimited: number;
  skipped: number;
  needsReconnect: boolean;
  results: Array<{
    automationId: string;
    triggerTweetId: string;
    sent: number;
    failed: number;
    matchedReplies: number;
    skipped: number;
    error?: string | null;
  }>;
};

export type AutoDmAutomationDto = {
  id: string;
  name: string | null;
  triggerTweetId: string;
  triggerTweetUrl: string | null;
  triggerTweetText: string | null;
  keyword: string | null;
  dmTemplate: string;
  dailyCap: number;
  isActive: boolean;
  lastCheckedAt: string | null;
  lastTriggeredAt: string | null;
  lastMatchedReplyAt: string | null;
  lastError: string | null;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
  recentDeliveries: AutoDmDeliveryDto[];
};

export type AutoDmDeliveryDto = {
  id: string;
  sourceReplyTweetId: string;
  recipientXUserId: string;
  recipientUsername: string | null;
  recipientName: string | null;
  replyText: string | null;
  matchedKeyword: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type AutoDmTriggerDraftOption = {
  draftId: string;
  postedTweetId: string;
  text: string;
  postedAt: string | null;
};

type CreateAutoDmAutomationInput = {
  userId: string;
  xAccountId: string;
  triggerTweetId: string;
  triggerTweetUrl?: string | null;
  triggerTweetText?: string | null;
  keyword?: string | null;
  dmTemplate: string;
  dailyCap?: number;
  name?: string | null;
};

type UpdateAutoDmAutomationInput = {
  keyword?: string | null;
  dmTemplate?: string;
  dailyCap?: number;
  isActive?: boolean;
  name?: string | null;
};

function clampDailyCap(value?: number | null) {
  if (!value || !Number.isFinite(value)) return DEFAULT_AUTOMATION_DAILY_CAP;
  return Math.max(1, Math.min(MAX_AUTOMATION_DAILY_CAP, Math.round(value)));
}

export function parseTriggerTweetId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const directMatch = value.match(/^\d{6,30}$/);
  if (directMatch) return directMatch[0];

  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/status\/(\d{6,30})/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function matchesKeyword(keyword: string | null, text: string) {
  if (!keyword) return true;
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function interpolateTemplate(template: string, values: Record<string, string | null | undefined>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

function serializeDelivery(delivery: {
  id: string;
  sourceReplyTweetId: string;
  recipientXUserId: string;
  recipientUsername: string | null;
  recipientName: string | null;
  replyText: string | null;
  matchedKeyword: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
}): AutoDmDeliveryDto {
  return {
    id: delivery.id,
    sourceReplyTweetId: delivery.sourceReplyTweetId,
    recipientXUserId: delivery.recipientXUserId,
    recipientUsername: delivery.recipientUsername,
    recipientName: delivery.recipientName,
    replyText: delivery.replyText,
    matchedKeyword: delivery.matchedKeyword,
    status: delivery.status,
    errorMessage: delivery.errorMessage,
    sentAt: delivery.sentAt?.toISOString() ?? null,
    createdAt: delivery.createdAt.toISOString(),
  };
}

function serializeAutomation(automation: Awaited<ReturnType<typeof listAutoDmAutomationsForUser>>[number]): AutoDmAutomationDto {
  return {
    id: automation.id,
    name: automation.name,
    triggerTweetId: automation.triggerTweetId,
    triggerTweetUrl: automation.triggerTweetUrl,
    triggerTweetText: automation.triggerTweetText,
    keyword: automation.keyword,
    dmTemplate: automation.dmTemplate,
    dailyCap: automation.dailyCap,
    isActive: automation.isActive,
    lastCheckedAt: automation.lastCheckedAt?.toISOString() ?? null,
    lastTriggeredAt: automation.lastTriggeredAt?.toISOString() ?? null,
    lastMatchedReplyAt: automation.lastMatchedReplyAt?.toISOString() ?? null,
    lastError: automation.lastError,
    sentCount: automation.sentCount,
    failedCount: automation.failedCount,
    createdAt: automation.createdAt.toISOString(),
    updatedAt: automation.updatedAt.toISOString(),
    recentDeliveries: automation.deliveries.map(serializeDelivery),
  };
}

export async function listAutoDmAutomationsForUser(userId: string) {
  const automations = await prisma.xAutoDmAutomation.findMany({
    where: { userId },
    include: {
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 12,
      },
    },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
  });

  return automations;
}

export async function listAutoDmTriggerDrafts(userId: string): Promise<AutoDmTriggerDraftOption[]> {
  const drafts = await prisma.tweetDraft.findMany({
    where: {
      userId,
      status: "posted",
      postedTweetId: { not: null },
    },
    select: {
      id: true,
      text: true,
      postedTweetId: true,
      postedAt: true,
    },
    orderBy: { postedAt: "desc" },
    take: 30,
  });

  return drafts.map((draft) => ({
    draftId: draft.id,
    postedTweetId: draft.postedTweetId as string,
    text: draft.text,
    postedAt: draft.postedAt?.toISOString() ?? null,
  }));
}

export async function createAutoDmAutomation(input: CreateAutoDmAutomationInput) {
  const automation = await prisma.xAutoDmAutomation.create({
    data: {
      userId: input.userId,
      xAccountId: input.xAccountId,
      name: input.name?.trim() || null,
      triggerTweetId: input.triggerTweetId,
      triggerTweetUrl: input.triggerTweetUrl ?? null,
      triggerTweetText: input.triggerTweetText ?? null,
      keyword: input.keyword?.trim() || null,
      dmTemplate: input.dmTemplate.trim(),
      dailyCap: clampDailyCap(input.dailyCap),
    },
    include: {
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 12,
      },
    },
  });

  return serializeAutomation(automation);
}

export async function updateAutoDmAutomation(params: {
  id: string;
  userId: string;
  input: UpdateAutoDmAutomationInput;
}) {
  const existing = await prisma.xAutoDmAutomation.findFirst({
    where: { id: params.id, userId: params.userId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Automation not found");
  }

  const automation = await prisma.xAutoDmAutomation.update({
    where: { id: existing.id },
    data: {
      ...(params.input.name !== undefined ? { name: params.input.name?.trim() || null } : {}),
      ...(params.input.keyword !== undefined ? { keyword: params.input.keyword?.trim() || null } : {}),
      ...(params.input.dmTemplate !== undefined ? { dmTemplate: params.input.dmTemplate.trim() } : {}),
      ...(params.input.dailyCap !== undefined ? { dailyCap: clampDailyCap(params.input.dailyCap) } : {}),
      ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
      ...(params.input.isActive === true ? { lastError: null } : {}),
    },
    include: {
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 12,
      },
    },
  });

  return serializeAutomation(automation);
}

export async function deleteAutoDmAutomation(params: { id: string; userId: string }) {
  const existing = await prisma.xAutoDmAutomation.findFirst({
    where: { id: params.id, userId: params.userId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Automation not found");
  }

  await prisma.xAutoDmAutomation.delete({
    where: { id: existing.id },
  });
}

async function loadAutomations(userId?: string) {
  return prisma.xAutoDmAutomation.findMany({
    where: {
      isActive: true,
      ...(userId ? { userId } : {}),
    },
    include: {
      xAccount: {
        select: {
          id: true,
          xUserId: true,
          xUsername: true,
          accessToken: true,
          refreshToken: true,
          tokenExpiresAt: true,
          isActive: true,
        },
      },
    },
    orderBy: { updatedAt: "asc" },
  });
}

async function countSentTodayForAccount(xAccountId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return prisma.xAutoDmDelivery.count({
    where: {
      xAccountId,
      status: "sent",
      createdAt: { gte: startOfDay },
    },
  });
}

async function createDeliveryLog(data: Prisma.XAutoDmDeliveryUncheckedCreateInput) {
  return prisma.xAutoDmDelivery.create({ data });
}

export async function processAutoDmAutomations(params: {
  source: AutoDmProcessSource;
  userId?: string;
}): Promise<AutoDmProcessResult> {
  const automations = await loadAutomations(params.userId);
  const results: AutoDmProcessResult["results"] = [];
  let repliesEvaluated = 0;
  let matchedReplies = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let rateLimited = 0;
  let needsReconnect = false;

  for (const automation of automations) {
    let sentForAutomation = 0;
    let failedForAutomation = 0;
    let matchedForAutomation = 0;
    let skippedForAutomation = 0;
    let lastError: string | null = null;

    if (!automation.xAccount.isActive) {
      results.push({
        automationId: automation.id,
        triggerTweetId: automation.triggerTweetId,
        sent: 0,
        failed: 0,
        matchedReplies: 0,
        skipped: 1,
        error: "Connected X account is inactive.",
      });
      continue;
    }

    let searchResponse;
    try {
      searchResponse = await searchRepliesToTweet({
        tweetId: automation.triggerTweetId,
        ownerUsername: automation.xAccount.xUsername,
        maxResults: DEFAULT_REPLY_FETCH_LIMIT,
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Failed to search replies for this automation.";
      await prisma.xAutoDmAutomation.update({
        where: { id: automation.id },
        data: {
          lastCheckedAt: new Date(),
          lastError,
          failedCount: { increment: 1 },
        },
      });
      failed += 1;
      failedForAutomation += 1;
      results.push({
        automationId: automation.id,
        triggerTweetId: automation.triggerTweetId,
        sent: 0,
        failed: 1,
        matchedReplies: 0,
        skipped: 0,
        error: lastError,
      });
      continue;
    }

    const usersById = new Map(
      (searchResponse.includes?.users ?? []).map((user) => [user.id, user] as const)
    );
    const replies = (searchResponse.data ?? [])
      .filter((tweet) =>
        tweet.referenced_tweets?.some(
          (reference) => reference.type === "replied_to" && reference.id === automation.triggerTweetId
        )
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    repliesEvaluated += replies.length;

    const globalSentToday = await countSentTodayForAccount(automation.xAccountId);
    let accountRemaining = Math.max(0, GLOBAL_SAFE_DAILY_DM_CAP - globalSentToday);

    for (const reply of replies) {
      if (!reply.author_id || reply.author_id === automation.xAccount.xUserId) {
        skipped += 1;
        skippedForAutomation += 1;
        continue;
      }

      const existing = await prisma.xAutoDmDelivery.findUnique({
        where: {
          automationId_recipientXUserId: {
            automationId: automation.id,
            recipientXUserId: reply.author_id,
          },
        },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        skippedForAutomation += 1;
        continue;
      }

      if (!matchesKeyword(automation.keyword, reply.text)) {
        skipped += 1;
        skippedForAutomation += 1;
        continue;
      }

      matchedReplies += 1;
      matchedForAutomation += 1;

      const sentForAutomationToday = sentForAutomation;
      if (accountRemaining <= 0 || sentForAutomationToday >= automation.dailyCap) {
        await createDeliveryLog({
          automationId: automation.id,
          userId: automation.userId,
          xAccountId: automation.xAccountId,
          sourceReplyTweetId: reply.id,
          recipientXUserId: reply.author_id,
          recipientUsername: usersById.get(reply.author_id)?.username ?? null,
          recipientName: usersById.get(reply.author_id)?.name ?? null,
          replyText: reply.text,
          matchedKeyword: automation.keyword ?? null,
          status: "rate_limited",
          errorMessage:
            accountRemaining <= 0
              ? "Global Auto-DM daily safety cap reached."
              : "Automation daily cap reached.",
        });
        rateLimited += 1;
        failed += 1;
        failedForAutomation += 1;
        lastError =
          accountRemaining <= 0
            ? "Global Auto-DM daily safety cap reached."
            : "Automation daily cap reached.";
        continue;
      }

      const recipient = usersById.get(reply.author_id);
      const message = interpolateTemplate(automation.dmTemplate, {
        username: recipient?.username ? `@${recipient.username}` : null,
        displayName: recipient?.name ?? null,
        firstName: recipient?.name?.split(" ")[0] ?? null,
        replyText: reply.text,
        tweetId: automation.triggerTweetId,
      }).trim();

      const dmResult = await sendDirectMessageWithAutoRefresh({
        account: {
          id: automation.xAccount.id,
          xUserId: automation.xAccount.xUserId,
          xUsername: automation.xAccount.xUsername,
          accessToken: automation.xAccount.accessToken,
          refreshToken: automation.xAccount.refreshToken,
          tokenExpiresAt: automation.xAccount.tokenExpiresAt,
        },
        participantId: reply.author_id,
        text: message,
      });

      if (dmResult.reauthRequired) {
        needsReconnect = true;
        lastError = dmResult.authMessage ?? "Reconnect X account required for DMs.";
        await createDeliveryLog({
          automationId: automation.id,
          userId: automation.userId,
          xAccountId: automation.xAccountId,
          sourceReplyTweetId: reply.id,
          recipientXUserId: reply.author_id,
          recipientUsername: recipient?.username ?? null,
          recipientName: recipient?.name ?? null,
          replyText: reply.text,
          matchedKeyword: automation.keyword ?? null,
          status: "oauth_required",
          errorMessage: lastError,
        });
        failed += 1;
        failedForAutomation += 1;
        break;
      }

      if (!dmResult.dmEventId && dmResult.status) {
        lastError = dmResult.authMessage ?? "Failed to send DM.";
        await createDeliveryLog({
          automationId: automation.id,
          userId: automation.userId,
          xAccountId: automation.xAccountId,
          sourceReplyTweetId: reply.id,
          recipientXUserId: reply.author_id,
          recipientUsername: recipient?.username ?? null,
          recipientName: recipient?.name ?? null,
          replyText: reply.text,
          matchedKeyword: automation.keyword ?? null,
          status: "failed",
          errorMessage: lastError,
        });
        failed += 1;
        failedForAutomation += 1;
        continue;
      }

      await createDeliveryLog({
        automationId: automation.id,
        userId: automation.userId,
        xAccountId: automation.xAccountId,
        sourceReplyTweetId: reply.id,
        recipientXUserId: reply.author_id,
        recipientUsername: recipient?.username ?? null,
        recipientName: recipient?.name ?? null,
        replyText: reply.text,
        matchedKeyword: automation.keyword ?? null,
        status: "sent",
        dmEventId: dmResult.dmEventId ?? null,
        sentAt: new Date(),
      });
      sent += 1;
      sentForAutomation += 1;
      accountRemaining -= 1;
    }

    await prisma.xAutoDmAutomation.update({
      where: { id: automation.id },
      data: {
        lastCheckedAt: new Date(),
        ...(matchedForAutomation > 0
          ? {
              lastMatchedReplyAt: replies[replies.length - 1]
                ? new Date(replies[replies.length - 1].created_at)
                : undefined,
            }
          : {}),
        ...(sentForAutomation > 0 ? { lastTriggeredAt: new Date() } : {}),
        lastError,
        sentCount: { increment: sentForAutomation },
        failedCount: { increment: failedForAutomation },
      },
    });

    results.push({
      automationId: automation.id,
      triggerTweetId: automation.triggerTweetId,
      sent: sentForAutomation,
      failed: failedForAutomation,
      matchedReplies: matchedForAutomation,
      skipped: skippedForAutomation,
      error: lastError,
    });
  }

  return {
    source: params.source,
    userId: params.userId,
    automationsProcessed: automations.length,
    repliesEvaluated,
    matchedReplies,
    sent,
    failed,
    rateLimited,
    skipped,
    needsReconnect,
    results,
  };
}

export async function getAutoDmDashboard(userId: string) {
  const [automations, triggerDrafts, xAccount] = await Promise.all([
    listAutoDmAutomationsForUser(userId),
    listAutoDmTriggerDrafts(userId),
    prisma.xAccount.findFirst({
      where: { userId, isActive: true },
      select: {
        id: true,
        xUsername: true,
        xDisplayName: true,
        accessToken: true,
      },
    }),
  ]);

  const sentToday = xAccount ? await countSentTodayForAccount(xAccount.id) : 0;

  return {
    account: xAccount
      ? {
          id: xAccount.id,
          xUsername: xAccount.xUsername,
          xDisplayName: xAccount.xDisplayName,
          requiresReconnectForDm: !xAccount.accessToken || xAccount.accessToken === "bearer-only",
        }
      : null,
    limits: {
      safeDailyCap: GLOBAL_SAFE_DAILY_DM_CAP,
      sentToday,
      remainingToday: xAccount ? Math.max(0, GLOBAL_SAFE_DAILY_DM_CAP - sentToday) : 0,
    },
    triggerDrafts,
    automations: automations.map(serializeAutomation),
  };
}
