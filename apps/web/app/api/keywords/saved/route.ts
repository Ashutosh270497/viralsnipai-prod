export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkKeywordQuota, projectUsageAfterConsume } from "@/lib/keywords/monetization";

const saveKeywordSchema = z.object({
  keyword: z.string().min(2, "Keyword must be at least 2 characters"),
  listName: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  searchVolume: z.number().optional(),
  competition: z.number().optional(),
  difficulty: z.string().optional(),
});

const deleteKeywordSchema = z.object({
  keyword: z.string().min(2, "Keyword must be at least 2 characters"),
});

/**
 * GET /api/keywords/saved
 * List user's saved keywords with optional list filtering
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { searchParams } = new URL(request.url);
    const listName = searchParams.get("list");

    // Check if the model exists
    try {
      if (!(prisma as any).savedKeyword) {
        return NextResponse.json(
          {
            data: [],
            lists: [],
            message: "Saved keywords feature not yet available",
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
    } catch {
      return NextResponse.json(
        {
          data: [],
          lists: [],
          message: "Saved keywords feature not yet available",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const where: any = { userId: session.user.id };
    if (listName) {
      where.listName = listName;
    }

    const savedKeywords = await prisma.savedKeyword.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    // Get unique list names for filtering
    const allKeywords = await prisma.savedKeyword.findMany({
      where: { userId: session.user.id },
      select: { listName: true },
      distinct: ["listName"],
    });

    const lists = allKeywords.map((k) => k.listName).filter(Boolean) as string[];

    return NextResponse.json(
      { data: savedKeywords, lists },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Keywords] Get saved error:", error);
    return NextResponse.json(
      { error: "Failed to get saved keywords" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

/**
 * POST /api/keywords/saved
 * Save a keyword (upsert - update if exists, create if new)
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const body = await request.json();
    const result = saveKeywordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { keyword, listName, tags, notes, searchVolume, competition, difficulty } = result.data;
    const userId = session.user.id;

    // Check if model exists
    try {
      if (!(prisma as any).savedKeyword) {
        return NextResponse.json(
          { error: "Saved keywords feature not yet available" },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Saved keywords feature not yet available" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    // Check for existing saved keyword (composite unique: userId + keyword)
    const existing = await prisma.savedKeyword.findUnique({
      where: {
        userId_keyword: {
          userId,
          keyword: keyword.toLowerCase(),
        },
      },
    });

    let savedKeyword;
    let usagePayload: ReturnType<typeof projectUsageAfterConsume> | null = null;

    if (existing) {
      // Update existing
      savedKeyword = await prisma.savedKeyword.update({
        where: { id: existing.id },
        data: {
          listName: listName ?? existing.listName,
          tags: tags ?? existing.tags,
          notes: notes ?? existing.notes,
          searchVolume: searchVolume ?? existing.searchVolume,
          competition: competition ?? existing.competition,
          difficulty: difficulty ?? existing.difficulty,
        },
      });
    } else {
      const saveQuota = await checkKeywordQuota(userId, "savedKeywords");
      if (!saveQuota.allowed) {
        return NextResponse.json(
          {
            error: "Saved keyword limit reached for this plan.",
            message:
              saveQuota.tier === "free"
                ? "Upgrade to Starter to save and organize more keywords."
                : "Upgrade your plan to increase saved keyword storage.",
            usage: saveQuota,
            upgrade: {
              required: true,
              targetPlan: saveQuota.tier === "free" ? "starter" : "creator",
              path: "/pricing",
            },
          },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        );
      }

      // Create new
      savedKeyword = await prisma.savedKeyword.create({
        data: {
          userId,
          keyword: keyword.toLowerCase(),
          listName,
          tags: tags || [],
          notes,
          searchVolume,
          competition,
          difficulty,
        },
      });
      usagePayload = projectUsageAfterConsume(saveQuota, 1);
    }

    // Also update keywordResearch.isSaved if record exists
    try {
      if ((prisma as any).keywordResearch) {
        await prisma.keywordResearch.updateMany({
          where: {
            userId,
            keyword: keyword.toLowerCase(),
          },
          data: { isSaved: true },
        });
      }
    } catch {
      // Ignore - keywordResearch model might not exist
    }

    return NextResponse.json(
      { data: savedKeyword, ...(usagePayload ? { usage: usagePayload } : {}) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Keywords] Save error:", error);
    return NextResponse.json(
      { error: "Failed to save keyword" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

/**
 * DELETE /api/keywords/saved
 * Remove a saved keyword
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const body = await request.json();
    const result = deleteKeywordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { keyword } = result.data;
    const userId = session.user.id;

    // Check if model exists
    try {
      if (!(prisma as any).savedKeyword) {
        return NextResponse.json(
          { error: "Saved keywords feature not yet available" },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Saved keywords feature not yet available" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    // Delete the saved keyword
    await prisma.savedKeyword.delete({
      where: {
        userId_keyword: {
          userId,
          keyword: keyword.toLowerCase(),
        },
      },
    });

    // Update keywordResearch.isSaved to false
    try {
      if ((prisma as any).keywordResearch) {
        await prisma.keywordResearch.updateMany({
          where: {
            userId,
            keyword: keyword.toLowerCase(),
          },
          data: { isSaved: false },
        });
      }
    } catch {
      // Ignore - keywordResearch model might not exist
    }

    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Keywords] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete saved keyword" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
