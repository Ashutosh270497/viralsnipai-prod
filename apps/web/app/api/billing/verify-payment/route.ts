export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentDbUser } from "@/lib/auth";
import {
  BillingCoreError,
  RazorpayApiError,
  verifyRazorpayPaymentForUser,
} from "@/lib/billing/razorpay-subscription-core";

const verifySchema = z.object({
  razorpay_payment_id: z.string().min(1).optional(),
  razorpay_subscription_id: z.string().min(1).optional(),
  razorpay_signature: z.string().min(1).optional(),
  razorpayPaymentId: z.string().min(1).optional(),
  razorpaySubscriptionId: z.string().min(1).optional(),
  razorpaySignature: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = verifySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid verification payload." },
        { status: 400 },
      );
    }

    const paymentId = parsed.data.razorpay_payment_id ?? parsed.data.razorpayPaymentId;
    const subscriptionId = parsed.data.razorpay_subscription_id ?? parsed.data.razorpaySubscriptionId;
    const signature = parsed.data.razorpay_signature ?? parsed.data.razorpaySignature;

    if (!paymentId || !subscriptionId || !signature) {
      return NextResponse.json({ error: "Missing Razorpay verification fields." }, { status: 400 });
    }

    const result = await verifyRazorpayPaymentForUser({
      userId: user.id,
      paymentId,
      subscriptionId,
      signature,
    });

    return NextResponse.json({
      success: true,
      plan: result.user.subscriptionTier,
      subscription: result.subscription,
      user: result.user,
    });
  } catch (error) {
    if (error instanceof BillingCoreError || error instanceof RazorpayApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[Billing] verify-payment error", error);
    return NextResponse.json({ error: "Failed to verify Razorpay payment." }, { status: 500 });
  }
}
