export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getBillingPlan, getBillingPlanRazorpayPlanId, resolveBillingPlanId } from "@/config/plans";
import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createRazorpayCustomer,
  createRazorpaySubscriptionRecord,
  fetchRazorpaySubscription,
  getRazorpayPublicConfig,
  getProviderPromoConfig,
  updateSubscriptionRecord,
  validatePromoCode,
  detectBillingRegion,
  ensureSubscriptionBootstrap,
} from "@/lib/billing";

const requestSchema = z.object({
  planId: z.string().min(1),
  billingRegion: z.enum(["IN", "GLOBAL"]).optional(),
  promoCode: z.string().trim().min(2).max(40).optional(),
});

const PENDING_SUBSCRIPTION_STATUSES = new Set(["created", "authenticated", "pending", "active"]);

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid billing payload" },
        { status: 400 },
      );
    }

    const planId = resolveBillingPlanId(parsed.data.planId);
    if (planId === "free") {
      return NextResponse.json({ error: "Free plan does not require checkout." }, { status: 400 });
    }
    const plan = getBillingPlan(planId);

    const provider = getRazorpayPublicConfig();
    if (!provider.configured || !provider.publicKey) {
      return NextResponse.json({ error: "Razorpay billing is not configured." }, { status: 503 });
    }

    await ensureSubscriptionBootstrap(user.id, {
      host: request.headers.get("host"),
      country: request.headers.get("x-vercel-ip-country"),
      locale: request.headers.get("accept-language"),
    });

    const existing = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    const billingRegion =
      parsed.data.billingRegion ??
      detectBillingRegion({
        country: request.headers.get("x-vercel-ip-country"),
        locale: request.headers.get("accept-language"),
        host: request.headers.get("host"),
      });

    const razorpayPlanId = getBillingPlanRazorpayPlanId(planId, billingRegion);
    if (!razorpayPlanId) {
      return NextResponse.json(
        { error: `Missing Razorpay plan mapping for ${plan.name} in ${billingRegion}.` },
        { status: 503 },
      );
    }

    if (existing?.planId === planId && existing.status === "active" && !existing.cancelAtPeriodEnd) {
      return NextResponse.json(
        { error: `You are already on the ${plan.name} plan.` },
        { status: 409 },
      );
    }

    if (existing?.razorpaySubscriptionId && existing.status === "pending" && existing.planId === planId) {
      try {
        const remote = await fetchRazorpaySubscription(existing.razorpaySubscriptionId);
        if (PENDING_SUBSCRIPTION_STATUSES.has(remote.status)) {
          return NextResponse.json({
            provider: "razorpay",
            subscriptionId: remote.id,
            razorpayKeyId: provider.publicKey,
            shortUrl: remote.short_url ?? null,
            reusedPending: true,
          });
        }
      } catch {
        // Create a new subscription below if the remote one no longer exists.
      }
    }

    const promoCode = parsed.data.promoCode?.trim().toUpperCase() || null;
    const promo = promoCode ? await validatePromoCode(promoCode, planId) : null;
    const providerPromo = getProviderPromoConfig(promoCode);

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
      offerId: providerPromo?.razorpayOfferId ?? null,
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
      promoCode: promo?.code ?? null,
    });

    return NextResponse.json({
      provider: "razorpay",
      subscriptionId: subscription.id,
      razorpayKeyId: provider.publicKey,
      shortUrl: subscription.short_url ?? null,
    });
  } catch (error) {
    console.error("[Billing] create-subscription error", error);
    return NextResponse.json({ error: "Failed to create subscription." }, { status: 500 });
  }
}
