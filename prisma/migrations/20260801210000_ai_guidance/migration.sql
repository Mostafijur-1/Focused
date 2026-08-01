-- This migration is intentionally replay-safe because Neon may preserve DDL
-- from a failed non-transactional deployment before migration resolution.
BEGIN;

ALTER TABLE "ai_runs"
  ADD COLUMN IF NOT EXISTS "clientRequestId" UUID,
  ADD COLUMN IF NOT EXISTS "locale" VARCHAR(12);

UPDATE "ai_runs"
SET "clientRequestId" = gen_random_uuid(), "locale" = 'bn-BD'
WHERE "clientRequestId" IS NULL OR "locale" IS NULL;

ALTER TABLE "ai_runs"
  ALTER COLUMN "clientRequestId" SET NOT NULL,
  ALTER COLUMN "locale" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ai_runs_userId_clientRequestId_key"
  ON "ai_runs"("userId", "clientRequestId");

ALTER TYPE "AIProposalStatus" ADD VALUE IF NOT EXISTS 'APPLYING';
ALTER TYPE "AIProposalStatus" ADD VALUE IF NOT EXISTS 'APPLY_FAILED';

ALTER TABLE "ai_messages"
  ADD COLUMN IF NOT EXISTS "aiRunId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_messages_aiRunId_fkey'
  ) THEN
    ALTER TABLE "ai_messages"
      ADD CONSTRAINT "ai_messages_aiRunId_fkey"
      FOREIGN KEY ("aiRunId") REFERENCES "ai_runs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ai_messages_aiRunId_idx" ON "ai_messages"("aiRunId");

ALTER TABLE "ai_proposals"
  ADD COLUMN IF NOT EXISTS "editedPatch" JSONB,
  ADD COLUMN IF NOT EXISTS "decisionNote" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "decisionCommandId" UUID,
  ADD COLUMN IF NOT EXISTS "appliedResourceId" UUID,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS "ai_proposals_userId_decisionCommandId_key"
  ON "ai_proposals"("userId", "decisionCommandId");

INSERT INTO "permissions" ("id", "key", "description", "createdAt") VALUES
  (gen_random_uuid(), 'ai:read:own', 'Read the current member private AI conversations, runs, reviews, and proposals.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ai:write:own', 'Create and manage the current member private AI conversations, consent grants, runs, and proposal decisions.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ai:proposal:apply:own', 'Explicitly apply a validated AI proposal through the owning domain use case.', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "roles" role
CROSS JOIN "permissions" permission
WHERE role."key" = 'member'
  AND permission."key" IN (
    'ai:read:own', 'ai:write:own', 'ai:proposal:apply:own'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

COMMIT;
