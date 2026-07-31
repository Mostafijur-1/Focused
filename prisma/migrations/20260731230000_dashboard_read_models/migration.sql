-- Focused Milestone 4: Dashboard read models and least-privilege permissions.

CREATE TABLE "dashboard_snapshots" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "localDate" DATE NOT NULL,
  "timeZone" VARCHAR(80) NOT NULL,
  "payload" JSONB NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "sourceVersions" JSONB NOT NULL DEFAULT '{}',
  "degradations" JSONB NOT NULL DEFAULT '[]',
  "computedAt" TIMESTAMPTZ(6) NOT NULL,
  "sourceThrough" TIMESTAMPTZ(6) NOT NULL,
  "staleAfter" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "dashboard_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dashboard_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "dashboard_snapshots_freshness_check" CHECK (
    "schemaVersion" > 0
    AND "version" > 0
    AND "sourceThrough" <= "computedAt"
    AND "staleAfter" > "computedAt"
    AND pg_column_size("payload") <= 131072
  )
);

CREATE UNIQUE INDEX "dashboard_snapshots_userId_localDate_key"
  ON "dashboard_snapshots"("userId", "localDate");
CREATE INDEX "dashboard_snapshots_userId_localDate_idx"
  ON "dashboard_snapshots"("userId", "localDate" DESC);
CREATE INDEX "dashboard_snapshots_staleAfter_idx"
  ON "dashboard_snapshots"("staleAfter");

CREATE TABLE "dashboard_widget_preferences" (
  "userId" UUID NOT NULL,
  "layout" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "dashboard_widget_preferences_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "dashboard_widget_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "dashboard_widget_preferences_version_check" CHECK ("version" > 0),
  CONSTRAINT "dashboard_widget_preferences_layout_size_check" CHECK (pg_column_size("layout") <= 4096)
);

CREATE TABLE "dashboard_projection_cursors" (
  "userId" UUID NOT NULL,
  "lastEventOccurredAt" TIMESTAMPTZ(6),
  "lastEventId" UUID,
  "reconciledAt" TIMESTAMPTZ(6) NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "dashboard_projection_cursors_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "dashboard_projection_cursors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "dashboard_projection_cursors_event_check" CHECK (
    ("lastEventOccurredAt" IS NULL AND "lastEventId" IS NULL)
    OR ("lastEventOccurredAt" IS NOT NULL AND "lastEventId" IS NOT NULL)
  ),
  CONSTRAINT "dashboard_projection_cursors_version_check" CHECK ("version" > 0)
);

CREATE INDEX "dashboard_projection_cursors_event_idx"
  ON "dashboard_projection_cursors"("lastEventOccurredAt", "lastEventId");

INSERT INTO "permissions" ("id", "key", "description", "createdAt")
VALUES
  (gen_random_uuid(), 'dashboard:read:own', 'Read the current member Dashboard projection.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'dashboard:widgets:update:own', 'Update the current member Dashboard widget preferences.', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "roles" role
CROSS JOIN "permissions" permission
WHERE role."key" = 'member'
  AND permission."key" IN ('dashboard:read:own', 'dashboard:widgets:update:own')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
