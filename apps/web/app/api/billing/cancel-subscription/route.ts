export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentDbUser } from "@/lib/auth";
import {
  BillingCoreError,
  RazorpayApiError,
  cancelRazorpaySubscriptionForUser,
} from "@/lib/billing/razorpay-subscription-core";

const cancelSchema = z.object({
  subscriptionId: z.string().min(1).optional(),
  cancelAtCycleEnd: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = cancelSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid cancellation request." },
        { status: 400 },
      );
    }

    const result = await cancelRazorpaySubscriptionForUser({
      userId: user.id,
      subscriptionId: parsed.data.subscriptionId ?? null,
      cancelAtCycleEnd: parsed.data.cancelAtCycleEnd ?? true,
    });

    return NextResponse.json({
      success: true,
      subscription: result.subscription,
    });
  } catch (error) {
    if (error instanceof BillingCoreError || error instanceof RazorpayApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[Billing] cancel-subscription error", error);
    return NextResponse.json({ error: "Failed to cancel subscription." }, { status: 500 });
  }
}
