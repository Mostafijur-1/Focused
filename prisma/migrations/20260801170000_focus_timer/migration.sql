-- Focused Milestone 7: authoritative Focus Timer and Pomodoro execution.

BEGIN;

CREATE TYPE "FocusIntervalKind" AS ENUM ('FOCUS', 'SHORT_BREAK', 'LONG_BREAK');
CREATE TYPE "FocusIntervalStatus" AS ENUM ('RUNNING', 'PAUSED', 'COMPLETED', 'SKIPPED');
CREATE TYPE "FocusCommandType" AS ENUM ('PAUSE', 'RESUME', 'EXTEND', 'COMPLETE', 'ABANDON', 'INTERRUPTION', 'ADVANCE_INTERVAL');

CREATE TABLE "pomodoro_presets" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "focusSeconds" INTEGER NOT NULL,
  "shortBreakSeconds" INTEGER NOT NULL,
  "longBreakSeconds" INTEGER NOT NULL,
  "cycles" INTEGER NOT NULL DEFAULT 4,
  "longBreakEvery" INTEGER NOT NULL DEFAULT 4,
  "autoStartBreaks" BOOLEAN NOT NULL DEFAULT false,
  "autoStartFocus" BOOLEAN NOT NULL DEFAULT false,
  "audioEnabled" BOOLEAN NOT NULL DEFAULT true,
  "vibrationEnabled" BOOLEAN NOT NULL DEFAULT false,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdByCommandId" UUID NOT NULL,
  "archivedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "pomodoro_presets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pomodoro_presets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "pomodoro_presets_policy_check" CHECK (
    "focusSeconds" BETWEEN 60 AND 10800
    AND "shortBreakSeconds" BETWEEN 60 AND 3600
    AND "longBreakSeconds" BETWEEN 60 AND 7200
    AND "cycles" BETWEEN 1 AND 12
    AND "longBreakEvery" BETWEEN 1 AND 12
    AND "version" > 0
  )
);
CREATE UNIQUE INDEX "pomodoro_presets_userId_createdByCommandId_key" ON "pomodoro_presets"("userId", "createdByCommandId");
CREATE INDEX "pomodoro_presets_userId_archivedAt_isDefault_idx" ON "pomodoro_presets"("userId", "archivedAt", "isDefault");
CREATE UNIQUE INDEX "pomodoro_presets_one_default_per_user_idx" ON "pomodoro_presets"("userId") WHERE "isDefault" = true AND "archivedAt" IS NULL;

ALTER TABLE "focus_sessions"
  ADD COLUMN "pomodoroPresetId" UUID,
  ADD COLUMN "clientCommandId" UUID,
  ADD COLUMN "completedFocusSeconds" INTEGER,
  ADD COLUMN "timeZone" VARCHAR(80),
  ADD COLUMN "pomodoroConfig" JSONB;
UPDATE "focus_sessions"
SET "clientCommandId" = gen_random_uuid(), "timeZone" = 'UTC'
WHERE "clientCommandId" IS NULL OR "timeZone" IS NULL;
ALTER TABLE "focus_sessions"
  ALTER COLUMN "clientCommandId" SET NOT NULL,
  ALTER COLUMN "timeZone" SET NOT NULL,
  ADD CONSTRAINT "focus_sessions_pomodoroPresetId_fkey" FOREIGN KEY ("pomodoroPresetId") REFERENCES "pomodoro_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "focus_sessions_completed_focus_check" CHECK ("completedFocusSeconds" IS NULL OR "completedFocusSeconds" >= 0),
  ADD CONSTRAINT "focus_sessions_pomodoro_config_check" CHECK (("kind" = 'POMODORO' AND "pomodoroConfig" IS NOT NULL) OR ("kind" <> 'POMODORO' AND "pomodoroConfig" IS NULL));
CREATE UNIQUE INDEX "focus_sessions_userId_clientCommandId_key" ON "focus_sessions"("userId", "clientCommandId");
CREATE INDEX "focus_sessions_pomodoroPresetId_idx" ON "focus_sessions"("pomodoroPresetId");

CREATE TABLE "focus_intervals" (
  "id" UUID NOT NULL,
  "focusSessionId" UUID NOT NULL,
  "kind" "FocusIntervalKind" NOT NULL,
  "status" "FocusIntervalStatus" NOT NULL DEFAULT 'RUNNING',
  "cycleNumber" INTEGER NOT NULL DEFAULT 1,
  "plannedSeconds" INTEGER NOT NULL,
  "startedAt" TIMESTAMPTZ(6) NOT NULL,
  "endedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "focus_intervals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "focus_intervals_focusSessionId_fkey" FOREIGN KEY ("focusSessionId") REFERENCES "focus_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "focus_intervals_policy_check" CHECK (
    "plannedSeconds" BETWEEN 60 AND 43200 AND "cycleNumber" BETWEEN 1 AND 12 AND "version" > 0
    AND (("status" IN ('COMPLETED', 'SKIPPED') AND "endedAt" IS NOT NULL) OR ("status" IN ('RUNNING', 'PAUSED') AND "endedAt" IS NULL))
  )
);
CREATE INDEX "focus_intervals_focusSessionId_startedAt_idx" ON "focus_intervals"("focusSessionId", "startedAt");
CREATE UNIQUE INDEX "focus_intervals_one_active_per_session_idx" ON "focus_intervals"("focusSessionId") WHERE "status" IN ('RUNNING', 'PAUSED');

INSERT INTO "focus_intervals" (
  "id", "focusSessionId", "kind", "status", "cycleNumber", "plannedSeconds", "startedAt", "endedAt", "updatedAt"
)
SELECT
  gen_random_uuid(), "id", 'FOCUS'::"FocusIntervalKind",
  CASE
    WHEN "status" = 'RUNNING' THEN 'RUNNING'::"FocusIntervalStatus"
    WHEN "status" = 'PAUSED' THEN 'PAUSED'::"FocusIntervalStatus"
    ELSE 'COMPLETED'::"FocusIntervalStatus"
  END,
  1, "plannedSeconds", "startedAt", COALESCE("completedAt", "abandonedAt"), "updatedAt"
FROM "focus_sessions";

CREATE TABLE "focus_session_commands" (
  "id" UUID NOT NULL,
  "focusSessionId" UUID NOT NULL,
  "clientCommandId" UUID NOT NULL,
  "type" "FocusCommandType" NOT NULL,
  "resultVersion" INTEGER NOT NULL,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "focus_session_commands_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "focus_session_commands_focusSessionId_fkey" FOREIGN KEY ("focusSessionId") REFERENCES "focus_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "focus_session_commands_result_version_check" CHECK ("resultVersion" > 0)
);
CREATE UNIQUE INDEX "focus_session_commands_focusSessionId_clientCommandId_key" ON "focus_session_commands"("focusSessionId", "clientCommandId");
CREATE INDEX "focus_session_commands_focusSessionId_occurredAt_idx" ON "focus_session_commands"("focusSessionId", "occurredAt");

ALTER TABLE "session_pauses"
  ADD COLUMN "focusIntervalId" UUID,
  ADD COLUMN "clientCommandId" UUID,
  ADD COLUMN "endedByCommandId" UUID;
UPDATE "session_pauses" pause
SET
  "focusIntervalId" = interval."id",
  "clientCommandId" = gen_random_uuid()
FROM "focus_intervals" interval
WHERE interval."focusSessionId" = pause."focusSessionId" AND pause."clientCommandId" IS NULL;
ALTER TABLE "session_pauses"
  ALTER COLUMN "clientCommandId" SET NOT NULL,
  ADD CONSTRAINT "session_pauses_focusIntervalId_fkey" FOREIGN KEY ("focusIntervalId") REFERENCES "focus_intervals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "session_pauses_focusSessionId_clientCommandId_key" ON "session_pauses"("focusSessionId", "clientCommandId");
CREATE UNIQUE INDEX "session_pauses_focusSessionId_endedByCommandId_key" ON "session_pauses"("focusSessionId", "endedByCommandId");
CREATE INDEX "session_pauses_focusIntervalId_startedAt_idx" ON "session_pauses"("focusIntervalId", "startedAt");
CREATE UNIQUE INDEX "session_pauses_one_open_per_session_idx" ON "session_pauses"("focusSessionId") WHERE "endedAt" IS NULL;

ALTER TABLE "interruptions" ADD COLUMN "clientCommandId" UUID;
UPDATE "interruptions" SET "clientCommandId" = gen_random_uuid() WHERE "clientCommandId" IS NULL;
ALTER TABLE "interruptions" ALTER COLUMN "clientCommandId" SET NOT NULL;
CREATE UNIQUE INDEX "interruptions_focusSessionId_clientCommandId_key" ON "interruptions"("focusSessionId", "clientCommandId");

INSERT INTO "permissions" ("id", "key", "description", "createdAt")
VALUES
  (gen_random_uuid(), 'focus:read:own', 'Read the current member private Focus Sessions, presets, intervals, and interruptions.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'focus:write:own', 'Create and transition the current member Focus Sessions and Pomodoro presets.', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "roles" role
CROSS JOIN "permissions" permission
WHERE role."key" IN ('member', 'admin')
  AND permission."key" IN ('focus:read:own', 'focus:write:own')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

COMMIT;
