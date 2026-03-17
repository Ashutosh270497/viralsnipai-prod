export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = await prisma.snipRadarApiKey.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true },
    });

    if (!apiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    await prisma.snipRadarApiKey.update({
      where: { id: apiKey.id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SnipRadar Developer Keys] DELETE error:", error);
    return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 });
  }
}
