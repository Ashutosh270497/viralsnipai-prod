export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/snipradar/accounts/[id]
 * Permanently delete a tracked account and all associated viral tweets
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tracked = await prisma.xTrackedAccount.findFirst({
      where: { id: params.id, userId: user.id },
      include: {
        _count: {
          select: { viralTweets: true },
        },
      },
    });

    if (!tracked) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Hard delete - this will cascade delete all associated viral tweets
    await prisma.xTrackedAccount.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      deletedViralTweets: tracked._count.viralTweets,
    });
  } catch (error) {
    console.error("[SnipRadar Accounts] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to remove tracked account" },
      { status: 500 }
    );
  }
}
