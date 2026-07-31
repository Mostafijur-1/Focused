-- Focused Milestone 5: versioned habits, deterministic occurrences, pauses, corrections, and least-privilege access.

CREATE TYPE "HabitScheduleKind" AS ENUM ('DAILY', 'WEEKDAYS', 'INTERVAL', 'CUSTOM_DATES');
CREATE TYPE "HabitOccurrenceStatus" AS ENUM ('DUE', 'COMPLETED', 'SKIPPED', 'EXCUSED');

ALTER TABLE "habits"
  ADD COLUMN "currentScheduleVersionId" UUID,
  ADD COLUMN "createdByCommandId" UUID;

UPDATE "habits" SET "createdByCommandId" = gen_random_uuid();
ALTER TABLE "habits" ALTER COLUMN "createdByCommandId" SET NOT NULL;
CREATE UNIQUE INDEX "habits_userId_createdByCommandId_key"
  ON "habits"("userId", "createdByCommandId");

CREATE TABLE "habit_schedule_versions" (
  "id" UUID NOT NULL,
  "habitId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "kind" "HabitScheduleKind" NOT NULL,
  "rule" JSONB NOT NULL,
  "targetValue" DECIMAL(18,4),
  "unit" VARCHAR(40),
  "timeZone" VARCHAR(80) NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "habit_schedule_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "habit_schedule_versions_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "habit_schedule_versions_range_check" CHECK (
    "revision" > 0
    AND ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom")
    AND pg_column_size("rule") <= 4096
  )
);

CREATE UNIQUE INDEX "habit_schedule_versions_habitId_revision_key"
  ON "habit_schedule_versions"("habitId", "revision");
CREATE INDEX "habit_schedule_versions_habitId_effectiveFrom_idx"
  ON "habit_schedule_versions"("habitId", "effectiveFrom" DESC);

INSERT INTO "habit_schedule_versions" (
  "id", "habitId", "revision", "kind", "rule", "targetValue", "unit", "timeZone", "effectiveFrom", "createdAt"
)
SELECT
  gen_random_uuid(),
  habit."id",
  1,
  CASE LOWER(COALESCE(habit."schedule" ->> 'type', 'daily'))
    WHEN 'weekdays' THEN 'WEEKDAYS'::"HabitScheduleKind"
    WHEN 'interval' THEN 'INTERVAL'::"HabitScheduleKind"
    WHEN 'custom_dates' THEN 'CUSTOM_DATES'::"HabitScheduleKind"
    ELSE 'DAILY'::"HabitScheduleKind"
  END,
  habit."schedule",
  habit."targetValue",
  habit."unit",
  profile."timeZone",
  habit."startsOn",
  habit."createdAt"
FROM "habits" habit
JOIN "user_profiles" profile ON profile."userId" = habit."userId";

UPDATE "habits" habit
SET "currentScheduleVersionId" = version."id"
FROM "habit_schedule_versions" version
WHERE version."habitId" = habit."id" AND version."revision" = 1;

CREATE UNIQUE INDEX "habits_currentScheduleVersionId_key"
  ON "habits"("currentScheduleVersionId");
ALTER TABLE "habits"
  ADD CONSTRAINT "habits_currentScheduleVersionId_fkey"
  FOREIGN KEY ("currentScheduleVersionId") REFERENCES "habit_schedule_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "habit_pauses" (
  "id" UUID NOT NULL,
  "habitId" UUID NOT NULL,
  "startsOn" DATE NOT NULL,
  "endsOn" DATE,
  "reason" VARCHAR(160),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resumedAt" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "habit_pauses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "habit_pauses_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "habit_pauses_range_check" CHECK (
    "version" > 0
    AND ("endsOn" IS NULL OR "endsOn" >= "startsOn")
    AND (("endsOn" IS NULL AND "resumedAt" IS NULL) OR "endsOn" IS NOT NULL)
  )
);

CREATE INDEX "habit_pauses_habitId_startsOn_idx"
  ON "habit_pauses"("habitId", "startsOn" DESC);
CREATE UNIQUE INDEX "habit_pauses_one_active_idx"
  ON "habit_pauses"("habitId") WHERE "endsOn" IS NULL;

CREATE TABLE "habit_occurrences" (
  "id" UUID NOT NULL,
  "habitId" UUID NOT NULL,
  "scheduleVersionId" UUID NOT NULL,
  "localDate" DATE NOT NULL,
  "timeZone" VARCHAR(80) NOT NULL,
  "targetValue" DECIMAL(18,4),
  "unit" VARCHAR(40),
  "status" "HabitOccurrenceStatus" NOT NULL DEFAULT 'DUE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "habit_occurrences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "habit_occurrences_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "habit_occurrences_scheduleVersionId_fkey" FOREIGN KEY ("scheduleVersionId") REFERENCES "habit_schedule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "habit_occurrences_version_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "habit_occurrences_habitId_localDate_key"
  ON "habit_occurrences"("habitId", "localDate");
CREATE INDEX "habit_occurrences_habitId_status_localDate_idx"
  ON "habit_occurrences"("habitId", "status", "localDate" DESC);
CREATE INDEX "habit_occurrences_localDate_status_idx"
  ON "habit_occurrences"("localDate", "status");

INSERT INTO "habit_occurrences" (
  "id", "habitId", "scheduleVersionId", "localDate", "timeZone", "targetValue", "unit", "status", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  entry."habitId",
  version."id",
  entry."localDate",
  entry."timeZone",
  version."targetValue",
  version."unit",
  CASE
    WHEN entry."skippedReason" IS NOT NULL THEN 'SKIPPED'::"HabitOccurrenceStatus"
    WHEN entry."completed" IS TRUE THEN 'COMPLETED'::"HabitOccurrenceStatus"
    ELSE 'DUE'::"HabitOccurrenceStatus"
  END,
  entry."recordedAt",
  entry."updatedAt"
FROM "habit_entries" entry
JOIN "habit_schedule_versions" version
  ON version."habitId" = entry."habitId" AND version."revision" = 1;

ALTER TABLE "habit_entries"
  ADD COLUMN "occurrenceId" UUID,
  ADD COLUMN "clientCommandId" UUID,
  ADD COLUMN "note" VARCHAR(500),
  ADD COLUMN "evidenceRef" UUID,
  ADD COLUMN "correctedAt" TIMESTAMPTZ(6),
  ADD COLUMN "undoneAt" TIMESTAMPTZ(6);

UPDATE "habit_entries" entry
SET "occurrenceId" = occurrence."id"
FROM "habit_occurrences" occurrence
WHERE occurrence."habitId" = entry."habitId" AND occurrence."localDate" = entry."localDate";

CREATE UNIQUE INDEX "habit_entries_occurrenceId_key"
  ON "habit_entries"("occurrenceId");
CREATE UNIQUE INDEX "habit_entries_habitId_clientCommandId_key"
  ON "habit_entries"("habitId", "clientCommandId");
ALTER TABLE "habit_entries"
  ADD CONSTRAINT "habit_entries_occurrenceId_fkey"
  FOREIGN KEY ("occurrenceId") REFERENCES "habit_occurrences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "habit_entry_revisions" (
  "id" UUID NOT NULL,
  "entryId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "value" DECIMAL(18,4),
  "completed" BOOLEAN,
  "skippedReason" VARCHAR(160),
  "note" VARCHAR(500),
  "evidenceRef" UUID,
  "source" "EntrySource" NOT NULL,
  "clientCommandId" UUID NOT NULL,
  "recordedAt" TIMESTAMPTZ(6) NOT NULL,
  "supersededAt" TIMESTAMPTZ(6),
  "undone" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "habit_entry_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "habit_entry_revisions_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "habit_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "habit_entry_revisions_revision_check" CHECK ("revision" > 0)
);

CREATE UNIQUE INDEX "habit_entry_revisions_entryId_revision_key"
  ON "habit_entry_revisions"("entryId", "revision");
CREATE UNIQUE INDEX "habit_entry_revisions_entryId_clientCommandId_key"
  ON "habit_entry_revisions"("entryId", "clientCommandId");
CREATE INDEX "habit_entry_revisions_entryId_recordedAt_idx"
  ON "habit_entry_revisions"("entryId", "recordedAt" DESC);

INSERT INTO "habit_entry_revisions" (
  "id", "entryId", "revision", "value", "completed", "skippedReason", "source", "clientCommandId", "recordedAt"
)
SELECT
  gen_random_uuid(), entry."id", 1, entry."value", entry."completed", entry."skippedReason", entry."source", gen_random_uuid(), entry."recordedAt"
FROM "habit_entries" entry;

INSERT INTO "permissions" ("id", "key", "description", "createdAt")
VALUES
  (gen_random_uuid(), 'habits:read:own', 'Read the current member habit definitions, occurrences, and history.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'habits:write:own', 'Create and mutate the current member habits and check-ins.', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "roles" role
CROSS JOIN "permissions" permission
WHERE role."key" = 'member'
  AND permission."key" IN ('habits:read:own', 'habits:write:own')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
