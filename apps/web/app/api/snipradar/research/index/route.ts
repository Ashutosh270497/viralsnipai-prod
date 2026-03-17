export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { getCurrentDbUser } from "@/lib/auth";
import { ensureResearchIndex, getResearchIndexStatus } from "@/lib/snipradar/research";

export async function GET() {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await getResearchIndexStatus(user.id);
    return NextResponse.json(status);
  } catch (error) {
    console.error("[SnipRadar][Research] Status fetch failed", error);
    return NextResponse.json({ error: "Failed to load research index status" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await ensureResearchIndex({
      userId: user.id,
      selectedNiche: user.selectedNiche,
      force: true,
    });

    return NextResponse.json(status);
  } catch (error) {
    console.error("[SnipRadar][Research] Manual reindex failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to rebuild research corpus",
      },
      { status: 500 }
    );
  }
}
