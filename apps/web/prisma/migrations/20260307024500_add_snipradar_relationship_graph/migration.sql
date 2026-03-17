ALTER TABLE "x_engagement_opportunities"
ADD COLUMN IF NOT EXISTS "authorXUserId" TEXT;

CREATE TABLE IF NOT EXISTS "x_relationship_leads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackedAccountId" TEXT,
    "xUserId" TEXT,
    "username" TEXT NOT NULL,
    "normalizedHandle" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "followerCount" INTEGER,
    "stage" TEXT NOT NULL DEFAULT 'new',
    "source" TEXT NOT NULL DEFAULT 'engagement',
    "personaTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "nextAction" TEXT,
    "followUpAt" TIMESTAMP(3),
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "savedOpportunityCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "inboxCaptureCount" INTEGER NOT NULL DEFAULT 0,
    "trackedAt" TIMESTAMP(3),
    "lastInteractionAt" TIMESTAMP(3),
    "lastReplyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "x_relationship_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "x_relationship_interactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "trackedAccountId" TEXT,
    "opportunityId" TEXT,
    "inboxItemId" TEXT,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'x',
    "summary" TEXT NOT NULL,
    "content" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "x_relationship_interactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "x_relationship_leads_userId_normalizedHandle_key"
  ON "x_relationship_leads"("userId", "normalizedHandle");
CREATE UNIQUE INDEX IF NOT EXISTS "x_relationship_leads_trackedAccountId_key"
  ON "x_relationship_leads"("trackedAccountId");
CREATE INDEX IF NOT EXISTS "x_relationship_leads_userId_stage_priorityScore_idx"
  ON "x_relationship_leads"("userId", "stage", "priorityScore");
CREATE INDEX IF NOT EXISTS "x_relationship_leads_userId_followUpAt_idx"
  ON "x_relationship_leads"("userId", "followUpAt");
CREATE INDEX IF NOT EXISTS "x_relationship_leads_userId_lastInteractionAt_idx"
  ON "x_relationship_leads"("userId", "lastInteractionAt");

CREATE INDEX IF NOT EXISTS "x_relationship_interactions_userId_leadId_createdAt_idx"
  ON "x_relationship_interactions"("userId", "leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "x_relationship_interactions_leadId_createdAt_idx"
  ON "x_relationship_interactions"("leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "x_relationship_interactions_trackedAccountId_idx"
  ON "x_relationship_interactions"("trackedAccountId");
CREATE INDEX IF NOT EXISTS "x_relationship_interactions_opportunityId_idx"
  ON "x_relationship_interactions"("opportunityId");
CREATE INDEX IF NOT EXISTS "x_relationship_interactions_inboxItemId_idx"
  ON "x_relationship_interactions"("inboxItemId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'x_relationship_leads_userId_fkey'
    ) THEN
        ALTER TABLE "x_relationship_leads"
        ADD CONSTRAINT "x_relationship_leads_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'x_relationship_leads_trackedAccountId_fkey'
    ) THEN
        ALTER TABLE "x_relationship_leads"
        ADD CONSTRAINT "x_relationship_leads_trackedAccountId_fkey"
        FOREIGN KEY ("trackedAccountId") REFERENCES "x_tracked_accounts"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'x_relationship_interactions_userId_fkey'
    ) THEN
        ALTER TABLE "x_relationship_interactions"
        ADD CONSTRAINT "x_relationship_interactions_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'x_relationship_interactions_leadId_fkey'
    ) THEN
        ALTER TABLE "x_relationship_interactions"
        ADD CONSTRAINT "x_relationship_interactions_leadId_fkey"
        FOREIGN KEY ("leadId") REFERENCES "x_relationship_leads"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'x_relationship_interactions_trackedAccountId_fkey'
    ) THEN
        ALTER TABLE "x_relationship_interactions"
        ADD CONSTRAINT "x_relationship_interactions_trackedAccountId_fkey"
        FOREIGN KEY ("trackedAccountId") REFERENCES "x_tracked_accounts"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'x_relationship_interactions_opportunityId_fkey'
    ) THEN
        ALTER TABLE "x_relationship_interactions"
        ADD CONSTRAINT "x_relationship_interactions_opportunityId_fkey"
        FOREIGN KEY ("opportunityId") REFERENCES "x_engagement_opportunities"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'x_relationship_interactions_inboxItemId_fkey'
    ) THEN
        ALTER TABLE "x_relationship_interactions"
        ADD CONSTRAINT "x_relationship_interactions_inboxItemId_fkey"
        FOREIGN KEY ("inboxItemId") REFERENCES "x_research_inbox_items"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
