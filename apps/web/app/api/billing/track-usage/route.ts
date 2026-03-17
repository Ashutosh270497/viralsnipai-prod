export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentDbUser } from "@/lib/auth";
import { incrementUsage } from "@/lib/billing";

const requestSchema = z.object({
  action: z.enum(["viral_fetch", "hook_gen", "scheduled_post", "engagement_opp"]),
  amount: z.number().int().min(1).max(100).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid usage payload" },
        { status: 400 },
      );
    }

    const usage = await incrementUsage(user.id, parsed.data.action, parsed.data.amount ?? 1);
    return NextResponse.json({ success: true, usage });
  } catch (error) {
    console.error("[Billing] track-usage error", error);
    return NextResponse.json({ error: "Failed to update usage." }, { status: 500 });
  }
}
