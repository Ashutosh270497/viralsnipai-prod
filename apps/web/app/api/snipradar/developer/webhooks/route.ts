export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  encryptSnipRadarSecret,
  generateSnipRadarWebhookSecret,
  normalizeSnipRadarWebhookEvents,
  serializeSnipRadarWebhookSubscription,
  SNIPRADAR_WEBHOOK_EVENT_LABELS,
} from "@/lib/snipradar/public-api";

const webhookUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://") || value.startsWith("http://localhost"), {
    message: "Webhook URL must use https:// or http://localhost",
  });

const createWebhookSchema = z.object({
  name: z.string().min(2).max(80),
  url: webhookUrlSchema,
  events: z.array(z.string()).max(20).optional(),
});

export async function GET() {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscriptions = await prisma.snipRadarWebhookSubscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        url: true,
        signingSecretPreview: true,
        events: true,
        isActive: true,
        lastDeliveredAt: true,
        lastFailureAt: true,
        lastFailureReason: true,
        createdAt: true,
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            status: true,
            responseStatus: true,
            errorMessage: true,
            createdAt: true,
            deliveredAt: true,
          },
        },
      },
    });

    return NextResponse.json({
      subscriptions: subscriptions.map(serializeSnipRadarWebhookSubscription),
      eventCatalog: Object.entries(SNIPRADAR_WEBHOOK_EVENT_LABELS).map(([id, label]) => ({
        id,
        label,
      })),
    });
  } catch (error) {
    console.error("[SnipRadar Developer Webhooks] GET error:", error);
    return NextResponse.json({ error: "Failed to load webhook subscriptions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = createWebhookSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid webhook payload" },
        { status: 400 }
      );
    }

    const signingSecret = generateSnipRadarWebhookSecret();
    const subscription = await prisma.snipRadarWebhookSubscription.create({
      data: {
        userId: user.id,
        name: parsed.data.name.trim(),
        url: parsed.data.url.trim(),
        events: normalizeSnipRadarWebhookEvents(parsed.data.events),
        signingSecretCiphertext: encryptSnipRadarSecret(signingSecret),
        signingSecretPreview: `${signingSecret.slice(0, 10)}••••${signingSecret.slice(-4)}`,
      },
      select: {
        id: true,
        name: true,
        url: true,
        signingSecretPreview: true,
        events: true,
        isActive: true,
        lastDeliveredAt: true,
        lastFailureAt: true,
        lastFailureReason: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        subscription: serializeSnipRadarWebhookSubscription(subscription),
        signingSecret,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[SnipRadar Developer Webhooks] POST error:", error);
    return NextResponse.json({ error: "Failed to create webhook subscription" }, { status: 500 });
  }
}
