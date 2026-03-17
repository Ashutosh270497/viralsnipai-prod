export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import {
  BillingCoreError,
  RazorpayApiError,
  processRazorpayWebhook,
} from "@/lib/billing/razorpay-subscription-core";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const result = await processRazorpayWebhook({
      rawBody,
      signature: request.headers.get("x-razorpay-signature"),
      providerEventId: request.headers.get("x-razorpay-event-id"),
    });

    return NextResponse.json({ ok: true, duplicate: result.duplicate }, { status: 200 });
  } catch (error) {
    if (error instanceof BillingCoreError || error instanceof RazorpayApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }

    console.error("[Billing] Razorpay webhook processing failed:", error);
    return NextResponse.json({ error: "Failed to process Razorpay webhook." }, { status: 500 });
  }
}
