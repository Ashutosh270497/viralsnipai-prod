-- CreateTable
CREATE TABLE "x_auto_dm_automations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xAccountId" TEXT NOT NULL,
    "name" TEXT,
    "triggerTweetId" TEXT NOT NULL,
    "triggerTweetUrl" TEXT,
    "triggerTweetText" TEXT,
    "keyword" TEXT,
    "dmTemplate" TEXT NOT NULL,
    "dailyCap" INTEGER NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "lastTriggeredAt" TIMESTAMP(3),
    "lastMatchedReplyAt" TIMESTAMP(3),
    "lastError" TEXT,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "x_auto_dm_automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x_auto_dm_deliveries" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xAccountId" TEXT NOT NULL,
    "sourceReplyTweetId" TEXT NOT NULL,
    "recipientXUserId" TEXT NOT NULL,
    "recipientUsername" TEXT,
    "recipientName" TEXT,
    "replyText" TEXT,
    "matchedKeyword" TEXT,
    "status" TEXT NOT NULL,
    "dmEventId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "x_auto_dm_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "x_auto_dm_automations_userId_isActive_updatedAt_idx" ON "x_auto_dm_automations"("userId", "isActive", "updatedAt");

-- CreateIndex
CREATE INDEX "x_auto_dm_automations_xAccountId_isActive_updatedAt_idx" ON "x_auto_dm_automations"("xAccountId", "isActive", "updatedAt");

-- CreateIndex
CREATE INDEX "x_auto_dm_automations_userId_triggerTweetId_idx" ON "x_auto_dm_automations"("userId", "triggerTweetId");

-- CreateIndex
CREATE INDEX "x_auto_dm_deliveries_automationId_createdAt_idx" ON "x_auto_dm_deliveries"("automationId", "createdAt");

-- CreateIndex
CREATE INDEX "x_auto_dm_deliveries_userId_createdAt_idx" ON "x_auto_dm_deliveries"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "x_auto_dm_deliveries_xAccountId_createdAt_idx" ON "x_auto_dm_deliveries"("xAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "x_auto_dm_deliveries_status_createdAt_idx" ON "x_auto_dm_deliveries"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "x_auto_dm_deliveries_automationId_recipientXUserId_key" ON "x_auto_dm_deliveries"("automationId", "recipientXUserId");

-- AddForeignKey
ALTER TABLE "x_auto_dm_automations" ADD CONSTRAINT "x_auto_dm_automations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x_auto_dm_automations" ADD CONSTRAINT "x_auto_dm_automations_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x_auto_dm_deliveries" ADD CONSTRAINT "x_auto_dm_deliveries_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "x_auto_dm_automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x_auto_dm_deliveries" ADD CONSTRAINT "x_auto_dm_deliveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x_auto_dm_deliveries" ADD CONSTRAINT "x_auto_dm_deliveries_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
