-- Focused Milestone 6: private goals, measurable progress, Life Vision revisions, and weekly planning.

CREATE TYPE "GoalProgressMode" AS ENUM ('MANUAL', 'MILESTONES', 'KEY_RESULTS');
CREATE TYPE "GoalLinkType" AS ENUM ('VISION_AREA', 'PLAN_ITEM', 'HABIT', 'LEARNING_ITEM', 'FOCUS_SESSION');
CREATE TYPE "LifeVisionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "goals"
  ADD COLUMN "priority" SMALLINT NOT NULL DEFAULT 2,
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "progressMode" "GoalProgressMode" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "manualProgress" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "createdByCommandId" UUID,
  ADD COLUMN "achievedAt" TIMESTAMPTZ(6),
  ADD COLUMN "abandonedAt" TIMESTAMPTZ(6),
  ADD COLUMN "archivedAt" TIMESTAMPTZ(6);

UPDATE "goals" SET "achievedAt" = "updatedAt" WHERE "status" = 'ACHIEVED';
UPDATE "goals" SET "abandonedAt" = "updatedAt" WHERE "status" = 'ABANDONED';
UPDATE "goals" SET "archivedAt" = "updatedAt" WHERE "status" = 'ARCHIVED';

ALTER TABLE "goals" ADD CONSTRAINT "goals_policy_check" CHECK (
    "priority" BETWEEN 1 AND 3
    AND "position" >= 0
    AND "manualProgress" BETWEEN 0 AND 100
    AND (("targetValue" IS NULL AND "targetUnit" IS NULL) OR ("targetValue" > 0 AND length(trim("targetUnit")) > 0))
    AND (("status" = 'ACHIEVED' AND "achievedAt" IS NOT NULL) OR "status" <> 'ACHIEVED')
    AND (("status" = 'ABANDONED' AND "abandonedAt" IS NOT NULL) OR "status" <> 'ABANDONED')
    AND (("status" = 'ARCHIVED' AND "archivedAt" IS NOT NULL) OR "status" <> 'ARCHIVED')
  );

CREATE UNIQUE INDEX "goals_userId_createdByCommandId_key"
  ON "goals"("userId", "createdByCommandId");
CREATE INDEX "goals_userId_archivedAt_priority_position_idx"
  ON "goals"("userId", "archivedAt", "priority", "position");

ALTER TABLE "milestones"
  ADD COLUMN "weight" DECIMAL(8,4) NOT NULL DEFAULT 1,
  ADD COLUMN "clientCommandId" UUID,
  ADD CONSTRAINT "milestones_policy_check" CHECK ("weight" > 0 AND "position" >= 0 AND "version" > 0);
CREATE UNIQUE INDEX "milestones_goalId_clientCommandId_key" ON "milestones"("goalId", "clientCommandId");

CREATE TABLE "goal_key_results" (
  "id" UUID NOT NULL,
  "goalId" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "targetValue" DECIMAL(18,4) NOT NULL,
  "currentValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "unit" VARCHAR(40) NOT NULL,
  "weight" DECIMAL(8,4) NOT NULL DEFAULT 1,
  "position" INTEGER NOT NULL,
  "clientCommandId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "goal_key_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goal_key_results_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "goal_key_results_policy_check" CHECK (
    "targetValue" > 0 AND "currentValue" >= 0 AND "weight" > 0 AND "position" >= 0 AND "version" > 0
  )
);
CREATE UNIQUE INDEX "goal_key_results_goalId_position_key" ON "goal_key_results"("goalId", "position");
CREATE UNIQUE INDEX "goal_key_results_goalId_clientCommandId_key" ON "goal_key_results"("goalId", "clientCommandId");
CREATE INDEX "goal_key_results_goalId_idx" ON "goal_key_results"("goalId");

CREATE TABLE "goal_check_ins" (
  "id" UUID NOT NULL,
  "goalId" UUID NOT NULL,
  "clientCommandId" UUID NOT NULL,
  "progress" DECIMAL(5,2) NOT NULL,
  "value" DECIMAL(18,4),
  "note" VARCHAR(1000),
  "evidenceRef" UUID,
  "source" "EntrySource" NOT NULL DEFAULT 'MANUAL',
  "recordedAt" TIMESTAMPTZ(6) NOT NULL,
  "targetSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goal_check_ins_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goal_check_ins_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "goal_check_ins_policy_check" CHECK (
    "progress" BETWEEN 0 AND 100 AND ("value" IS NULL OR "value" >= 0) AND pg_column_size("targetSnapshot") <= 4096
  )
);
CREATE UNIQUE INDEX "goal_check_ins_goalId_clientCommandId_key" ON "goal_check_ins"("goalId", "clientCommandId");
CREATE INDEX "goal_check_ins_goalId_recordedAt_id_idx" ON "goal_check_ins"("goalId", "recordedAt" DESC, "id" DESC);

CREATE TABLE "goal_links" (
  "id" UUID NOT NULL,
  "goalId" UUID NOT NULL,
  "type" "GoalLinkType" NOT NULL,
  "resourceId" UUID NOT NULL,
  "label" VARCHAR(160),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goal_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goal_links_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "goal_links_goalId_type_resourceId_key" ON "goal_links"("goalId", "type", "resourceId");
CREATE INDEX "goal_links_type_resourceId_idx" ON "goal_links"("type", "resourceId");

CREATE TABLE "goal_status_transitions" (
  "id" UUID NOT NULL,
  "goalId" UUID NOT NULL,
  "fromStatus" "GoalStatus",
  "toStatus" "GoalStatus" NOT NULL,
  "reason" VARCHAR(500),
  "clientCommandId" UUID NOT NULL,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "goal_status_transitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goal_status_transitions_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "goal_status_transitions_goalId_clientCommandId_key" ON "goal_status_transitions"("goalId", "clientCommandId");
CREATE INDEX "goal_status_transitions_goalId_occurredAt_idx" ON "goal_status_transitions"("goalId", "occurredAt" DESC);

ALTER TABLE "life_visions"
  ADD COLUMN "status" "LifeVisionStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "clientCommandId" UUID,
  ADD COLUMN "publishedByCommandId" UUID,
  ADD COLUMN "publishedAt" TIMESTAMPTZ(6),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "life_visions_policy_check" CHECK (
    "revision" > 0 AND "version" > 0
    AND pg_column_size("values") <= 8192
    AND pg_column_size("antiGoals") <= 8192
    AND (("status" = 'PUBLISHED' AND "publishedAt" IS NOT NULL) OR "status" <> 'PUBLISHED')
  );
CREATE UNIQUE INDEX "life_visions_userId_clientCommandId_key" ON "life_visions"("userId", "clientCommandId");
CREATE UNIQUE INDEX "life_visions_userId_publishedByCommandId_key" ON "life_visions"("userId", "publishedByCommandId");

ALTER TABLE "plans"
  ADD COLUMN "fixedCommitments" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "reflection" VARCHAR(2000),
  ADD COLUMN "clientCommandId" UUID,
  ADD COLUMN "finalizedAt" TIMESTAMPTZ(6);

UPDATE "plans" SET "finalizedAt" = "updatedAt" WHERE "status" = 'ACTIVE';
UPDATE "plans" SET "closedAt" = "updatedAt" WHERE "status" = 'CLOSED' AND "closedAt" IS NULL;

ALTER TABLE "plans" ADD CONSTRAINT "plans_milestone6_policy_check" CHECK (
    "version" > 0
    AND "periodEnd" >= "periodStart"
    AND ("capacityMinutes" IS NULL OR "capacityMinutes" >= 0)
    AND pg_column_size("notDoing") <= 8192
    AND pg_column_size("fixedCommitments") <= 16384
    AND (("status" = 'ACTIVE' AND "finalizedAt" IS NOT NULL) OR "status" <> 'ACTIVE')
    AND (("status" = 'CLOSED' AND "closedAt" IS NOT NULL) OR "status" <> 'CLOSED')
  );
CREATE UNIQUE INDEX "plans_userId_type_clientCommandId_key" ON "plans"("userId", "type", "clientCommandId");

INSERT INTO "permissions" ("id", "key", "description", "createdAt")
VALUES
  (gen_random_uuid(), 'goals:read:own', 'Read the current member private goals, progress, links, and history.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'goals:write:own', 'Create and mutate the current member private goals and check-ins.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'life_vision:read:own', 'Read the current member private Life Vision revisions.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'life_vision:write:own', 'Create and publish the current member private Life Vision revisions.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'weekly_plans:read:own', 'Read the current member weekly plans.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'weekly_plans:write:own', 'Create, finalize, and close the current member weekly plans.', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "roles" role
CROSS JOIN "permissions" permission
WHERE role."key" = 'member'
  AND permission."key" IN (
    'goals:read:own', 'goals:write:own',
    'life_vision:read:own', 'life_vision:write:own',
    'weekly_plans:read:own', 'weekly_plans:write:own'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
