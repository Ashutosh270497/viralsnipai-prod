DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'billingProvider'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "billingProvider" TEXT NOT NULL DEFAULT 'razorpay';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'razorpayCustomerId'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "razorpayCustomerId" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'razorpaySubscriptionId'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "razorpaySubscriptionId" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'billingCycle'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "billingCycle" TEXT NOT NULL DEFAULT 'monthly';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'subscriptionCurrentStart'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "subscriptionCurrentStart" TIMESTAMP(3);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'subscriptionCurrentEnd'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "subscriptionCurrentEnd" TIMESTAMP(3);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'subscriptionCancelAtPeriodEnd'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "subscriptionCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "razorpay_webhook_events" (
    "id" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "razorpaySubscriptionId" TEXT,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "razorpay_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "razorpay_webhook_events_providerEventId_key"
ON "razorpay_webhook_events"("providerEventId");

CREATE INDEX IF NOT EXISTS "razorpay_webhook_events_userId_createdAt_idx"
ON "razorpay_webhook_events"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "razorpay_webhook_events_razorpaySubscriptionId_createdAt_idx"
ON "razorpay_webhook_events"("razorpaySubscriptionId", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'razorpay_webhook_events_userId_fkey'
    ) THEN
        ALTER TABLE "razorpay_webhook_events"
        ADD CONSTRAINT "razorpay_webhook_events_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

