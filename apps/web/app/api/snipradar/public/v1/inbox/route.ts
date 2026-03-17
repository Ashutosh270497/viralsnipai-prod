export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { generateInboxEnrichment } from "@/lib/ai/research-inbox";
import {
  authenticateSnipRadarApiRequest,
  buildSnipRadarPlatformHeaders,
} from "@/lib/snipradar/public-api";
import {
  mapResearchInboxItem,
  RESEARCH_INBOX_ITEM_TYPES,
  RESEARCH_INBOX_STATUSES,
} from "@/lib/snipradar/inbox";
import { emitSnipRadarWebhookEvent } from "@/lib/snipradar/webhooks";

const createInboxSchema = z.object({
  source: z.string().min(1).max(40).optional(),
  itemType: z.enum(RESEARCH_INBOX_ITEM_TYPES),
  sourceUrl: z.string().min(1).max(500),
  xEntityId: z.string().max(80).optional().nullable(),
  title: z.string().max(280).optional().nullable(),
  text: z.string().max(10_000).optional().nullable(),
  authorUsername: z.string().max(80).optional().nullable(),
  authorDisplayName: z.string().max(120).optional().nullable(),
  authorAvatarUrl: z.string().max(500).optional().nullable(),
  note: z.string().max(2_000).optional().nullable(),
  labels: z.array(z.string().min(1).max(40)).max(8).optional(),
  metadata: z.record(z.any()).optional(),
});

function toJsonInput(value: Record<string, unknown> | null | undefined) {
  return value ? (value as Prisma.InputJsonValue) : Prisma.JsonNull;
}

export async function GET(request: NextRequest) {
  const auth = await authenticateSnipRadarApiRequest(request, ["research:write"]);
  if (!auth.ok) return auth.response;

  try {
    const status = request.nextUrl.searchParams.get("status");
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 25), 1), 100);
    const search = (request.nextUrl.searchParams.get("q") ?? "").trim();

    const items = await prisma.xResearchInboxItem.findMany({
      where: {
        userId: auth.context.userId,
        ...(status && RESEARCH_INBOX_STATUSES.includes(status as (typeof RESEARCH_INBOX_STATUSES)[number])
          ? { status }
          : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { text: { contains: search, mode: "insensitive" } },
                { authorUsername: { contains: search, mode: "insensitive" } },
                { authorDisplayName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    return NextResponse.json(
      { items: items.map(mapResearchInboxItem) },
      { headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  } catch (error) {
    console.error("[SnipRadar Public API] GET inbox error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch research inbox items" },
      { status: 500, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateSnipRadarApiRequest(request, ["research:write"]);
  if (!auth.ok) return auth.response;

  try {
    const parsed = createInboxSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Invalid inbox payload" },
        { status: 400, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.context.userId },
      select: { id: true, selectedNiche: true },
    });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
      );
    }

    const payload = parsed.data;
    const enrichment = await generateInboxEnrichment({
      itemType: payload.itemType,
      title: payload.title ?? null,
      text: payload.text ?? null,
      authorUsername: payload.authorUsername ?? null,
      selectedNiche: user.selectedNiche ?? null,
    });

    const existing = await prisma.xResearchInboxItem.findUnique({
      where: {
        userId_sourceUrl: {
          userId: auth.context.userId,
          sourceUrl: payload.sourceUrl,
        },
      },
    });

    const item = existing
      ? await prisma.xResearchInboxItem.update({
          where: { id: existing.id },
          data: {
            source: payload.source ?? existing.source,
            itemType: payload.itemType,
            xEntityId: payload.xEntityId ?? null,
            title: payload.title ?? enrichment.title ?? existing.title,
            text: payload.text ?? null,
            authorUsername: payload.authorUsername ?? null,
            authorDisplayName: payload.authorDisplayName ?? null,
            authorAvatarUrl: payload.authorAvatarUrl ?? null,
            note: payload.note ?? enrichment.summary ?? existing.note,
            labels:
              payload.labels && payload.labels.length > 0
                ? payload.labels
                : existing.labels.length > 0
                  ? existing.labels
                  : enrichment.labels,
            metadata:
              payload.metadata !== undefined
                ? toJsonInput({
                    ...(payload.metadata ?? {}),
                    aiSuggestedAction: enrichment.suggestedAction,
                    aiEnrichmentSource: enrichment.source,
                    ingestedVia: "public_api",
                    apiKeyId: auth.context.apiKeyId,
                  })
                : ({
                    ...((existing.metadata as Record<string, unknown> | null) ?? {}),
                    aiSuggestedAction: enrichment.suggestedAction,
                    aiEnrichmentSource: enrichment.source,
                    ingestedVia: "public_api",
                    apiKeyId: auth.context.apiKeyId,
                  } as Prisma.InputJsonValue),
            status: existing.status === "archived" ? "new" : existing.status,
          },
        })
      : await prisma.xResearchInboxItem.create({
          data: {
            userId: auth.context.userId,
            source: payload.source ?? "public_api",
            itemType: payload.itemType,
            sourceUrl: payload.sourceUrl,
            xEntityId: payload.xEntityId ?? null,
            title: payload.title ?? enrichment.title ?? null,
            text: payload.text ?? null,
            authorUsername: payload.authorUsername ?? null,
            authorDisplayName: payload.authorDisplayName ?? null,
            authorAvatarUrl: payload.authorAvatarUrl ?? null,
            note: payload.note ?? enrichment.summary ?? null,
            labels: payload.labels && payload.labels.length > 0 ? payload.labels : enrichment.labels,
            metadata: toJsonInput({
              ...(payload.metadata ?? {}),
              aiSuggestedAction: enrichment.suggestedAction,
              aiEnrichmentSource: enrichment.source,
              ingestedVia: "public_api",
              apiKeyId: auth.context.apiKeyId,
            }),
          },
        });

    await emitSnipRadarWebhookEvent({
      userId: auth.context.userId,
      eventType: "research.ingested",
      resourceType: "research_inbox_item",
      resourceId: item.id,
      payload: {
        inboxItemId: item.id,
        itemType: item.itemType,
        sourceUrl: item.sourceUrl,
        authorUsername: item.authorUsername,
        labels: item.labels,
        deduped: Boolean(existing),
        apiKeyId: auth.context.apiKeyId,
        apiKeyName: auth.context.apiKeyName,
      },
    });

    return NextResponse.json(
      {
        item: mapResearchInboxItem(item),
        deduped: Boolean(existing),
      },
      {
        status: existing ? 200 : 201,
        headers: buildSnipRadarPlatformHeaders(auth.context.headers),
      }
    );
  } catch (error) {
    console.error("[SnipRadar Public API] POST inbox error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to ingest research item" },
      { status: 500, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  }
}
