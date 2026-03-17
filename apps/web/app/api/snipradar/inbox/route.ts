export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { getCurrentDbUser } from "@/lib/auth";
import { generateInboxEnrichment } from "@/lib/ai/research-inbox";
import { prisma } from "@/lib/prisma";
import {
  mapResearchInboxItem,
  normalizeResearchInboxLabels,
  RESEARCH_INBOX_ITEM_TYPES,
  RESEARCH_INBOX_STATUSES,
} from "@/lib/snipradar/inbox";
import { emitSnipRadarWebhookEvent } from "@/lib/snipradar/webhooks";

function toJsonInput(value: Record<string, unknown> | null | undefined) {
  return value ? (value as Prisma.InputJsonValue) : Prisma.JsonNull;
}

const queryStatusSchema = z.enum(["all", ...RESEARCH_INBOX_STATUSES]);
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

function buildCounts(items: Array<{ status: string }>) {
  const counts = {
    all: items.length,
    new: 0,
    drafted: 0,
    tracked: 0,
    archived: 0,
  };

  for (const item of items) {
    if (item.status in counts) {
      counts[item.status as keyof typeof counts] += 1;
    }
  }

  return counts;
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = queryStatusSchema.catch("all").parse(searchParams.get("status") ?? "all");
    const limit = z.coerce.number().int().min(1).max(100).catch(50).parse(searchParams.get("limit") ?? "50");
    const search = (searchParams.get("q") ?? "").trim();

    const items = await prisma.xResearchInboxItem.findMany({
      where: {
        userId: user.id,
        ...(status === "all" ? {} : { status }),
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

    const allItems = await prisma.xResearchInboxItem.findMany({
      where: { userId: user.id },
      select: { status: true },
    });

    return NextResponse.json({
      items: items.map(mapResearchInboxItem),
      counts: buildCounts(allItems),
    });
  } catch (error) {
    console.error("[SnipRadar Inbox] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch research inbox" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = createInboxSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid inbox payload" },
        { status: 400 }
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
          userId: user.id,
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
                ? normalizeResearchInboxLabels(payload.labels)
                : existing.labels.length > 0
                  ? existing.labels
                  : enrichment.labels,
            metadata:
              payload.metadata !== undefined
                ? toJsonInput({
                    ...(payload.metadata ?? {}),
                    aiSuggestedAction: enrichment.suggestedAction,
                    aiEnrichmentSource: enrichment.source,
                  })
                : existing.metadata === null
                  ? toJsonInput({
                      aiSuggestedAction: enrichment.suggestedAction,
                      aiEnrichmentSource: enrichment.source,
                    })
                  : ({
                      ...(existing.metadata as Record<string, unknown>),
                      aiSuggestedAction: enrichment.suggestedAction,
                      aiEnrichmentSource: enrichment.source,
                    } as Prisma.InputJsonValue),
            status: existing.status === "archived" ? "new" : existing.status,
          },
        })
      : await prisma.xResearchInboxItem.create({
          data: {
            userId: user.id,
            source: payload.source ?? "browser_extension",
            itemType: payload.itemType,
            sourceUrl: payload.sourceUrl,
            xEntityId: payload.xEntityId ?? null,
            title: payload.title ?? enrichment.title ?? null,
            text: payload.text ?? null,
            authorUsername: payload.authorUsername ?? null,
            authorDisplayName: payload.authorDisplayName ?? null,
            authorAvatarUrl: payload.authorAvatarUrl ?? null,
            note: payload.note ?? enrichment.summary ?? null,
            labels:
              payload.labels && payload.labels.length > 0
                ? normalizeResearchInboxLabels(payload.labels)
                : enrichment.labels,
            metadata: toJsonInput({
              ...(payload.metadata ?? {}),
              aiSuggestedAction: enrichment.suggestedAction,
              aiEnrichmentSource: enrichment.source,
            }),
          },
        });

    await emitSnipRadarWebhookEvent({
      userId: user.id,
      eventType: "research.ingested",
      resourceType: "research_inbox_item",
      resourceId: item.id,
      payload: {
        inboxItemId: item.id,
        itemType: item.itemType,
        source: item.source,
        sourceUrl: item.sourceUrl,
        authorUsername: item.authorUsername,
        labels: item.labels,
        deduped: Boolean(existing),
        origin: "app_inbox",
      },
    });

    return NextResponse.json({
      item: mapResearchInboxItem(item),
      deduped: Boolean(existing),
    });
  } catch (error) {
    console.error("[SnipRadar Inbox] POST error:", error);
    return NextResponse.json({ error: "Failed to save capture to research inbox" }, { status: 500 });
  }
}
