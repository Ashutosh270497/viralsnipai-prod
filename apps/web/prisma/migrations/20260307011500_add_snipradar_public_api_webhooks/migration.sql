CREATE TABLE IF NOT EXISTS "snipradar_api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastFour" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snipradar_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "snipradar_webhook_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "signingSecretCiphertext" TEXT NOT NULL,
    "signingSecretPreview" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastDeliveredAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastFailureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snipradar_webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "snipradar_webhook_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snipradar_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "snipradar_webhook_deliveries" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "responseStatus" INTEGER,
    "durationMs" INTEGER,
    "responseBodyPreview" TEXT,
    "errorMessage" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snipradar_webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "snipradar_api_keys_keyHash_key" ON "snipradar_api_keys"("keyHash");
CREATE INDEX IF NOT EXISTS "snipradar_api_keys_userId_isActive_createdAt_idx" ON "snipradar_api_keys"("userId", "isActive", "createdAt");

CREATE INDEX IF NOT EXISTS "snipradar_webhook_subscriptions_userId_isActive_createdAt_idx" ON "snipradar_webhook_subscriptions"("userId", "isActive", "createdAt");

CREATE INDEX IF NOT EXISTS "snipradar_webhook_events_userId_eventType_createdAt_idx" ON "snipradar_webhook_events"("userId", "eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "snipradar_webhook_events_userId_createdAt_idx" ON "snipradar_webhook_events"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "snipradar_webhook_events_resourceType_resourceId_createdAt_idx" ON "snipradar_webhook_events"("resourceType", "resourceId", "createdAt");

CREATE INDEX IF NOT EXISTS "snipradar_webhook_deliveries_subscriptionId_createdAt_idx" ON "snipradar_webhook_deliveries"("subscriptionId", "createdAt");
CREATE INDEX IF NOT EXISTS "snipradar_webhook_deliveries_eventId_createdAt_idx" ON "snipradar_webhook_deliveries"("eventId", "createdAt");
CREATE INDEX IF NOT EXISTS "snipradar_webhook_deliveries_status_createdAt_idx" ON "snipradar_webhook_deliveries"("status", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'snipradar_api_keys_userId_fkey'
    ) THEN
        ALTER TABLE "snipradar_api_keys"
        ADD CONSTRAINT "snipradar_api_keys_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'snipradar_webhook_subscriptions_userId_fkey'
    ) THEN
        ALTER TABLE "snipradar_webhook_subscriptions"
        ADD CONSTRAINT "snipradar_webhook_subscriptions_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'snipradar_webhook_events_userId_fkey'
    ) THEN
        ALTER TABLE "snipradar_webhook_events"
        ADD CONSTRAINT "snipradar_webhook_events_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'snipradar_webhook_deliveries_eventId_fkey'
    ) THEN
        ALTER TABLE "snipradar_webhook_deliveries"
        ADD CONSTRAINT "snipradar_webhook_deliveries_eventId_fkey"
        FOREIGN KEY ("eventId") REFERENCES "snipradar_webhook_events"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'snipradar_webhook_deliveries_subscriptionId_fkey'
    ) THEN
        ALTER TABLE "snipradar_webhook_deliveries"
        ADD CONSTRAINT "snipradar_webhook_deliveries_subscriptionId_fkey"
        FOREIGN KEY ("subscriptionId") REFERENCES "snipradar_webhook_subscriptions"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
