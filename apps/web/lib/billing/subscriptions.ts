import "server-only";

import { cookies } from "next/headers";
import { Prisma, type Subscription, type UsageTracking, type User } from "@prisma/client";
import { nanoid } from "nanoid";

import {
  BILLING_PLANS,
  getBillingPlan,
  getPublicBillingPlan,
  resolveBillingPlanId,
  serializePublicPlanCatalog,
} from "@/config/plans";
import { prisma } from "@/lib/prisma";
import type {
  BillingFeatureName,
  BillingPlanId,
  BillingPromoDefinition,
  BillingRegion,
  BillingSubscriptionRecord,
  BillingSubscriptionState,
  BillingUsageAction,
  BillingUsageCheckResult,
  BillingUsageSnapshot,
  SubscriptionStatus,
} from "@/types/billing";

const REFERRAL_COOKIE_NAME = "vsai_ref";

type BootstrapOptions = {
  host?: string | null;
  country?: string | null;
  locale?: string | null;
};

type LegacyBillingUserSeed = {
  plan: string | null;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  billingProvider: string | null;
  subscriptionCurrentStart: Date | null;
  subscriptionCurrentEnd: Date | null;
  subscriptionCancelAtPeriodEnd: boolean;
  razorpayCustomerId: string | null;
  razorpaySubscriptionId: string | null;
  stripeCustomerId: string | null;
};

type PromoConfig = BillingPromoDefinition & {
  razorpayOfferId?: string | null;
};

const PROMO_DEFINITIONS: Record<string, PromoConfig> = {
  EARLY50: {
    code: "EARLY50",
    description: "50% off Plus forever for the first 50 upgrades.",
    planIds: ["plus"],
    type: "percent_forever",
    percentOff: 50,
    maxRedemptions: 50,
    razorpayOfferId: process.env.RAZORPAY_OFFER_ID_EARLY50 ?? null,
  },
  LAUNCH30: {
    code: "LAUNCH30",
    description: "30% off the first 3 months.",
    planIds: ["plus", "pro"],
    type: "percent_months",
    percentOff: 30,
    months: 3,
    razorpayOfferId: process.env.RAZORPAY_OFFER_ID_LAUNCH30 ?? null,
  },
};

const LEGACY_PLAN_MAPPING: Record<BillingPlanId, { plan: string; subscriptionTier: string }> = {
  free: { plan: "free", subscriptionTier: "free" },
  plus: { plan: "creator", subscriptionTier: "creator" },
  pro: { plan: "studio", subscriptionTier: "studio" },
};

function currentMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeStatus(value: string | null | undefined): SubscriptionStatus {
  if (value === "paused" || value === "cancelled" || value === "pending" || value === "trialing") {
    return value;
  }
  return "active";
}

function inferProvider(subscription: Pick<
  Subscription,
  "planId" | "billingRegion" | "razorpaySubscriptionId"
>) {
  if (resolveBillingPlanId(subscription.planId) === "free") return "free" as const;
  return "razorpay" as const;
}

function readReferralCookie() {
  try {
    return cookies().get(REFERRAL_COOKIE_NAME)?.value?.trim().toUpperCase() ?? null;
  } catch {
    return null;
  }
}

async function ensureReferralCode(user: Pick<User, "id" | "referralCode">) {
  if (user.referralCode) {
    return user.referralCode;
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = nanoid(8).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (!code) continue;
    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      return updated.referralCode ?? code;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to assign a unique referral code.");
}

async function attachPendingReferral(user: Pick<User, "id" | "referralCode" | "referredBy">) {
  if (user.referredBy) return user.referredBy;
  const code = readReferralCookie();
  if (!code || code === user.referralCode) return null;

  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true, referralCode: true },
  });
  if (!referrer || referrer.id === user.id) {
    return null;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { referredBy: referrer.referralCode },
  });

  return referrer.referralCode;
}

export function detectBillingRegion(input?: {
  country?: string | null;
  locale?: string | null;
  host?: string | null;
}): BillingRegion {
  const country = input?.country?.toUpperCase();
  if (country === "IN") return "IN";

  const host = input?.host?.toLowerCase() ?? "";
  if (host.endsWith(".in")) return "IN";

  const locale = input?.locale?.toLowerCase() ?? "";
  if (locale.startsWith("en-in") || locale.endsWith("-in")) return "IN";

  return "GLOBAL";
}

export function getPlanLimits(planId: BillingPlanId) {
  return getBillingPlan(planId).limits;
}

function inferLegacyBillingRegion(user: LegacyBillingUserSeed, options?: BootstrapOptions): BillingRegion {
  if (user.billingProvider?.toLowerCase() === "stripe" || user.stripeCustomerId) {
    return "GLOBAL";
  }
  return detectBillingRegion(options);
}

function deriveBootstrapSubscriptionData(user: LegacyBillingUserSeed, options?: BootstrapOptions) {
  const planId = resolveBillingPlanId(user.subscriptionTier || user.plan || "free");
  return {
    planId,
    status: normalizeStatus(user.subscriptionStatus),
    billingRegion: inferLegacyBillingRegion(user, options),
    razorpayCustomerId: user.razorpayCustomerId ?? null,
    razorpaySubscriptionId: user.razorpaySubscriptionId ?? null,
    stripeCustomerId: user.stripeCustomerId ?? null,
    currentPeriodStart: user.subscriptionCurrentStart ?? null,
    currentPeriodEnd: user.subscriptionCurrentEnd ?? null,
    cancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd,
  } as const;
}

export async function ensureSubscriptionBootstrap(
  userId: string,
  options?: BootstrapOptions,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      subscriptionTier: true,
      subscriptionStatus: true,
      billingProvider: true,
      billingCycle: true,
      subscriptionCurrentStart: true,
      subscriptionCurrentEnd: true,
      subscriptionCancelAtPeriodEnd: true,
      razorpayCustomerId: true,
      razorpaySubscriptionId: true,
      stripeCustomerId: true,
      referralCode: true,
      referredBy: true,
    },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  const referralCode = await ensureReferralCode(user);
  const referredBy = await attachPendingReferral({
    id: user.id,
    referralCode,
    referredBy: user.referredBy,
  });

  const legacySeed = deriveBootstrapSubscriptionData(user, options);
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  const subscription = existingSubscription
    ? await prisma.subscription.update({
        where: { userId },
        data: {
          ...(existingSubscription.planId !== legacySeed.planId ? { planId: legacySeed.planId } : {}),
          ...(existingSubscription.status !== legacySeed.status ? { status: legacySeed.status } : {}),
          ...(existingSubscription.billingRegion !== legacySeed.billingRegion
            ? { billingRegion: legacySeed.billingRegion }
            : {}),
          ...(!existingSubscription.razorpayCustomerId && legacySeed.razorpayCustomerId
            ? { razorpayCustomerId: legacySeed.razorpayCustomerId }
            : {}),
          ...(!existingSubscription.razorpaySubscriptionId && legacySeed.razorpaySubscriptionId
            ? { razorpaySubscriptionId: legacySeed.razorpaySubscriptionId }
            : {}),
          ...(!existingSubscription.stripeCustomerId && legacySeed.stripeCustomerId
            ? { stripeCustomerId: legacySeed.stripeCustomerId }
            : {}),
          ...(!existingSubscription.stripeSubscriptionId && legacySeed.stripeSubscriptionId
            ? { stripeSubscriptionId: legacySeed.stripeSubscriptionId }
            : {}),
          ...(!existingSubscription.currentPeriodStart && legacySeed.currentPeriodStart
            ? { currentPeriodStart: legacySeed.currentPeriodStart }
            : {}),
          ...(!existingSubscription.currentPeriodEnd && legacySeed.currentPeriodEnd
            ? { currentPeriodEnd: legacySeed.currentPeriodEnd }
            : {}),
          ...(existingSubscription.cancelAtPeriodEnd !== legacySeed.cancelAtPeriodEnd
            ? { cancelAtPeriodEnd: legacySeed.cancelAtPeriodEnd }
            : {}),
        },
      })
    : await prisma.subscription.create({
        data: {
          userId,
          planId: legacySeed.planId,
          status: legacySeed.status,
          billingRegion: legacySeed.billingRegion,
          razorpayCustomerId: legacySeed.razorpayCustomerId,
          razorpaySubscriptionId: legacySeed.razorpaySubscriptionId,
          stripeCustomerId: legacySeed.stripeCustomerId,
          stripeSubscriptionId: legacySeed.stripeSubscriptionId,
          currentPeriodStart: legacySeed.currentPeriodStart,
          currentPeriodEnd: legacySeed.currentPeriodEnd,
          cancelAtPeriodEnd: legacySeed.cancelAtPeriodEnd,
        },
      });

  await syncLegacySubscriptionFields(userId, subscription);

  return {
    subscription,
    referralCode,
    referredBy: referredBy ?? user.referredBy ?? null,
  };
}

export async function syncLegacySubscriptionFields(
  userId: string,
  subscription: Pick<
    Subscription,
    | "planId"
    | "status"
    | "billingRegion"
    | "razorpayCustomerId"
    | "razorpaySubscriptionId"
    | "stripeCustomerId"
    | "stripeSubscriptionId"
    | "currentPeriodStart"
    | "currentPeriodEnd"
    | "cancelAtPeriodEnd"
  >,
) {
  const planId = resolveBillingPlanId(subscription.planId);
  const mapped = LEGACY_PLAN_MAPPING[planId];
  return prisma.user.update({
    where: { id: userId },
    data: {
      plan: mapped.plan,
      subscriptionTier: mapped.subscriptionTier,
      subscriptionStatus: subscription.status,
      billingProvider: inferProvider(subscription),
      razorpayCustomerId: subscription.razorpayCustomerId ?? null,
      razorpaySubscriptionId: subscription.razorpaySubscriptionId ?? null,
      stripeCustomerId: subscription.stripeCustomerId ?? null,
      stripeCustomerIdLegacy: undefined,
      billingCycle: "monthly",
      subscriptionCurrentStart: subscription.currentPeriodStart ?? null,
      subscriptionCurrentEnd: subscription.currentPeriodEnd ?? null,
      subscriptionCancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    } as Prisma.UserUpdateInput,
  });
}

function serializeSubscriptionRecord(
  subscription: Subscription,
): BillingSubscriptionRecord {
  return {
    id: subscription.id,
    userId: subscription.userId,
    planId: resolveBillingPlanId(subscription.planId),
    status: normalizeStatus(subscription.status),
    billingRegion: subscription.billingRegion === "GLOBAL" ? "GLOBAL" : "IN",
    razorpaySubscriptionId: subscription.razorpaySubscriptionId ?? null,
    razorpayCustomerId: subscription.razorpayCustomerId ?? null,
    currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    promoCode: subscription.promoCode ?? null,
    freeMonthsCredit: subscription.freeMonthsCredit,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  };
}

async function ensureUsageTracking(userId: string, month = currentMonthKey()) {
  return prisma.usageTracking.upsert({
    where: {
      userId_month: {
        userId,
        month,
      },
    },
    update: {},
    create: {
      userId,
      month,
    },
  });
}

function buildUsageSnapshot(params: {
  trackedAccounts: number;
  connectedXAccounts: number;
  activeDrafts: number;
  usage: UsageTracking;
  planId: BillingPlanId;
}): BillingUsageSnapshot {
  return {
    trackedAccounts: params.trackedAccounts,
    connectedXAccounts: params.connectedXAccounts,
    drafts: params.activeDrafts,
    viralFeedFetches: params.usage.viralFetches,
    hookGenerations: params.usage.hookGenerations,
    scheduledPosts: params.usage.scheduledPosts,
    engagementOpps: params.usage.engagementOpps,
    templatesUnlocked: getPlanLimits(params.planId).templates === "unlimited"
      ? 96
      : Number(getPlanLimits(params.planId).templates),
  };
}

export async function getCurrentSubscriptionState(
  userId: string,
  options?: BootstrapOptions,
): Promise<BillingSubscriptionState> {
  const bootstrap = await ensureSubscriptionBootstrap(userId, options);
  const [subscription, usage, userMeta, trackedAccounts, connectedXAccounts, activeDrafts] =
    await Promise.all([
      prisma.subscription.findUniqueOrThrow({ where: { userId } }),
      ensureUsageTracking(userId),
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          referralCode: true,
          referredBy: true,
        },
      }),
      prisma.xTrackedAccount.count({
        where: { userId, isActive: true },
      }),
      prisma.xAccount.count({
        where: { userId, isActive: true },
      }),
      prisma.tweetDraft.count({
        where: {
          userId,
          status: {
            in: ["draft", "scheduled"],
          },
        },
      }),
    ]);

  const planId = resolveBillingPlanId(subscription.planId);
  const usageSnapshot = buildUsageSnapshot({
    trackedAccounts,
    connectedXAccounts,
    activeDrafts,
    usage,
    planId,
  });

  return {
    plan: getPublicBillingPlan(planId),
    status: normalizeStatus(subscription.status),
    billingRegion: subscription.billingRegion === "GLOBAL" ? "GLOBAL" : "IN",
    limits: getBillingPlan(planId).limits,
    usage: usageSnapshot,
    periodStart: subscription.currentPeriodStart?.toISOString() ?? null,
    periodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    recommendedRegion: detectBillingRegion(options),
    freeMonthsCredit: subscription.freeMonthsCredit,
    promoCode: subscription.promoCode ?? null,
    referralCode: bootstrap.referralCode ?? userMeta.referralCode ?? null,
    referredBy: bootstrap.referredBy ?? userMeta.referredBy ?? null,
    currentProvider: inferProvider(subscription),
    plans: serializePublicPlanCatalog(),
  };
}

export async function updateSubscriptionRecord(
  userId: string,
  data: Prisma.SubscriptionUncheckedUpdateInput,
) {
  const subscription = await prisma.subscription.upsert({
    where: { userId },
    update: data,
    create: {
      userId,
      planId: "free",
      status: "active",
      billingRegion: "IN",
      ...(data as Prisma.SubscriptionUncheckedCreateInput),
    },
  });
  await syncLegacySubscriptionFields(userId, subscription);
  return serializeSubscriptionRecord(subscription);
}

export async function checkUsageLimit(
  userId: string,
  action: BillingUsageAction,
  amount = 1,
): Promise<BillingUsageCheckResult> {
  const state = await getCurrentSubscriptionState(userId);
  const limits = state.limits;
  const usage = state.usage;

  const evaluate = (limitValue: number | "unlimited", used: number) => {
    if (limitValue === "unlimited") {
      return { allowed: true, remaining: "unlimited" as const };
    }
    const remaining = Math.max(0, limitValue - used);
    return {
      allowed: remaining >= amount,
      remaining,
    };
  };

  switch (action) {
    case "viral_fetch":
      return evaluate(limits.viralFeedFetches, usage.viralFeedFetches);
    case "hook_gen":
      return evaluate(limits.hookGenerations, usage.hookGenerations);
    case "scheduled_post":
      if (limits.scheduling === false) {
        return { allowed: false, remaining: 0 };
      }
      return evaluate(limits.scheduling.monthlyPosts, usage.scheduledPosts);
    case "engagement_opp":
      if (limits.engagementFinder === false) {
        return { allowed: false, remaining: 0 };
      }
      return evaluate(limits.engagementFinder.monthlyOpportunities, usage.engagementOpps);
    default:
      return { allowed: true, remaining: "unlimited" };
  }
}

export async function incrementUsage(userId: string, action: BillingUsageAction, amount = 1) {
  const month = currentMonthKey();
  await ensureUsageTracking(userId, month);
  const data: Prisma.UsageTrackingUpdateInput =
    action === "viral_fetch"
      ? { viralFetches: { increment: amount } }
      : action === "hook_gen"
        ? { hookGenerations: { increment: amount } }
        : action === "scheduled_post"
          ? { scheduledPosts: { increment: amount } }
          : { engagementOpps: { increment: amount } };

  return prisma.usageTracking.update({
    where: { userId_month: { userId, month } },
    data,
  });
}

export function canAccessFeature(
  planId: BillingPlanId,
  featureName: BillingFeatureName,
) {
  const limits = getPlanLimits(planId);
  switch (featureName) {
    case "tracker":
      return limits.trackedAccounts !== 0;
    case "viralFeed":
      return limits.viralFeedFetches !== 0;
    case "drafts":
      return limits.drafts !== 0;
    case "templates":
      return limits.templates !== 0;
    case "hookGenerations":
      return limits.hookGenerations !== 0;
    case "scheduling":
      return limits.scheduling !== false;
    case "analytics":
      return limits.analytics !== false;
    case "growthPlanAI":
      return limits.growthPlanAI;
    case "variantLab":
      return limits.variantLab;
    case "researchCopilot":
      return limits.researchCopilot;
    case "engagementFinder":
      return limits.engagementFinder !== false;
    case "relationships":
      return limits.relationships;
    case "activityCenterPriority":
      return limits.activityCenterPriority;
    case "whitelabelExports":
      return limits.whitelabelExports;
    default:
      return false;
  }
}

export async function checkTrackedAccountLimit(userId: string) {
  const state = await getCurrentSubscriptionState(userId);
  const limit = state.limits.trackedAccounts;
  if (limit === "unlimited") return { allowed: true, remaining: "unlimited" as const };
  const remaining = Math.max(0, Number(limit) - state.usage.trackedAccounts);
  return { allowed: remaining > 0, remaining };
}

export async function redeemReferralUpgradeCredit(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      referredBy: true,
      referralCreditGrantedAt: true,
    },
  });
  if (!user?.referredBy || user.referralCreditGrantedAt) return;

  const referrer = await prisma.user.findUnique({
    where: { referralCode: user.referredBy },
    select: { id: true },
  });
  if (!referrer) return;

  await ensureSubscriptionBootstrap(referrer.id);
  await prisma.$transaction([
    prisma.subscription.update({
      where: { userId: referrer.id },
      data: {
        freeMonthsCredit: { increment: 1 },
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        referralCreditGrantedAt: new Date(),
      },
    }),
  ]);
}

export async function validatePromoCode(
  code: string,
  planId: BillingPlanId,
) {
  const normalized = code.trim().toUpperCase();
  const promo = PROMO_DEFINITIONS[normalized];
  if (!promo) {
    throw new Error("Promo code is not valid.");
  }
  if (!promo.planIds.includes(planId)) {
    throw new Error("Promo code is not valid for this plan.");
  }
  if (promo.maxRedemptions) {
    const redemptionCount = await prisma.subscription.count({
      where: { promoCode: normalized },
    });
    if (redemptionCount >= promo.maxRedemptions) {
      throw new Error("This promo code has already reached its redemption limit.");
    }
  }
  return promo;
}

export function getPromoDefinition(code: string | null | undefined) {
  if (!code) return null;
  return PROMO_DEFINITIONS[code.trim().toUpperCase()] ?? null;
}

export function getProviderPromoConfig(code: string | null | undefined) {
  const promo = getPromoDefinition(code);
  if (!promo) return null;
  return {
    razorpayOfferId: promo.razorpayOfferId ?? null,
    promo,
  };
}
