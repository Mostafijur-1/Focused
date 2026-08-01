BEGIN;

CREATE TYPE "AdminCaseStatus" AS ENUM ('OPEN', 'CLOSED', 'EXPIRED');
CREATE TYPE "AdminStepUpMethod" AS ENUM ('PASSWORD_TOTP', 'OAUTH_TOTP');
CREATE TYPE "OperationalMfaStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');
CREATE TYPE "AuditOutcome" AS ENUM ('ALLOWED', 'DENIED', 'FAILED');
CREATE TYPE "AdminApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED', 'CANCELLED');

ALTER TABLE "audit_events"
  ADD COLUMN "outcome" "AuditOutcome" NOT NULL DEFAULT 'ALLOWED',
  ADD COLUMN "chainKey" VARCHAR(80),
  ADD COLUMN "sequence" BIGINT,
  ADD COLUMN "previousHash" CHAR(64),
  ADD COLUMN "eventHash" CHAR(64),
  ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "audit_events_chain_fields_check" CHECK (
    ("chainKey" IS NULL AND "sequence" IS NULL AND "previousHash" IS NULL AND "eventHash" IS NULL)
    OR
    ("chainKey" IS NOT NULL AND "sequence" IS NOT NULL AND "eventHash" IS NOT NULL)
  );

CREATE UNIQUE INDEX "audit_events_eventHash_key" ON "audit_events"("eventHash");
CREATE UNIQUE INDEX "audit_events_chainKey_sequence_key" ON "audit_events"("chainKey", "sequence");

ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_actorUserId_fkey";
ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "audit_chain_heads" (
  "chainKey" VARCHAR(80) NOT NULL,
  "lastSequence" BIGINT NOT NULL DEFAULT 0,
  "lastHash" CHAR(64),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_chain_heads_pkey" PRIMARY KEY ("chainKey")
);

INSERT INTO "audit_chain_heads" ("chainKey") VALUES ('admin')
ON CONFLICT ("chainKey") DO NOTHING;

CREATE OR REPLACE FUNCTION focused_reject_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."chainKey" IS NULL
     AND OLD."actorUserId" IS NOT NULL
     AND NEW."actorUserId" IS NULL
     AND (to_jsonb(NEW) - 'actorUserId') = (to_jsonb(OLD) - 'actorUserId') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_events are append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "audit_events_append_only"
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION focused_reject_audit_mutation();

ALTER TABLE "feature_flags"
  ADD COLUMN "owner" VARCHAR(120) NOT NULL DEFAULT 'platform',
  ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'Operational rollout control',
  ADD COLUMN "audience" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "safeDefault" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewAt" TIMESTAMPTZ(6),
  ADD COLUMN "expiresAt" TIMESTAMPTZ(6),
  ADD COLUMN "rollbackPlan" TEXT NOT NULL DEFAULT 'Disable the flag and verify service health.',
  ADD COLUMN "updatedByUserId" UUID;

ALTER TABLE "background_jobs"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "admin_cases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR(80) NOT NULL,
  "externalReference" VARCHAR(160),
  "reasonCode" VARCHAR(80) NOT NULL,
  "summary" VARCHAR(300) NOT NULL,
  "status" "AdminCaseStatus" NOT NULL DEFAULT 'OPEN',
  "openedByUserId" UUID NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "closedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "admin_cases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_cases_expiry_check" CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "admin_cases_openedByUserId_fkey"
    FOREIGN KEY ("openedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "admin_cases_key_key" ON "admin_cases"("key");
CREATE INDEX "admin_cases_openedByUserId_status_expiresAt_idx"
  ON "admin_cases"("openedByUserId", "status", "expiresAt");
CREATE INDEX "admin_cases_status_expiresAt_idx" ON "admin_cases"("status", "expiresAt");

CREATE TABLE "operational_mfa_credentials" (
  "userId" UUID NOT NULL,
  "encryptedSecret" BYTEA NOT NULL,
  "encryptionKeyId" VARCHAR(80) NOT NULL,
  "recoveryCodeHashes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "status" "OperationalMfaStatus" NOT NULL DEFAULT 'PENDING',
  "lastAcceptedCounter" BIGINT NOT NULL DEFAULT -1,
  "enrolledAt" TIMESTAMPTZ(6),
  "revokedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "operational_mfa_credentials_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "operational_mfa_credentials_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "operational_mfa_credentials_status_idx" ON "operational_mfa_credentials"("status");

CREATE TABLE "admin_step_up_grants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "scopes" JSONB NOT NULL,
  "targetType" VARCHAR(80),
  "targetId" UUID,
  "method" "AdminStepUpMethod" NOT NULL,
  "mfaVerifiedAt" TIMESTAMPTZ(6) NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "consumedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_step_up_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_step_up_grants_expiry_check" CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "admin_step_up_grants_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "admin_step_up_grants_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "admin_step_up_grants_tokenHash_key" ON "admin_step_up_grants"("tokenHash");
CREATE INDEX "admin_step_up_grants_userId_sessionId_expiresAt_idx"
  ON "admin_step_up_grants"("userId", "sessionId", "expiresAt");
CREATE INDEX "admin_step_up_grants_expiresAt_consumedAt_idx"
  ON "admin_step_up_grants"("expiresAt", "consumedAt");

CREATE TABLE "admin_approval_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "action" VARCHAR(120) NOT NULL,
  "targetUserId" UUID,
  "payload" JSONB NOT NULL,
  "payloadHash" CHAR(64) NOT NULL,
  "caseId" UUID NOT NULL,
  "requestedByUserId" UUID NOT NULL,
  "decidedByUserId" UUID,
  "status" "AdminApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "decidedAt" TIMESTAMPTZ(6),
  "executedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "admin_approval_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_approval_requests_expiry_check" CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "admin_approval_requests_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "admin_approval_requests_requestedByUserId_fkey"
    FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "admin_approval_requests_decidedByUserId_fkey"
    FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "admin_approval_requests_status_expiresAt_createdAt_idx"
  ON "admin_approval_requests"("status", "expiresAt", "createdAt");
CREATE INDEX "admin_approval_requests_requestedByUserId_createdAt_idx"
  ON "admin_approval_requests"("requestedByUserId", "createdAt" DESC);
CREATE INDEX "admin_approval_requests_targetUserId_createdAt_idx"
  ON "admin_approval_requests"("targetUserId", "createdAt" DESC);

INSERT INTO "roles" ("id", "key", "name", "description", "system", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'support-administrator', 'Support Administrator', 'Reason-bound access to minimal account metadata and bounded support actions.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'platform-administrator', 'Platform Administrator', 'Step-up protected platform policy, role, flag, and operational controls.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'content-curator', 'Content Curator', 'Curated public knowledge, translation, challenge, and resource configuration.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'auditor', 'Auditor', 'Read-only access to authorized operational evidence and audit verification.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "system" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "permissions" ("id", "key", "description", "createdAt") VALUES
  (gen_random_uuid(), 'admin:access', 'Open the role-specific Admin workspace.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin:mfa:manage:own', 'Enroll and verify the actor operational MFA credential.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin:cases:read', 'Read the actor reason-bound operational cases.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin:cases:write', 'Open and close reason-bound operational cases.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin:users:read:metadata', 'Search privacy-minimized account metadata using an active case.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin:users:status:write', 'Apply bounded account status corrections with step-up.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin:sessions:revoke', 'Revoke member sessions with step-up and an active case.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin:roles:read', 'Read operational role assignments without private member data.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin:roles:write', 'Manage delegated operational role assignments with dual control.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin:feature_flags:read', 'Read safe Feature Flag configuration.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin:feature_flags:write', 'Manage governed Feature Flag rollout configuration.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin:audit:read', 'Read authorized append-only administrative audit evidence.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin:audit:export', 'Export bounded administrative audit evidence.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin:health:read', 'Read safe aggregate platform and provider health.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin:jobs:read', 'Read redacted job and dead-letter operational metadata.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin:jobs:retry', 'Retry bounded recoverable jobs with step-up.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin:content:manage', 'Manage delegated curated catalog and translation configuration.', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "roles" role
CROSS JOIN "permissions" permission
WHERE
  (role."key" = 'support-administrator' AND permission."key" IN (
    'admin:access', 'admin:mfa:manage:own', 'admin:cases:read', 'admin:cases:write',
    'admin:users:read:metadata', 'admin:users:status:write', 'admin:sessions:revoke',
    'admin:feature_flags:read', 'admin:audit:read', 'admin:health:read', 'admin:jobs:read'
  ))
  OR (role."key" = 'platform-administrator' AND permission."key" IN (
    'admin:access', 'admin:mfa:manage:own', 'admin:cases:read', 'admin:cases:write',
    'admin:users:read:metadata', 'admin:users:status:write', 'admin:sessions:revoke',
    'admin:roles:read', 'admin:roles:write', 'admin:feature_flags:read',
    'admin:feature_flags:write', 'admin:audit:read', 'admin:audit:export',
    'admin:health:read', 'admin:jobs:read', 'admin:jobs:retry', 'admin:content:manage'
  ))
  OR (role."key" = 'content-curator' AND permission."key" IN (
    'admin:access', 'admin:mfa:manage:own', 'admin:cases:read', 'admin:cases:write',
    'admin:feature_flags:read', 'admin:audit:read', 'admin:health:read', 'admin:content:manage'
  ))
  OR (role."key" = 'auditor' AND permission."key" IN (
    'admin:access', 'admin:mfa:manage:own', 'admin:cases:read',
    'admin:feature_flags:read', 'admin:audit:read', 'admin:audit:export', 'admin:health:read'
  ))
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

COMMIT;
