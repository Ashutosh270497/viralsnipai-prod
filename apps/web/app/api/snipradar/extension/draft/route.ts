export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createDraftSchema = z.object({
  text: z.string().min(1).max(560),
});

/**
 * POST /api/snipradar/extension/draft
 * Save a manually written quick-compose draft from the extension popup.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = createDraftSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid draft payload" },
        { status: 400 }
      );
    }

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, isActive: true },
      select: { id: true },
    });

    if (!xAccount) {
      return NextResponse.json(
        { error: "Please connect your X account first." },
        { status: 400 }
      );
    }

    const draft = await prisma.tweetDraft.create({
      data: {
        userId: user.id,
        xAccountId: xAccount.id,
        text: parsed.data.text,
        status: "draft",
      },
    });

    return NextResponse.json({
      draft: {
        id: draft.id,
        text: draft.text,
        status: draft.status,
        createdAt: draft.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[SnipRadar Extension Draft] POST error:", error);
    return NextResponse.json({ error: "Failed to save draft", code: "INTERNAL_ERROR", retryable: true }, { status: 500 });
  }
}
