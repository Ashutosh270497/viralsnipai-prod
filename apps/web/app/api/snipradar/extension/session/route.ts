export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json(
        { authenticated: false, message: "Sign in to SnipRadar in this browser first." },
        { status: 401 }
      );
    }

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, isActive: true },
      select: { id: true, xUsername: true },
    });

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        selectedNiche: user.selectedNiche ?? null,
      },
      snipradar: {
        hasConnectedXAccount: Boolean(xAccount),
        xUsername: xAccount?.xUsername ?? null,
        inboxPath: "/snipradar/inbox",
      },
    });
  } catch (error) {
    console.error("[SnipRadar Extension] Session error:", error);
    return NextResponse.json({ error: "Failed to load extension session", code: "INTERNAL_ERROR", retryable: false }, { status: 500 });
  }
}
