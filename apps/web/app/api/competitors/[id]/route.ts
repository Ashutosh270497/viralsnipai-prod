export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Serialize BigInt values to strings for JSON response
 */
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }
  return obj;
}

const updateCompetitorSchema = z.object({
  category: z
    .string()
    .trim()
    .max(50, "Category must be 50 characters or less")
    .nullable()
    .optional()
    .transform((value) => {
      if (value === null || value === undefined) return null;
      return value.length > 0 ? value : null;
    }),
});

/**
 * GET /api/competitors/[id]
 * Fetch a single competitor with full history
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const competitor = await prisma.competitor.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
      include: {
        snapshots: {
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        videos: {
          orderBy: { publishedAt: "desc" },
          take: 50,
        },
      },
    });

    if (!competitor) {
      return NextResponse.json(
        { error: "Competitor not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { competitor: serializeBigInt(competitor) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[Competitors API] GET [id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch competitor" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * PATCH /api/competitors/[id]
 * Update competitor (e.g. category)
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await request.json();
    const parsed = updateCompetitorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request body" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    const { category } = parsed.data;

    // Verify ownership
    const existing = await prisma.competitor.findFirst({
      where: { id: params.id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Competitor not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const updated = await prisma.competitor.update({
      where: { id: params.id },
      data: { category },
    });

    return NextResponse.json(
      { competitor: serializeBigInt(updated) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[Competitors API] PATCH [id] error:", error);
    return NextResponse.json(
      { error: "Failed to update competitor" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * DELETE /api/competitors/[id]
 * Soft-delete competitor (set isActive to false)
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Verify ownership
    const existing = await prisma.competitor.findFirst({
      where: { id: params.id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Competitor not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    await prisma.competitor.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[Competitors API] DELETE [id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete competitor" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
