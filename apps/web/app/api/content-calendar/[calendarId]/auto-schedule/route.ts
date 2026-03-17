export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { addDays, isSameDay } from "date-fns";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * POST /api/content-calendar/[calendarId]/auto-schedule
 * Automatically distribute ideas optimally across the calendar
 */
export async function POST(
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

    // Fetch calendar with ideas
    const calendar = await prisma.contentCalendar.findFirst({
      where: {
        id: params.calendarId,
        userId: user.id,
      },
      include: {
        ideas: true,
      },
    });

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Auto-scheduling strategy:
    // 1. Sort ideas by virality score (highest first)
    // 2. Distribute across calendar evenly (1-2 ideas per day)
    // 3. Prioritize weekdays for trending content
    // 4. Space out high-virality content
    // 5. Ensure shorts and long-form are mixed

    const sortedIdeas = [...calendar.ideas].sort((a, b) => {
      // Primary: virality score
      const scoreA = a.viralityScore || 0;
      const scoreB = b.viralityScore || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;

      // Secondary: content category priority (trending > evergreen > experimental)
      const categoryPriority = { trending: 3, evergreen: 2, experimental: 1 };
      const catA = categoryPriority[a.contentCategory as keyof typeof categoryPriority] || 0;
      const catB = categoryPriority[b.contentCategory as keyof typeof categoryPriority] || 0;
      return catB - catA;
    });

    // Distribute ideas across calendar days
    const startDate = new Date(calendar.startDate);
    const ideasPerDay = 1; // Start with 1 idea per day, can increase if needed
    const updates: Array<{ id: string; scheduledDate: Date }> = [];

    let currentDay = 0;
    for (let i = 0; i < sortedIdeas.length; i++) {
      const idea = sortedIdeas[i];
      const scheduleDate = addDays(startDate, currentDay);

      // Skip weekends for trending content (optional optimization)
      const dayOfWeek = scheduleDate.getDay();
      const isTrending = idea.contentCategory === "trending";
      if (isTrending && (dayOfWeek === 0 || dayOfWeek === 6)) {
        // Skip to next weekday
        const daysToAdd = dayOfWeek === 0 ? 1 : 2;
        currentDay += daysToAdd;
      }

      updates.push({
        id: idea.id,
        scheduledDate: addDays(startDate, currentDay),
      });

      currentDay++;

      // Reset to start if we exceed calendar duration
      if (currentDay >= calendar.durationDays) {
        currentDay = currentDay % calendar.durationDays;
      }
    }

    // Update all ideas with new scheduled dates
    await Promise.all(
      updates.map((update) =>
        prisma.contentIdea.update({
          where: { id: update.id },
          data: { scheduledDate: update.scheduledDate },
        })
      )
    );

    logger.info("[Content Calendar] Auto-scheduled", {
      calendarId: params.calendarId,
      userId: user.id,
      ideasScheduled: updates.length,
    });

    return NextResponse.json(
      { success: true, ideasScheduled: updates.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[Content Calendar] Failed to auto-schedule", {
      error: error instanceof Error ? error : { error },
    });
    return NextResponse.json(
      { error: "Failed to auto-schedule calendar" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
