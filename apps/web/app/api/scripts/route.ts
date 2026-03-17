export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET /api/scripts
 * Fetch all scripts for the current user
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

    const scripts = await prisma.generatedScript.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(
      { scripts },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Script API] Failed to fetch scripts', { error });
    return NextResponse.json(
      { error: "Failed to fetch scripts" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
