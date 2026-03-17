export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET /api/content-calendar/[calendarId]
 * Fetch a specific content calendar with all its ideas
 */
export async function GET(
  request: Request,
  { params }: { params: { calendarId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const calendar = await prisma.contentCalendar.findFirst({
      where: {
        id: params.calendarId,
        userId: user.id,
      },
      include: {
        ideas: {
          orderBy: {
            scheduledDate: 'asc',
          },
        },
      },
    });

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { calendar },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Content Calendar] Failed to fetch calendar', { error: error instanceof Error ? error : { error } });
    return NextResponse.json(
      { error: "Failed to fetch content calendar" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * DELETE /api/content-calendar/[calendarId]
 * Delete a content calendar and all its ideas
 */
export async function DELETE(
  request: Request,
  { params }: { params: { calendarId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Verify ownership
    const calendar = await prisma.contentCalendar.findFirst({
      where: {
        id: params.calendarId,
        userId: user.id,
      },
    });

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Delete calendar (ideas will be cascade deleted or set null based on schema)
    await prisma.contentCalendar.delete({
      where: {
        id: params.calendarId,
      },
    });

    logger.info('[Content Calendar] Calendar deleted', {
      calendarId: params.calendarId,
      userId: user.id,
    });

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Content Calendar] Failed to delete calendar', { error: error instanceof Error ? error : { error } });
    return NextResponse.json(
      { error: "Failed to delete content calendar" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
