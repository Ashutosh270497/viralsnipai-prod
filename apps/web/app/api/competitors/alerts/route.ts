export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/competitors/alerts
 * Fetch user's competitor alerts with optional unread filter
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const where: any = { userId: user.id };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [alerts, unreadCount] = await Promise.all([
      prisma.competitorAlert.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.competitorAlert.count({
        where: { userId: user.id, isRead: false },
      }),
    ]);

    return NextResponse.json(
      { alerts, unreadCount },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[Competitors API] Alerts GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * PATCH /api/competitors/alerts
 * Mark alerts as read (by IDs or all)
 */
export async function PATCH(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await request.json();
    const { alertIds, markAllRead } = body as {
      alertIds?: string[];
      markAllRead?: boolean;
    };

    if (markAllRead) {
      await prisma.competitorAlert.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true },
      });
    } else if (alertIds && alertIds.length > 0) {
      await prisma.competitorAlert.updateMany({
        where: {
          id: { in: alertIds },
          userId: user.id,
        },
        data: { isRead: true },
      });
    } else {
      return NextResponse.json(
        { error: "Provide alertIds or markAllRead" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[Competitors API] Alerts PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update alerts" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
