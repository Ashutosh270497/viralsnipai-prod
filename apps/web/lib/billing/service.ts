import "server-only";

import crypto from "crypto";

import { Prisma } from "@prisma/client";

import { resolveBillingPlanId } from "@/config/plans";
import { prisma } from "@/lib/prisma";
import { BillingCycle, PlanTier, formatPlanName, resolvePlanTier } from "@/lib/billing/plans";
import { syncLegacySubscriptionFields } from "@/lib/billing/subscriptions";
import {
  type RazorpaySubscriptionEntity,
  derivePlanSelectionFromSubscription,
  getRazorpayPublicConfig,
  unixToIso,
} from "@/lib/billing/razorpay";

export type BillingDashboardState = {
  user: {
    id: string;
    name: string | null;
    email: string;
    plan: PlanTier;
    subscriptionTier: PlanTier;
    subscriptionStatus: string;
    billingCycle: BillingCycle;
    subscriptionCurrentStart: string | null;
    subscriptionCurrentEnd: string | null;
    subscriptionCancelAtPeriodEnd: boolean;
    razorpayCustomerId: string | null;
    razorpaySubscriptionId: string | null;
  };
  provider: ReturnType<typeof getRazorpayPublicConfig>;
};

type BillingUserRecord = {
  id: string;
  name: string | null;
  email: string;
  plan: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  billingCycle: string | null;
  subscriptionCurrentStart: Date | null;
  subscriptionCurrentEnd: Date | null;
  subscriptionCancelAtPeriodEnd: boolean;
  razorpayCustomerId: string | null;
  razorpaySubscriptionId: string | null;
};

function toPlanTier(value: string): PlanTier {
  return resolvePlanTier(value);
}

function toBillingCycle(value: string | null): BillingCycle {
  return value === "yearly" ? "yearly" : "monthly";
}

function serializeUser(user: BillingUserRecord): BillingDashboardState["user"] {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    plan: toPlanTier(user.plan),
    subscriptionTier: toPlanTier(user.subscriptionTier),
    subscriptionStatus: user.subscriptionStatus,
    billingCycle: toBillingCycle(user.billingCycle),
    subscriptionCurrentStart: user.subscriptionCurrentStart?.toISOString() ?? null,
    subscriptionCurrentEnd: user.subscriptionCurrentEnd?.toISOString() ?? null,
    subscriptionCancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd,
    razorpayCustomerId: user.razorpayCustomerId,
    razorpaySubscriptionId: user.razorpaySubscriptionId,
  };
}

export async function buildBillingDashboardState(userId: string): Promise<BillingDashboardState> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      subscriptionTier: true,
      subscriptionStatus: true,
      billingCycle: true,
      subscriptionCurrentStart: true,
      subscriptionCurrentEnd: true,
      subscriptionCancelAtPeriodEnd: true,
      razorpayCustomerId: true,
      razorpaySubscriptionId: true,
    },
  });

  if (!user) {
    throw new Error("Billing user not found.");
  }

  return {
    user: serializeUser(user),
    provider: getRazorpayPublicConfig(),
  };
}

export async function syncUserSubscriptionFromRazorpay(
  subscription: RazorpaySubscriptionEntity,
  fallbackUserId?: string | null,
) {
  const selection = derivePlanSelectionFromSubscription(subscription);
  const noteBillingRegion =
    typeof subscription.notes?.billingRegion === "string" &&
    (subscription.notes.billingRegion === "GLOBAL" || subscription.notes.billingRegion === "IN")
      ? subscription.notes.billingRegion
      : null;
  const noteUserId =
    typeof subscription.notes?.userId === "string" ? subscription.notes.userId : fallbackUserId ?? null;

  const existingSubscription = noteUserId
    ? await prisma.subscription.findUnique({
        where: { userId: noteUserId },
        select: {
          userId: true,
          planId: true,
          status: true,
          billingRegion: true,
          currentPeriodEnd: true,
          razorpayCustomerId: true,
          razorpaySubscriptionId: true,
        },
      })
    : await prisma.subscription.findFirst({
        where: { razorpaySubscriptionId: subscription.id },
        select: {
          userId: true,
          planId: true,
          status: true,
          billingRegion: true,
          currentPeriodEnd: true,
          razorpayCustomerId: true,
          razorpaySubscriptionId: true,
        },
      });

  const resolvedUserId = noteUserId ?? existingSubscription?.userId ?? fallbackUserId ?? null;
  if (!resolvedUserId) {
    return null;
  }

  const terminalStatus =
    subscription.status === "cancelled" ||
    subscription.status === "completed" ||
    subscription.status === "expired" ||
    subscription.status === "halted";

  const currentEnd =
    subscription.current_end
      ? new Date(subscription.current_end * 1000)
      : existingSubscription?.currentPeriodEnd ?? null;
  const shouldDowngrade = terminalStatus && (!currentEnd || currentEnd.getTime() <= Date.now());

  const nextPlanId = shouldDowngrade
    ? "free"
    : resolveBillingPlanId(selection.planId ?? existingSubscription?.planId ?? "free");

  const nextStatus =
    subscription.status === "created" ||
    subscription.status === "authenticated" ||
    subscription.status === "pending"
      ? "pending"
      : subscription.status === "halted"
        ? "paused"
        : subscription.status === "cancelled" ||
            subscription.status === "completed" ||
            subscription.status === "expired"
          ? "cancelled"
          : "active";

  const syncedSubscription = await prisma.subscription.upsert({
    where: { userId: resolvedUserId },
    update: {
      planId: nextPlanId,
      status: nextStatus,
      billingRegion: noteBillingRegion ?? existingSubscription?.billingRegion ?? "IN",
      razorpayCustomerId: subscription.customer_id ?? existingSubscription?.razorpayCustomerId ?? null,
      razorpaySubscriptionId: subscription.id,
      currentPeriodStart: subscription.current_start ? new Date(subscription.current_start * 1000) : null,
      currentPeriodEnd: currentEnd,
      cancelAtPeriodEnd: terminalStatus,
    },
    create: {
      userId: resolvedUserId,
      planId: nextPlanId,
      status: nextStatus,
      billingRegion: noteBillingRegion ?? "IN",
      razorpayCustomerId: subscription.customer_id ?? null,
      razorpaySubscriptionId: subscription.id,
      currentPeriodStart: subscription.current_start ? new Date(subscription.current_start * 1000) : null,
      currentPeriodEnd: currentEnd,
      cancelAtPeriodEnd: terminalStatus,
    },
  });

  await syncLegacySubscriptionFields(resolvedUserId, syncedSubscription);

  return prisma.user.findUnique({
    where: { id: resolvedUserId },
  });
}

export function buildBillingWebhookEventKey(eventType: string, payload: Record<string, unknown>) {
  const subscriptionId = extractSubscriptionIdFromWebhookPayload(payload);
  const createdAt = typeof payload.created_at === "number" ? payload.created_at : null;
  const payloadFingerprint = createdAt
    ? String(createdAt)
    : crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);

  return `${eventType}:${subscriptionId ?? "unknown"}:${payloadFingerprint}`;
}

export function extractSubscriptionIdFromWebhookPayload(payload: Record<string, unknown>) {
  const subscriptionEntity = getNested(payload, ["payload", "subscription", "entity"]);
  if (subscriptionEntity && typeof subscriptionEntity === "object" && subscriptionEntity !== null) {
    const value = (subscriptionEntity as Record<string, unknown>).id;
    if (typeof value === "string") return value;
  }

  const paymentEntity = getNested(payload, ["payload", "payment", "entity"]);
  if (paymentEntity && typeof paymentEntity === "object" && paymentEntity !== null) {
    const value = (paymentEntity as Record<string, unknown>).subscription_id;
    if (typeof value === "string") return value;
  }

  return null;
}

export function serializeSubscriptionForClient(subscription: RazorpaySubscriptionEntity) {
  const selection = derivePlanSelectionFromSubscription(subscription);

  return {
    id: subscription.id,
    status: subscription.status,
    planId: selection.planId,
    billingCycle: selection.billingCycle,
    billingCurrency: selection.currency,
    currentStart: unixToIso(subscription.current_start),
    currentEnd: unixToIso(subscription.current_end),
    shortUrl: subscription.short_url ?? null,
    customerId: subscription.customer_id ?? null,
  };
}

export function getPlanLabel(plan: PlanTier) {
  return formatPlanName(plan);
}

function getNested(value: Record<string, unknown>, path: string[]) {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object") {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export async function recordProcessedBillingWebhook(params: {
  providerEventId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
  subscriptionId?: string | null;
  userId?: string | null;
}) {
  return prisma.razorpayWebhookEvent.create({
    data: {
      providerEventId: params.providerEventId,
      eventType: params.eventType,
      payload: params.payload,
      razorpaySubscriptionId: params.subscriptionId ?? null,
      userId: params.userId ?? null,
      processedAt: new Date(),
    },
  });
}

export async function getSubscriptionRecordForUser(userId: string) {
  return prisma.subscription.findUnique({
    where: { userId },
  });
}

export async function markSubscriptionCancelAtPeriodEnd(userId: string, cancelAtPeriodEnd: boolean) {
  const subscription = await prisma.subscription.update({
    where: { userId },
    data: {
      cancelAtPeriodEnd,
    },
  });

  await syncLegacySubscriptionFields(userId, subscription);

  return prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionCancelAtPeriodEnd: cancelAtPeriodEnd,
    },
  });
}
