BEGIN;

ALTER TABLE "push_subscriptions"
  ADD COLUMN "encryptionKeyId" VARCHAR(80) NOT NULL DEFAULT 'auth-data-v1',
  ADD COLUMN "locale" VARCHAR(12) NOT NULL DEFAULT 'bn-BD',
  ADD COLUMN "lastFailureAt" TIMESTAMPTZ(6),
  ADD COLUMN "failureCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "reminder_occurrences"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "reminders"
  ADD COLUMN "startsOn" DATE,
  ADD COLUMN "createdByCommandId" UUID;

CREATE UNIQUE INDEX "reminders_userId_createdByCommandId_key"
  ON "reminders"("userId", "createdByCommandId");

ALTER TABLE "notifications"
  ADD COLUMN "locale" VARCHAR(12) NOT NULL DEFAULT 'bn-BD',
  ADD COLUMN "templateKey" VARCHAR(100) NOT NULL DEFAULT 'reminder.due',
  ADD COLUMN "templateVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

DROP INDEX "delivery_attempts_notificationId_channel_attempt_key";

ALTER TABLE "delivery_attempts"
  ADD COLUMN "pushSubscriptionId" UUID,
  ADD COLUMN "targetKey" VARCHAR(100) NOT NULL DEFAULT 'legacy',
  ADD COLUMN "providerStatusCode" INTEGER,
  ADD COLUMN "completedAt" TIMESTAMPTZ(6);

ALTER TABLE "delivery_attempts"
  ADD CONSTRAINT "delivery_attempts_pushSubscriptionId_fkey"
  FOREIGN KEY ("pushSubscriptionId") REFERENCES "push_subscriptions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "delivery_attempts_notificationId_channel_targetKey_attempt_key"
  ON "delivery_attempts"("notificationId", "channel", "targetKey", "attempt");
CREATE INDEX "delivery_attempts_pushSubscriptionId_status_idx"
  ON "delivery_attempts"("pushSubscriptionId", "status");

INSERT INTO "permissions" ("id", "key", "description", "createdAt") VALUES
  (gen_random_uuid(), 'notifications:read:own', 'Read the current member notification inbox and delivery state.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'notifications:write:own', 'Manage the current member notification inbox and preferences.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'notifications:push:own', 'Manage and test the current member Web Push subscriptions.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'reminders:read:own', 'Read the current member reminders and occurrence outcomes.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'reminders:write:own', 'Create and manage the current member reminders and occurrences.', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "roles" role
CROSS JOIN "permissions" permission
WHERE role."key" = 'member'
  AND permission."key" IN (
    'notifications:read:own',
    'notifications:write:own',
    'notifications:push:own',
    'reminders:read:own',
    'reminders:write:own'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

COMMIT;
