export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { getCurrentDbUser } from "@/lib/auth";
import { getCurrentSubscriptionState } from "@/lib/billing";
import { refreshPendingRazorpaySubscriptionForUser } from "@/lib/billing/razorpay-subscription-core";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await refreshPendingRazorpaySubscriptionForUser(user.id);

    const state = await getCurrentSubscriptionState(user.id, {
      host: request.headers.get("host"),
      country: request.headers.get("x-vercel-ip-country"),
      locale: request.headers.get("accept-language"),
    });

    return NextResponse.json(state);
  } catch (error) {
    console.error("[Billing] subscription GET error", error);
    return NextResponse.json({ error: "Failed to load subscription." }, { status: 500 });
  }
}
