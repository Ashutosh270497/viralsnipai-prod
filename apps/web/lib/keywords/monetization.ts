import { prisma } from "@/lib/prisma";

export type KeywordPlanTier = "free" | "starter" | "creator" | "studio";
export type KeywordFeatureKey = "searches" | "recommendations" | "savedKeywords";

type KeywordLimitValue = number | typeof Infinity;

function getEnvLimit(name: string, fallback: KeywordLimitValue): KeywordLimitValue {
  const raw = process.env[name];
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "inf" || normalized === "infinity" || normalized === "-1") {
    return Infinity;
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const KEYWORD_PLAN_LIMITS: Record<KeywordPlanTier, Record<KeywordFeatureKey, KeywordLimitValue>> = {
  free: {
    searches: getEnvLimit("KEYWORD_LIMIT_FREE_SEARCHES", 40),
    recommendations: getEnvLimit("KEYWORD_LIMIT_FREE_RECOMMENDATIONS", 12),
    savedKeywords: getEnvLimit("KEYWORD_LIMIT_FREE_SAVED", 75),
  },
  starter: {
    searches: getEnvLimit("KEYWORD_LIMIT_STARTER_SEARCHES", 600),
    recommendations: getEnvLimit("KEYWORD_LIMIT_STARTER_RECOMMENDATIONS", 160),
    savedKeywords: getEnvLimit("KEYWORD_LIMIT_STARTER_SAVED", 1500),
  },
  creator: {
    searches: getEnvLimit("KEYWORD_LIMIT_CREATOR_SEARCHES", Infinity),
    recommendations: getEnvLimit("KEYWORD_LIMIT_CREATOR_RECOMMENDATIONS", Infinity),
    savedKeywords: getEnvLimit("KEYWORD_LIMIT_CREATOR_SAVED", Infinity),
  },
  studio: {
    searches: getEnvLimit("KEYWORD_LIMIT_STUDIO_SEARCHES", Infinity),
    recommendations: getEnvLimit("KEYWORD_LIMIT_STUDIO_RECOMMENDATIONS", Infinity),
    savedKeywords: getEnvLimit("KEYWORD_LIMIT_STUDIO_SAVED", Infinity),
  },
};

const USAGE_LOG_FEATURE_MAP: Record<Exclude<KeywordFeatureKey, "savedKeywords">, string> = {
  searches: "keyword_search",
  recommendations: "keyword_recommendation",
};

export interface KeywordQuotaCheck {
  tier: KeywordPlanTier;
  feature: KeywordFeatureKey;
  limit: number;
  used: number;
  remaining: number | null;
  unlimited: boolean;
  allowed: boolean;
}

export interface KeywordUsageSnapshot {
  tier: KeywordPlanTier;
  period: {
    startsAt: string;
    endsAt: string;
  };
  features: Record<KeywordFeatureKey, Omit<KeywordQuotaCheck, "feature" | "allowed">>;
}

function monthWindow(date = new Date()) {
  const startsAt = new Date(date);
  startsAt.setDate(1);
  startsAt.setHours(0, 0, 0, 0);

  const endsAt = new Date(startsAt);
  endsAt.setMonth(endsAt.getMonth() + 1);

  return { startsAt, endsAt };
}

function normalizeTier(value?: string | null): KeywordPlanTier {
  const normalized = (value ?? "free").toLowerCase();
  if (normalized === "starter") return "starter";
  if (normalized === "creator") return "creator";
  if (normalized === "studio") return "studio";
  return "free";
}

function serializeLimit(limit: KeywordLimitValue): number {
  return limit === Infinity ? -1 : limit;
}

function buildQuotaCheck(params: {
  tier: KeywordPlanTier;
  feature: KeywordFeatureKey;
  used: number;
}): KeywordQuotaCheck {
  const rawLimit = KEYWORD_PLAN_LIMITS[params.tier][params.feature];
  const unlimited = rawLimit === Infinity;
  const numericLimit = serializeLimit(rawLimit);
  const remaining = unlimited ? null : Math.max(0, numericLimit - params.used);

  return {
    tier: params.tier,
    feature: params.feature,
    limit: numericLimit,
    used: params.used,
    remaining,
    unlimited,
    allowed: unlimited ? true : params.used < numericLimit,
  };
}

async function getUserTier(userId: string): Promise<KeywordPlanTier> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, subscriptionTier: true },
  });
  return normalizeTier(user?.subscriptionTier || user?.plan || "free");
}

export async function checkKeywordQuota(
  userId: string,
  feature: KeywordFeatureKey,
): Promise<KeywordQuotaCheck> {
  const tier = await getUserTier(userId);

  if (feature === "savedKeywords") {
    const used = (prisma as any).savedKeyword
      ? await prisma.savedKeyword.count({ where: { userId } })
      : 0;
    return buildQuotaCheck({ tier, feature, used });
  }

  const { startsAt } = monthWindow();
  const usageFeature = USAGE_LOG_FEATURE_MAP[feature];
  const used = await prisma.usageLog.count({
    where: {
      userId,
      feature: usageFeature,
      createdAt: { gte: startsAt },
    },
  });
  return buildQuotaCheck({ tier, feature, used });
}

export async function recordKeywordUsage(
  userId: string,
  feature: Exclude<KeywordFeatureKey, "savedKeywords">,
  metadata?: Record<string, unknown>,
) {
  await prisma.usageLog.create({
    data: {
      userId,
      feature: USAGE_LOG_FEATURE_MAP[feature],
      creditsUsed: 1,
      metadata: {
        domain: "keyword_research",
        ...metadata,
      },
    },
  });
}

export async function buildKeywordUsageSnapshot(userId: string): Promise<KeywordUsageSnapshot> {
  const tier = await getUserTier(userId);
  const { startsAt, endsAt } = monthWindow();
  const [searchesUsed, recommendationsUsed, savedKeywordsUsed] = await Promise.all([
    prisma.usageLog.count({
      where: {
        userId,
        feature: USAGE_LOG_FEATURE_MAP.searches,
        createdAt: { gte: startsAt },
      },
    }),
    prisma.usageLog.count({
      where: {
        userId,
        feature: USAGE_LOG_FEATURE_MAP.recommendations,
        createdAt: { gte: startsAt },
      },
    }),
    (prisma as any).savedKeyword
      ? prisma.savedKeyword.count({ where: { userId } })
      : Promise.resolve(0),
  ]);

  const searches = buildQuotaCheck({ tier, feature: "searches", used: searchesUsed });
  const recommendations = buildQuotaCheck({
    tier,
    feature: "recommendations",
    used: recommendationsUsed,
  });
  const savedKeywords = buildQuotaCheck({
    tier,
    feature: "savedKeywords",
    used: savedKeywordsUsed,
  });

  return {
    tier,
    period: {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    },
    features: {
      searches: {
        tier: searches.tier,
        limit: searches.limit,
        used: searches.used,
        remaining: searches.remaining,
        unlimited: searches.unlimited,
      },
      recommendations: {
        tier: recommendations.tier,
        limit: recommendations.limit,
        used: recommendations.used,
        remaining: recommendations.remaining,
        unlimited: recommendations.unlimited,
      },
      savedKeywords: {
        tier: savedKeywords.tier,
        limit: savedKeywords.limit,
        used: savedKeywords.used,
        remaining: savedKeywords.remaining,
        unlimited: savedKeywords.unlimited,
      },
    },
  };
}

export function projectUsageAfterConsume(quota: KeywordQuotaCheck, consumed = 1) {
  if (quota.unlimited) {
    return {
      ...quota,
      used: quota.used + consumed,
      remaining: null,
      allowed: true,
    };
  }
  const used = quota.used + consumed;
  return {
    ...quota,
    used,
    remaining: Math.max(0, quota.limit - used),
    allowed: used <= quota.limit,
  };
}
