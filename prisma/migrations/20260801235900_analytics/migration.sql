BEGIN;

ALTER TABLE "goal_check_ins"
  ADD COLUMN "timeZone" VARCHAR(80);

ALTER TABLE "export_jobs"
  ADD COLUMN "clientCommandId" UUID,
  ADD COLUMN "format" VARCHAR(20) NOT NULL DEFAULT 'json',
  ADD COLUMN "fileName" VARCHAR(180),
  ADD COLUMN "contentType" VARCHAR(100),
  ADD COLUMN "artifactEncrypted" BYTEA,
  ADD COLUMN "encryptionKeyId" VARCHAR(80);

ALTER TABLE "report_jobs"
  ADD COLUMN "clientCommandId" UUID;

CREATE UNIQUE INDEX "report_jobs_userId_clientCommandId_key"
  ON "report_jobs"("userId", "clientCommandId");
CREATE UNIQUE INDEX "export_jobs_userId_clientCommandId_key"
  ON "export_jobs"("userId", "clientCommandId");

CREATE TABLE "analytics_projection_cursors" (
  "userId" UUID NOT NULL,
  "lastEventOccurredAt" TIMESTAMPTZ(6),
  "lastEventId" UUID,
  "reconciledAt" TIMESTAMPTZ(6) NOT NULL DEFAULT TIMESTAMPTZ '1970-01-01 00:00:00+00',
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "analytics_projection_cursors_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "analytics_projection_cursors_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "analytics_projection_cursors_event_idx"
  ON "analytics_projection_cursors"("lastEventOccurredAt", "lastEventId");

CREATE TABLE "analytics_preferences" (
  "userId" UUID NOT NULL,
  "gamificationEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "analytics_preferences_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "analytics_preferences_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "permissions" ("id", "key", "description", "createdAt") VALUES
  (gen_random_uuid(), 'analytics:read:own', 'Read the current member versioned productivity analytics.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'analytics:write:own', 'Rebuild and manage the current member analytics preferences.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'reports:read:own', 'Read the current member immutable analytics reports.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'reports:write:own', 'Create the current member immutable analytics reports.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'exports:read:own', 'Read and download the current member analytics exports.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'exports:write:own', 'Create the current member privacy-filtered analytics exports.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'gamification:read:own', 'Read the current member optional XP, level, achievement, and streak state.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'gamification:write:own', 'Manage the current member optional gamification preference.', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "roles" role
CROSS JOIN "permissions" permission
WHERE role."key" = 'member'
  AND permission."key" IN (
    'analytics:read:own',
    'analytics:write:own',
    'reports:read:own',
    'reports:write:own',
    'exports:read:own',
    'exports:write:own',
    'gamification:read:own',
    'gamification:write:own'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

UPDATE "users" user_record
SET "permissionVersion" = user_record."permissionVersion" + 1,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM "user_roles" assignment
  JOIN "roles" role ON role."id" = assignment."roleId"
  WHERE assignment."userId" = user_record."id"
    AND role."key" = 'member'
    AND (assignment."expiresAt" IS NULL OR assignment."expiresAt" > CURRENT_TIMESTAMP)
);

INSERT INTO "metric_definitions" (
  "id", "key", "version", "name", "description", "unit", "rule", "active", "effectiveFrom", "createdAt"
) VALUES
  (gen_random_uuid(), 'focus_seconds', 1, 'Focused time', 'Completed focus seconds. Running and abandoned sessions do not count.', 'seconds', '{"source":"focus_sessions","status":"COMPLETED","field":"completedFocusSeconds"}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'focus_sessions_completed', 1, 'Completed Focus Sessions', 'Count of Focus Sessions with completed status.', 'count', '{"source":"focus_sessions","status":"COMPLETED"}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'interruptions_self_reported', 1, 'Self-reported interruptions', 'Count of interruptions deliberately recorded by the member; no passive monitoring.', 'count', '{"source":"interruptions","privacy":"category_only"}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'habit_completion', 1, 'Habit completion', 'Completed due occurrences divided by due, completed, skipped, and excused occurrences.', 'ratio', '{"source":"habit_occurrences","numerator":["COMPLETED"],"denominator":["DUE","COMPLETED","SKIPPED","EXCUSED"]}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'goal_check_ins', 1, 'Goal check-ins', 'Count of goal progress check-ins. Notes and evidence are excluded.', 'count', '{"source":"goal_check_ins","privacy":"progress_only"}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'weekly_plans_finalized', 1, 'Finalized weekly plans', 'Count of weekly plans that were finalized.', 'count', '{"source":"plans","type":"WEEKLY","field":"finalizedAt"}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key", "version") DO NOTHING;

INSERT INTO "level_definitions" ("id", "level", "minimumXp", "title", "active", "createdAt") VALUES
  (gen_random_uuid(), 1, 0, 'শুরু', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 2, 100, 'ছন্দ', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 3, 300, 'গভীরতা', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 4, 700, 'ধারাবাহিকতা', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 5, 1500, 'দক্ষতা', true, CURRENT_TIMESTAMP)
ON CONFLICT ("level") DO NOTHING;

COMMIT;
