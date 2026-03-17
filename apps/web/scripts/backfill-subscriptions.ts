import { prisma } from "@/lib/prisma";
import { resolveBillingPlanId } from "@/config/plans";

function normalizeStatus(value: string | null | undefined) {
  if (value === "paused" || value === "cancelled" || value === "pending" || value === "trialing") {
    return value;
  }
  return "active";
}

function inferBillingRegion(user: {
  billingProvider: string | null;
  stripeCustomerId: string | null;
}) {
  if (user.billingProvider?.toLowerCase() === "stripe" || user.stripeCustomerId) {
    return "GLOBAL";
  }
  return "IN";
}

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      plan: true,
      subscriptionTier: true,
      subscriptionStatus: true,
      billingProvider: true,
      subscriptionCurrentStart: true,
      subscriptionCurrentEnd: true,
      subscriptionCancelAtPeriodEnd: true,
      razorpayCustomerId: true,
      razorpaySubscriptionId: true,
      stripeCustomerId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let migrated = 0;
  let created = 0;
  let updated = 0;

  for (const user of users) {
    const existing = await prisma.subscription.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    const planId = resolveBillingPlanId(user.subscriptionTier || user.plan || "free");
    const status = normalizeStatus(user.subscriptionStatus);
    const billingRegion = inferBillingRegion(user);

    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {
        planId,
        status,
        billingRegion,
        razorpayCustomerId: user.razorpayCustomerId ?? null,
        razorpaySubscriptionId: user.razorpaySubscriptionId ?? null,
        stripeCustomerId: user.stripeCustomerId ?? null,
        currentPeriodStart: user.subscriptionCurrentStart ?? null,
        currentPeriodEnd: user.subscriptionCurrentEnd ?? null,
        cancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd,
      },
      create: {
        userId: user.id,
        planId,
        status,
        billingRegion,
        razorpayCustomerId: user.razorpayCustomerId ?? null,
        razorpaySubscriptionId: user.razorpaySubscriptionId ?? null,
        stripeCustomerId: user.stripeCustomerId ?? null,
        currentPeriodStart: user.subscriptionCurrentStart ?? null,
        currentPeriodEnd: user.subscriptionCurrentEnd ?? null,
        cancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd,
      },
    });

    migrated += 1;
    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  console.log(JSON.stringify({ migrated, created, updated }, null, 2));
}

main()
  .catch((error) => {
    console.error("[Billing] backfill-subscriptions failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
