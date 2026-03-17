/**
 * GET /api/snipradar/assistant/sessions/[id]/messages
 *
 * Returns all messages for a specific chat session, ordered oldest→newest.
 * Ownership is verified — users can only read their own sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  // Verify ownership
  const chatSession = await prisma.snipRadarChatSession.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!chatSession) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await prisma.snipRadarChatMessage.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      sources: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ messages });
}
