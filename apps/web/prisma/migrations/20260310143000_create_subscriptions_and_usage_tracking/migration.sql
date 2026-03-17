DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'referralCode'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'referredBy'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "referredBy" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'referralCreditGrantedAt'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "referralCreditGrantedAt" TIMESTAMP(3);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");

CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "billingRegion" TEXT NOT NULL DEFAULT 'IN',
    "razorpaySubscriptionId" TEXT,
    "razorpayCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "promoCode" TEXT,
    "freeMonthsCredit" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_userId_key" ON "subscriptions"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_razorpaySubscriptionId_key" ON "subscriptions"("razorpaySubscriptionId");
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "subscriptions_planId_status_idx" ON "subscriptions"("planId", "status");
CREATE INDEX IF NOT EXISTS "subscriptions_billingRegion_status_idx" ON "subscriptions"("billingRegion", "status");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'subscriptions_userId_fkey'
    ) THEN
        ALTER TABLE "subscriptions"
        ADD CONSTRAINT "subscriptions_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "usage_tracking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "viralFetches" INTEGER NOT NULL DEFAULT 0,
    "hookGenerations" INTEGER NOT NULL DEFAULT 0,
    "scheduledPosts" INTEGER NOT NULL DEFAULT 0,
    "engagementOpps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usage_tracking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "usage_tracking_userId_month_key" ON "usage_tracking"("userId", "month");
CREATE INDEX IF NOT EXISTS "usage_tracking_month_idx" ON "usage_tracking"("month");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'usage_tracking_userId_fkey'
    ) THEN
        ALTER TABLE "usage_tracking"
        ADD CONSTRAINT "usage_tracking_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
