/**
 * GET /api/snipradar/assistant/sessions
 * Returns the last 20 chat sessions for the current user (for the sidebar history list).
 *
 * DELETE /api/snipradar/assistant/sessions?id=<sessionId>
 * Deletes a specific session and all its messages.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await prisma.snipRadarChatSession.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({ sessions });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Session id required" }, { status: 400 });
  }

  // Verify ownership before delete
  const chatSession = await prisma.snipRadarChatSession.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!chatSession) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.snipRadarChatSession.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
