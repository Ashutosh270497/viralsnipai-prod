export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { getCurrentDbUser } from "@/lib/auth";
import { processAutoDmAutomations } from "@/lib/snipradar/auto-dm";

export async function POST() {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await processAutoDmAutomations({
      source: "api_user",
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[SnipRadar Auto-DM] Process error:", error);
    return NextResponse.json({ error: "Failed to process Auto-DM automations" }, { status: 500 });
  }
}
