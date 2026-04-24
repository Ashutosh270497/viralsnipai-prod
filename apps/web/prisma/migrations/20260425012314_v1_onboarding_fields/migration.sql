-- V1 onboarding + project context fields.
--
-- All new columns are nullable TEXT. No defaults, no NOT NULL constraints,
-- no changes to existing columns — this migration CANNOT lose data.
--
-- New User fields capture who the creator is, where they publish, and what
-- outcome they want. New Project fields carry the same per-project context
-- so clip selection and exports can optimise for the right platform/goal.

-- User: creator type, primary platform, content goal
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "creatorType" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "primaryPlatform" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "contentGoal" TEXT;

-- Project: target platform + content goal (per project overrides)
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "targetPlatform" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "contentGoal" TEXT;
