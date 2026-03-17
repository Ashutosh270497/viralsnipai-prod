import { Prisma } from "@prisma/client";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  decryptSnipRadarSecret,
  normalizeSnipRadarWebhookEvents,
  signSnipRadarWebhookPayload,
  truncatePreview,
  type SnipRadarWebhookEventType,
} from "@/lib/snipradar/public-api";

type EmitSnipRadarWebhookEventParams = {
  userId: string;
  eventType: SnipRadarWebhookEventType;
  resourceType: string;
  resourceId?: string | null;
  payload: Record<string, unknown>;
  dedupeWindowMs?: number;
};

function buildEventEnvelope(event: {
  id: string;
  eventType: string;
  resourceType: string;
  resourceId: string | null;
  payload: unknown;
  createdAt: Date;
}) {
  return {
    id: event.id,
    type: event.eventType,
    createdAt: event.createdAt.toISOString(),
    resource: {
      type: event.resourceType,
      id: event.resourceId,
    },
    data: event.payload,
  };
}

async function deliverWebhook(params: {
  deliveryId: string;
  subscription: {
    id: string;
    url: string;
    signingSecretCiphertext: string;
  };
  event: {
    id: string;
    eventType: string;
    resourceType: string;
    resourceId: string | null;
    payload: unknown;
    createdAt: Date;
  };
}) {
  const body = JSON.stringify(buildEventEnvelope(params.event));
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const startedAt = Date.now();
  const signingSecret = decryptSnipRadarSecret(params.subscription.signingSecretCiphertext);
  const signature = signSnipRadarWebhookPayload({
    signingSecret,
    timestamp,
    body,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_500);

  try {
    const response = await fetch(params.subscription.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "SnipRadar-Webhooks/1.0",
        "X-SnipRadar-Event": params.event.eventType,
        "X-SnipRadar-Delivery": params.deliveryId,
        "X-SnipRadar-Timestamp": timestamp,
        "X-SnipRadar-Signature": signature,
      },
      body,
      signal: controller.signal,
    });

    const responseText = truncatePreview(await response.text().catch(() => null), 800);
    const durationMs = Date.now() - startedAt;
    const isSuccess = response.status >= 200 && response.status < 300;

    await prisma.snipRadarWebhookDelivery.update({
      where: { id: params.deliveryId },
      data: {
        status: isSuccess ? "success" : "failed",
        responseStatus: response.status,
        durationMs,
        responseBodyPreview: responseText,
        errorMessage: isSuccess ? null : responseText ?? `Webhook returned ${response.status}`,
        deliveredAt: isSuccess ? new Date() : null,
      },
    });

    await prisma.snipRadarWebhookSubscription.update({
      where: { id: params.subscription.id },
      data: isSuccess
        ? {
            lastDeliveredAt: new Date(),
            lastFailureAt: null,
            lastFailureReason: null,
          }
        : {
            lastFailureAt: new Date(),
            lastFailureReason: responseText ?? `Webhook returned ${response.status}`,
          },
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);

    await prisma.snipRadarWebhookDelivery.update({
      where: { id: params.deliveryId },
      data: {
        status: "failed",
        durationMs,
        errorMessage: message,
      },
    });

    await prisma.snipRadarWebhookSubscription.update({
      where: { id: params.subscription.id },
      data: {
        lastFailureAt: new Date(),
        lastFailureReason: message,
      },
    });

    logger.warn("[SnipRadar Webhooks] delivery failed", {
      subscriptionId: params.subscription.id,
      deliveryId: params.deliveryId,
      eventType: params.event.eventType,
      error: message,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function emitSnipRadarWebhookEvent(params: EmitSnipRadarWebhookEventParams) {
  const normalizedPayload = params.payload as Prisma.InputJsonValue;

  if (params.resourceId && params.dedupeWindowMs && params.dedupeWindowMs > 0) {
    const existing = await prisma.snipRadarWebhookEvent.findFirst({
      where: {
        userId: params.userId,
        eventType: params.eventType,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        createdAt: { gte: new Date(Date.now() - params.dedupeWindowMs) },
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return {
        eventId: existing.id,
        deduped: true,
        delivered: 0,
      };
    }
  }

  const subscriptions = await prisma.snipRadarWebhookSubscription.findMany({
    where: {
      userId: params.userId,
      isActive: true,
    },
    select: {
      id: true,
      url: true,
      signingSecretCiphertext: true,
      events: true,
    },
  });

  const matchingSubscriptions = subscriptions.filter((subscription) =>
    normalizeSnipRadarWebhookEvents(subscription.events).includes(params.eventType)
  );

  const event = await prisma.snipRadarWebhookEvent.create({
    data: {
      userId: params.userId,
      eventType: params.eventType,
      resourceType: params.resourceType,
      resourceId: params.resourceId ?? null,
      payload: normalizedPayload,
    },
    select: {
      id: true,
      eventType: true,
      resourceType: true,
      resourceId: true,
      payload: true,
      createdAt: true,
    },
  });

  if (matchingSubscriptions.length === 0) {
    return {
      eventId: event.id,
      deduped: false,
      delivered: 0,
    };
  }

  const deliveries = await Promise.all(
    matchingSubscriptions.map((subscription) =>
      prisma.snipRadarWebhookDelivery.create({
        data: {
          eventId: event.id,
          subscriptionId: subscription.id,
          status: "pending",
        },
        select: {
          id: true,
        },
      })
    )
  );

  await Promise.allSettled(
    matchingSubscriptions.map((subscription, index) =>
      deliverWebhook({
        deliveryId: deliveries[index].id,
        subscription,
        event,
      })
    )
  );

  return {
    eventId: event.id,
    deduped: false,
    delivered: matchingSubscriptions.length,
  };
}
