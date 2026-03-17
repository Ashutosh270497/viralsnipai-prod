export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET /api/content-calendar
 * Fetch all content calendars for the current user
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const calendars = await prisma.contentCalendar.findMany({
      where: {
        userId: user.id,
      },
      include: {
        ideas: {
          orderBy: {
            scheduledDate: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(
      { calendars },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Content Calendar] Failed to fetch calendars', { error: error instanceof Error ? error : { error } });
    return NextResponse.json(
      { error: "Failed to fetch content calendars" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
