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
} from "@/lib/snipradar/public-api";

const webhookUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://") || value.startsWith("http://localhost"), {
    message: "Webhook URL must use https:// or http://localhost",
  });

const updateWebhookSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  url: webhookUrlSchema.optional(),
  events: z.array(z.string()).max(20).optional(),
  isActive: z.boolean().optional(),
  rotateSecret: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = updateWebhookSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid webhook update" },
        { status: 400 }
      );
    }

    const existing = await prisma.snipRadarWebhookSubscription.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Webhook subscription not found" }, { status: 404 });
    }

    let signingSecret: string | null = null;
    if (parsed.data.rotateSecret) {
      signingSecret = generateSnipRadarWebhookSecret();
    }

    const subscription = await prisma.snipRadarWebhookSubscription.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.url !== undefined ? { url: parsed.data.url.trim() } : {}),
        ...(parsed.data.events !== undefined
          ? { events: normalizeSnipRadarWebhookEvents(parsed.data.events) }
          : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        ...(signingSecret
          ? {
              signingSecretCiphertext: encryptSnipRadarSecret(signingSecret),
              signingSecretPreview: `${signingSecret.slice(0, 10)}••••${signingSecret.slice(-4)}`,
            }
          : {}),
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
      subscription: serializeSnipRadarWebhookSubscription(subscription),
      ...(signingSecret ? { signingSecret } : {}),
    });
  } catch (error) {
    console.error("[SnipRadar Developer Webhooks] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update webhook subscription" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.snipRadarWebhookSubscription.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Webhook subscription not found" }, { status: 404 });
    }

    await prisma.snipRadarWebhookSubscription.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SnipRadar Developer Webhooks] DELETE error:", error);
    return NextResponse.json({ error: "Failed to disable webhook subscription" }, { status: 500 });
  }
}
