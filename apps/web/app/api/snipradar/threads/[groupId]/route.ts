export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: { groupId: string } }
) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = params;
    if (!groupId) {
      return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
    }

    // Verify that at least one draft in this thread belongs to the user before deleting.
    const owned = await prisma.tweetDraft.findFirst({
      where: { threadGroupId: groupId, userId: user.id },
      select: { id: true },
    });

    if (!owned) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const { count } = await prisma.tweetDraft.deleteMany({
      where: { threadGroupId: groupId, userId: user.id },
    });

    return NextResponse.json({ deleted: count });
  } catch (error) {
    console.error("[SnipRadar Threads] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 });
  }
}
