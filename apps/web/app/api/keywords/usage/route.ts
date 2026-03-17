export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildKeywordUsageSnapshot } from "@/lib/keywords/monetization";

/**
 * GET /api/keywords/usage
 * Returns current monthly usage + plan limits for keyword feature packaging.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const snapshot = await buildKeywordUsageSnapshot(session.user.id);
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[Keywords] Usage snapshot error:", error);
    return NextResponse.json(
      { error: "Failed to fetch keyword usage" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
