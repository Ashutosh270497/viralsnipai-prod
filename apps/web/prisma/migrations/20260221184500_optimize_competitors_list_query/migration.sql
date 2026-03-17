CREATE INDEX IF NOT EXISTS "competitors_userId_isActive_lastChecked_idx"
  ON "competitors"("userId", "isActive", "lastChecked");

CREATE INDEX IF NOT EXISTS "competitors_userId_isActive_createdAt_idx"
  ON "competitors"("userId", "isActive", "createdAt");
