export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentDbUser } from "@/lib/auth";
import {
  createAutoDmAutomation,
  getAutoDmDashboard,
  parseTriggerTweetId,
} from "@/lib/snipradar/auto-dm";
import { prisma } from "@/lib/prisma";

const createSchema = z
  .object({
    postedDraftId: z.string().min(1).optional(),
    triggerTweetRef: z.string().trim().optional(),
    keyword: z.string().trim().max(80).optional().nullable(),
    dmTemplate: z.string().trim().min(10).max(1000),
    dailyCap: z.coerce.number().int().min(1).max(250).optional(),
    name: z.string().trim().max(80).optional().nullable(),
  })
  .refine((value) => Boolean(value.postedDraftId || value.triggerTweetRef), {
    message: "Choose a posted draft or provide a tweet URL/ID.",
    path: ["triggerTweetRef"],
  });

export async function GET() {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dashboard = await getAutoDmDashboard(user.id);
    return NextResponse.json(dashboard);
  } catch (error) {
    console.error("[SnipRadar Auto-DM] GET error:", error);
    return NextResponse.json({ error: "Failed to load Auto-DM automations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid Auto-DM payload" },
        { status: 400 }
      );
    }

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, isActive: true },
      select: { id: true, xUsername: true },
    });
    if (!xAccount) {
      return NextResponse.json({ error: "Connect your X account first." }, { status: 400 });
    }

    let triggerTweetId: string | null = null;
    let triggerTweetText: string | null = null;
    let triggerTweetUrl: string | null = null;

    if (parsed.data.postedDraftId) {
      const draft = await prisma.tweetDraft.findFirst({
        where: {
          id: parsed.data.postedDraftId,
          userId: user.id,
          xAccountId: xAccount.id,
          status: "posted",
          postedTweetId: { not: null },
        },
        select: {
          text: true,
          postedTweetId: true,
        },
      });
      if (!draft?.postedTweetId) {
        return NextResponse.json({ error: "Posted draft not found." }, { status: 404 });
      }

      triggerTweetId = draft.postedTweetId;
      triggerTweetText = draft.text;
      triggerTweetUrl = `https://x.com/${xAccount.xUsername}/status/${draft.postedTweetId}`;
    } else if (parsed.data.triggerTweetRef) {
      const parsedId = parseTriggerTweetId(parsed.data.triggerTweetRef);
      if (!parsedId) {
        return NextResponse.json({ error: "Provide a valid X tweet URL or tweet ID." }, { status: 400 });
      }
      triggerTweetId = parsedId;
      triggerTweetUrl =
        parsed.data.triggerTweetRef.startsWith("http") || parsed.data.triggerTweetRef.startsWith("https")
          ? parsed.data.triggerTweetRef
          : null;
    }

    if (!triggerTweetId) {
      return NextResponse.json({ error: "Trigger tweet is required." }, { status: 400 });
    }

    const automation = await createAutoDmAutomation({
      userId: user.id,
      xAccountId: xAccount.id,
      triggerTweetId,
      triggerTweetText,
      triggerTweetUrl,
      keyword: parsed.data.keyword ?? null,
      dmTemplate: parsed.data.dmTemplate,
      dailyCap: parsed.data.dailyCap,
      name: parsed.data.name ?? null,
    });

    return NextResponse.json({ automation });
  } catch (error) {
    console.error("[SnipRadar Auto-DM] POST error:", error);
    return NextResponse.json({ error: "Failed to create Auto-DM automation" }, { status: 500 });
  }
}
