export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { getCurrentDbUser } from "@/lib/auth";
import { processAutoDmAutomations } from "@/lib/snipradar/auto-dm";
import { readEnvFeatureFlags } from "@/lib/feature-flags";

export async function POST() {
  if (!readEnvFeatureFlags().autoDmEnabled) {
    return NextResponse.json({ error: "Feature not available" }, { status: 403 });
  }
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
