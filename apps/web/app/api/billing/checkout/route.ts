export const dynamic = "force-dynamic";
export const revalidate = 0;

// Legacy compatibility endpoint. Active billing uses /api/billing/create-subscription.

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentDbUser } from "@/lib/auth";
import { getBillingPlan, resolveBillingPlanId } from "@/config/plans";
import { prisma } from "@/lib/prisma";
import { BillingCycle, SupportedCurrency } from "@/lib/billing/plans";
import {
  createRazorpayCustomer,
  createRazorpaySubscriptionRecord,
  fetchRazorpaySubscription,
  getRazorpayPublicConfig,
  RazorpayApiError,
} from "@/lib/billing/razorpay";
import {
  detectBillingRegion,
  ensureSubscriptionBootstrap,
  updateSubscriptionRecord,
} from "@/lib/billing/subscriptions";
import { serializeSubscriptionForClient } from "@/lib/billing/service";

const checkoutSchema = z.object({
  planId: z.enum(["starter", "creator", "studio", "plus", "pro"]),
  billingCycle: z.enum(["monthly", "yearly"] satisfies [BillingCycle, ...BillingCycle[]]).optional(),
  currency: z.enum(["USD", "INR"] satisfies [SupportedCurrency, ...SupportedCurrency[]]),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user?.id || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = checkoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid checkout request." },
        { status: 400 },
      );
    }

    if (parsed.data.billingCycle === "yearly") {
      return NextResponse.json(
        { error: "Yearly billing is not available in the Razorpay-only monthly cutover." },
        { status: 400 },
      );
    }

    const provider = getRazorpayPublicConfig();
    if (!provider.configured || !provider.publicKey) {
      return NextResponse.json(
        {
          error: "Razorpay billing is not configured.",
          missingEnvKeys: provider.missingEnvKeys,
        },
        { status: 503 },
      );
    }

    await ensureSubscriptionBootstrap(user.id, {
      host: request.headers.get("host"),
      country: request.headers.get("x-vercel-ip-country"),
      locale: request.headers.get("accept-language"),
    });

    const existing = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    const planId = resolveBillingPlanId(parsed.data.planId);
    const plan = getBillingPlan(planId);
    const billingRegion =
      parsed.data.currency === "INR"
        ? "IN"
        : detectBillingRegion({
            country: request.headers.get("x-vercel-ip-country"),
            locale: request.headers.get("accept-language"),
            host: request.headers.get("host"),
          });

    if (existing?.planId === planId && existing.status === "active" && !existing.cancelAtPeriodEnd) {
      return NextResponse.json(
        { error: `You are already on the ${plan.name} plan.` },
        { status: 409 },
      );
    }

    if (existing?.razorpaySubscriptionId && existing.status === "pending" && existing.planId === planId) {
      try {
        const remote = await fetchRazorpaySubscription(existing.razorpaySubscriptionId);
        if (["created", "authenticated", "pending", "active"].includes(remote.status)) {
          return NextResponse.json({
            publicKey: provider.publicKey,
            subscription: serializeSubscriptionForClient(remote),
          });
        }
      } catch {
        // Fall through and create a new subscription if the remote one no longer exists.
      }
    }

    const customerId =
      existing?.razorpayCustomerId ??
      (
        await createRazorpayCustomer({
          email: user.email,
          name: user.name ?? undefined,
          userId: user.id,
        })
      ).id;

    const subscription = await createRazorpaySubscriptionRecord({
      planId,
      billingRegion,
      customerId,
      userId: user.id,
      email: user.email,
      name: user.name ?? undefined,
      totalCount: 120,
    });

    await updateSubscriptionRecord(user.id, {
      planId,
      status: "pending",
      billingRegion,
      razorpayCustomerId: customerId,
      razorpaySubscriptionId: subscription.id,
      currentPeriodStart: subscription.current_start ? new Date(subscription.current_start * 1000) : null,
      currentPeriodEnd: subscription.current_end ? new Date(subscription.current_end * 1000) : null,
      cancelAtPeriodEnd: false,
    });

    return NextResponse.json({
      publicKey: provider.publicKey,
      subscription: serializeSubscriptionForClient(subscription),
    });
  } catch (error) {
    if (error instanceof RazorpayApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[Billing] Checkout creation failed:", error);
    return NextResponse.json({ error: "Failed to create Razorpay checkout." }, { status: 500 });
  }
}
