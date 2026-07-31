-- Milestone 2 owns only the minimum identity boundary. Milestone 3 adds the
-- remaining FocusOS domain tables from schema.prisma.
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TYPE "UserStatus" AS ENUM (
  'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DELETION_PENDING', 'DELETED'
);
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'DENIED', 'WITHDRAWN');
CREATE TYPE "AuthTokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

CREATE TABLE "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" CITEXT NOT NULL UNIQUE,
  "emailVerifiedAt" TIMESTAMPTZ(6),
  "passwordHash" TEXT,
  "passwordChangedAt" TIMESTAMPTZ(6),
  "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "permissionVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "deletedAt" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX "users_status_createdAt_idx" ON "users" ("status", "createdAt");

CREATE TABLE "user_profiles" (
  "userId" UUID PRIMARY KEY,
  "displayName" VARCHAR(120) NOT NULL,
  "avatarAssetId" VARCHAR(255),
  "timeZone" VARCHAR(80) NOT NULL DEFAULT 'UTC',
  "locale" VARCHAR(20) NOT NULL DEFAULT 'en',
  "weekStartsOn" SMALLINT NOT NULL DEFAULT 1,
  "accessibility" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE "oauth_accounts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "provider" VARCHAR(50) NOT NULL,
  "providerSubject" VARCHAR(255) NOT NULL,
  "providerEmail" CITEXT,
  "accessTokenEncrypted" BYTEA,
  "refreshTokenEncrypted" BYTEA,
  "scope" TEXT,
  "expiresAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "oauth_accounts_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "oauth_accounts_provider_providerSubject_key"
    UNIQUE ("provider", "providerSubject")
);
CREATE INDEX "oauth_accounts_userId_provider_idx" ON "oauth_accounts" ("userId", "provider");

CREATE TABLE "oauth_transactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "initiatedByUserId" UUID,
  "provider" VARCHAR(50) NOT NULL,
  "stateHash" CHAR(64) NOT NULL UNIQUE,
  "nonceHash" CHAR(64),
  "nonceEncrypted" BYTEA,
  "codeVerifierEncrypted" BYTEA NOT NULL,
  "redirectUri" VARCHAR(500) NOT NULL,
  "returnTo" VARCHAR(500) NOT NULL,
  "locale" VARCHAR(20) NOT NULL,
  "timeZone" VARCHAR(80) NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "consumedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_transactions_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId")
    REFERENCES "users" ("id") ON DELETE CASCADE
);
CREATE INDEX "oauth_transactions_provider_expiresAt_idx"
  ON "oauth_transactions" ("provider", "expiresAt");
CREATE INDEX "oauth_transactions_initiatedByUserId_createdAt_idx"
  ON "oauth_transactions" ("initiatedByUserId", "createdAt" DESC);

CREATE TABLE "auth_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "deviceName" VARCHAR(120),
  "userAgentHash" VARCHAR(128),
  "ipPrefix" VARCHAR(64),
  "authMethod" VARCHAR(40) NOT NULL,
  "authenticatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "mfaVerifiedAt" TIMESTAMPTZ(6),
  "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "revokedAt" TIMESTAMPTZ(6),
  "revokeReason" VARCHAR(80),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users" ("id") ON DELETE CASCADE
);
CREATE INDEX "auth_sessions_userId_status_idx" ON "auth_sessions" ("userId", "status");
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions" ("expiresAt");

CREATE TABLE "refresh_tokens" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "familyId" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL UNIQUE,
  "parentId" UUID,
  "replacedById" UUID UNIQUE,
  "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "usedAt" TIMESTAMPTZ(6),
  "revokedAt" TIMESTAMPTZ(6),
  CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "refresh_tokens_sessionId_fkey" FOREIGN KEY ("sessionId")
    REFERENCES "auth_sessions" ("id") ON DELETE CASCADE,
  CONSTRAINT "refresh_tokens_parentId_fkey" FOREIGN KEY ("parentId")
    REFERENCES "refresh_tokens" ("id") ON DELETE SET NULL,
  CONSTRAINT "refresh_tokens_replacedById_fkey" FOREIGN KEY ("replacedById")
    REFERENCES "refresh_tokens" ("id") ON DELETE SET NULL
);
CREATE INDEX "refresh_tokens_sessionId_familyId_idx" ON "refresh_tokens" ("sessionId", "familyId");
CREATE INDEX "refresh_tokens_familyId_revokedAt_idx" ON "refresh_tokens" ("familyId", "revokedAt");
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens" ("expiresAt");

CREATE TABLE "auth_one_time_tokens" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "purpose" "AuthTokenPurpose" NOT NULL,
  "tokenHash" CHAR(64) NOT NULL UNIQUE,
  "requestedIpPrefix" VARCHAR(64),
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "consumedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_one_time_tokens_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users" ("id") ON DELETE CASCADE
);
CREATE INDEX "auth_one_time_tokens_userId_purpose_createdAt_idx"
  ON "auth_one_time_tokens" ("userId", "purpose", "createdAt" DESC);
CREATE INDEX "auth_one_time_tokens_expiresAt_idx" ON "auth_one_time_tokens" ("expiresAt");

CREATE TABLE "roles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" VARCHAR(60) NOT NULL UNIQUE,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "system" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);
CREATE TABLE "permissions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" VARCHAR(120) NOT NULL UNIQUE,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "user_roles" (
  "userId" UUID NOT NULL,
  "roleId" UUID NOT NULL,
  "grantedById" UUID,
  "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6),
  PRIMARY KEY ("userId", "roleId"),
  CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId")
    REFERENCES "roles" ("id") ON DELETE CASCADE
);
CREATE INDEX "user_roles_roleId_idx" ON "user_roles" ("roleId");
CREATE TABLE "role_permissions" (
  "roleId" UUID NOT NULL,
  "permissionId" UUID NOT NULL,
  PRIMARY KEY ("roleId", "permissionId"),
  CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId")
    REFERENCES "roles" ("id") ON DELETE CASCADE,
  CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId")
    REFERENCES "permissions" ("id") ON DELETE CASCADE
);

CREATE TABLE "consents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "purpose" VARCHAR(100) NOT NULL,
  "policyVersion" VARCHAR(40) NOT NULL,
  "status" "ConsentStatus" NOT NULL,
  "decidedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6),
  "evidence" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "consents_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "consents_userId_purpose_policyVersion_key"
    UNIQUE ("userId", "purpose", "policyVersion")
);
CREATE INDEX "consents_userId_purpose_status_idx"
  ON "consents" ("userId", "purpose", "status");

CREATE TABLE "audit_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorUserId" UUID,
  "actorType" VARCHAR(30) NOT NULL,
  "action" VARCHAR(120) NOT NULL,
  "targetType" VARCHAR(80),
  "targetId" UUID,
  "reasonCode" VARCHAR(80),
  "correlationId" VARCHAR(80) NOT NULL,
  "ipPrefix" VARCHAR(64),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId")
    REFERENCES "users" ("id") ON DELETE SET NULL
);
CREATE INDEX "audit_events_actorUserId_occurredAt_idx"
  ON "audit_events" ("actorUserId", "occurredAt" DESC);
CREATE INDEX "audit_events_targetType_targetId_occurredAt_idx"
  ON "audit_events" ("targetType", "targetId", "occurredAt" DESC);
CREATE INDEX "audit_events_correlationId_idx" ON "audit_events" ("correlationId");

INSERT INTO "roles" ("id", "key", "name", "description", "updatedAt")
VALUES
  (gen_random_uuid(), 'member', 'Member', 'Owner of a personal Focused workspace.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'platform_admin', 'Platform administrator', 'Least-privilege operational administrator.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'auditor', 'Auditor', 'Read-only authorized audit evidence.', CURRENT_TIMESTAMP);

INSERT INTO "permissions" ("id", "key", "description") VALUES
  (gen_random_uuid(), 'profile:read:own', 'Read the current member profile.'),
  (gen_random_uuid(), 'profile:update:own', 'Update the current member profile.'),
  (gen_random_uuid(), 'sessions:read:own', 'List the current member sessions.'),
  (gen_random_uuid(), 'sessions:revoke:own', 'Revoke the current member sessions.');

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "roles" role
CROSS JOIN "permissions" permission
WHERE role."key" = 'member';
