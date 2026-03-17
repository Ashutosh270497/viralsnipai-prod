import { recordActivationCheckpointSafe } from "@/lib/analytics/activation";
import { getCurrentSubscriptionState } from "@/lib/billing";
import { lookupUser } from "@/lib/integrations/x-api";
import { prisma } from "@/lib/prisma";
import { getSnipRadarStarterNiche } from "@/lib/snipradar/starter-accounts";

export async function seedStarterTrackedAccountsForUser(params: {
  userId: string;
  xAccountId: string;
  selectedNiche?: string | null;
  maxSeed?: number;
}) {
  const maxSeed = params.maxSeed ?? 5;
  const starterNiche = getSnipRadarStarterNiche(params.selectedNiche);

  const [existingCount, subscriptionState] = await Promise.all([
    prisma.xTrackedAccount.count({
      where: { userId: params.userId, xAccountId: params.xAccountId, isActive: true },
    }),
    getCurrentSubscriptionState(params.userId),
  ]);

  if (existingCount > 0) {
    return {
      seeded: 0,
      attempted: 0,
      niche: starterNiche.label,
      reason: "existing_accounts" as const,
    };
  }

  const accountLimit = subscriptionState.limits.trackedAccounts;
  const remaining =
    accountLimit === "unlimited"
      ? maxSeed
      : Math.max(0, Number(accountLimit) - existingCount);

  if (remaining <= 0) {
    return {
      seeded: 0,
      attempted: 0,
      niche: starterNiche.label,
      reason: "plan_limit" as const,
    };
  }

  const handles = starterNiche.handles.slice(0, Math.min(maxSeed, remaining));
  let seeded = 0;

  for (const handle of handles) {
    try {
      const xUser = await lookupUser(handle);
      if (!xUser) {
        continue;
      }

      const existing = await prisma.xTrackedAccount.findUnique({
        where: {
          userId_trackedXUserId: {
            userId: params.userId,
            trackedXUserId: xUser.id,
          },
        },
      });

      if (existing) {
        if (!existing.isActive) {
          await prisma.xTrackedAccount.update({
            where: { id: existing.id },
            data: {
              xAccountId: params.xAccountId,
              isActive: true,
              niche: starterNiche.label,
              trackedUsername: xUser.username,
              trackedDisplayName: xUser.name,
              profileImageUrl: xUser.profile_image_url ?? null,
              followerCount: xUser.public_metrics?.followers_count ?? 0,
            },
          });
        }
        seeded += 1;
        continue;
      }

      await prisma.xTrackedAccount.create({
        data: {
          userId: params.userId,
          xAccountId: params.xAccountId,
          trackedXUserId: xUser.id,
          trackedUsername: xUser.username,
          trackedDisplayName: xUser.name,
          profileImageUrl: xUser.profile_image_url ?? null,
          followerCount: xUser.public_metrics?.followers_count ?? 0,
          niche: starterNiche.label,
        },
      });
      seeded += 1;
    } catch (error) {
      console.warn("[SnipRadar Starter Seeding] Failed to seed tracked account", {
        userId: params.userId,
        handle,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (seeded > 0) {
    await recordActivationCheckpointSafe({
      userId: params.userId,
      checkpoint: "snipradar_first_tracked_account_added",
      metadata: {
        source: "starter_seed",
        selectedNiche: params.selectedNiche ?? starterNiche.label,
        seeded,
      },
    });
  }

  return {
    seeded,
    attempted: handles.length,
    niche: starterNiche.label,
    reason: "seeded" as const,
  };
}
