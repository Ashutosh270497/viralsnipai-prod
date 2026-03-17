import "server-only";

import { Prisma } from "@prisma/client";

import { fetchRazorpaySubscription, RazorpayApiError, cancelRazorpaySubscription, verifyRazorpayPaymentSignature, verifyRazorpayWebhookSignature } from "@/lib/billing/razorpay";
import {
  buildBillingWebhookEventKey,
  extractSubscriptionIdFromWebhookPayload,
  getSubscriptionRecordForUser,
  markSubscriptionCancelAtPeriodEnd,
  recordProcessedBillingWebhook,
  serializeSubscriptionForClient,
  syncUserSubscriptionFromRazorpay,
} from "@/lib/billing/service";
import { markEventProcessed } from "@/lib/billing/webhook-idempotency";

export class BillingCoreError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "BillingCoreError";
    this.status = status;
  }
}

export async function verifyRazorpayPaymentForUser(params: {
  userId: string;
  paymentId: string;
  subscriptionId: string;
  signature: string;
}) {
  const isSignatureValid = verifyRazorpayPaymentSignature(
    params.paymentId,
    params.subscriptionId,
    params.signature,
  );
  if (!isSignatureValid) {
    throw new BillingCoreError("Invalid payment signature.", 403);
  }

  const currentSubscription = await getSubscriptionRecordForUser(params.userId);
  if (
    currentSubscription?.razorpaySubscriptionId &&
    currentSubscription.razorpaySubscriptionId !== params.subscriptionId
  ) {
    throw new BillingCoreError("This subscription does not belong to the current user.", 403);
  }

  const remoteSubscription = await fetchRazorpaySubscription(params.subscriptionId);
  const noteUserId =
    typeof remoteSubscription.notes?.userId === "string" ? remoteSubscription.notes.userId : null;
  if (noteUserId && noteUserId !== params.userId) {
    throw new BillingCoreError("This subscription does not belong to the current user.", 403);
  }

  const syncedUser = await syncUserSubscriptionFromRazorpay(remoteSubscription, params.userId);
  if (!syncedUser) {
    throw new BillingCoreError("Unable to map subscription to a user.", 404);
  }

  return {
    subscription: serializeSubscriptionForClient(remoteSubscription),
    user: {
      plan: syncedUser.plan,
      subscriptionTier: syncedUser.subscriptionTier,
      subscriptionStatus: syncedUser.subscriptionStatus,
    },
  };
}

export async function cancelRazorpaySubscriptionForUser(params: {
  userId: string;
  subscriptionId?: string | null;
  cancelAtCycleEnd?: boolean;
}) {
  const localSubscription = await getSubscriptionRecordForUser(params.userId);
  const targetSubscriptionId = params.subscriptionId ?? localSubscription?.razorpaySubscriptionId ?? null;
  if (!targetSubscriptionId) {
    throw new BillingCoreError("No active Razorpay subscription found.", 400);
  }

  if (
    localSubscription?.razorpaySubscriptionId &&
    localSubscription.razorpaySubscriptionId !== targetSubscriptionId
  ) {
    throw new BillingCoreError("This subscription does not belong to the current user.", 403);
  }

  const cancelAtCycleEnd = params.cancelAtCycleEnd ?? true;
  await cancelRazorpaySubscription(targetSubscriptionId, cancelAtCycleEnd);
  const remoteSubscription = await fetchRazorpaySubscription(targetSubscriptionId);
  await syncUserSubscriptionFromRazorpay(remoteSubscription, params.userId);
  await markSubscriptionCancelAtPeriodEnd(params.userId, cancelAtCycleEnd);

  return {
    subscription: serializeSubscriptionForClient(remoteSubscription),
  };
}

export async function refreshPendingRazorpaySubscriptionForUser(userId: string) {
  const localSubscription = await getSubscriptionRecordForUser(userId);
  if (!localSubscription?.razorpaySubscriptionId || localSubscription.status !== "pending") {
    return null;
  }

  try {
    const remoteSubscription = await fetchRazorpaySubscription(localSubscription.razorpaySubscriptionId);
    return await syncUserSubscriptionFromRazorpay(remoteSubscription, userId);
  } catch (error) {
    if (error instanceof RazorpayApiError) {
      return null;
    }
    throw error;
  }
}

export async function processRazorpayWebhook(params: {
  rawBody: string;
  signature: string | null;
  providerEventId?: string | null;
}) {
  if (!verifyRazorpayWebhookSignature(params.rawBody, params.signature)) {
    throw new BillingCoreError("Invalid Razorpay webhook signature.", 400);
  }

  const payload = JSON.parse(params.rawBody) as Record<string, unknown>;
  const eventType = typeof payload.event === "string" ? payload.event : "unknown";
  const providerEventId = params.providerEventId ?? buildBillingWebhookEventKey(eventType, payload);

  if (!markEventProcessed(providerEventId)) {
    return { duplicate: true };
  }

  let subscription = null;
  const subscriptionEntity = getSubscriptionEntity(payload);
  if (subscriptionEntity?.id) {
    subscription = {
      ...subscriptionEntity,
      status: subscriptionEntity.status ?? "created",
    };
  } else {
    const subscriptionId = extractSubscriptionIdFromWebhookPayload(payload);
    if (subscriptionId) {
      subscription = await fetchRazorpaySubscription(subscriptionId);
    }
  }

  const syncedUser = subscription ? await syncUserSubscriptionFromRazorpay(subscription) : null;

  await recordProcessedBillingWebhook({
    providerEventId,
    eventType,
    payload: payload as Prisma.InputJsonValue,
    subscriptionId: subscription?.id ?? null,
    userId: syncedUser?.id ?? null,
  });

  return { duplicate: false };
}

function getSubscriptionEntity(payload: Record<string, unknown>) {
  const subscription = getNested(payload, ["payload", "subscription", "entity"]);
  if (!subscription || typeof subscription !== "object") {
    return null;
  }

  const subscriptionId = (subscription as Record<string, unknown>).id;
  if (typeof subscriptionId !== "string") {
    return null;
  }

  return subscription as {
    id: string;
    status?: string;
    current_start?: number | null;
    current_end?: number | null;
    customer_id?: string | null;
    notes?: Record<string, unknown> | null;
  };
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

export { RazorpayApiError };
