-- Focused Milestone 3: additive product-data foundation
-- This migration intentionally builds on the immutable authentication baseline.
-- PostgreSQL DDL is transactional; deployment uses prisma migrate deploy with DIRECT_URL.

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ACHIEVED', 'ABANDONED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FocusKind" AS ENUM ('DEEP_WORK', 'POMODORO', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FocusStatus" AS ENUM ('RUNNING', 'PAUSED', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "HabitKind" AS ENUM ('BOOLEAN', 'COUNT', 'DURATION', 'AVOIDANCE');

-- CreateEnum
CREATE TYPE "TrackerKind" AS ENUM ('LEARNING_PATH', 'LEARNING_ITEM', 'PROGRAMMING_SKILL', 'PROGRAMMING_PROJECT', 'CODING_PROBLEM', 'READING_ITEM', 'QURAN_PLAN', 'QURAN_REVIEW', 'PRAYER', 'WORKOUT_PLAN', 'WORKOUT_EXERCISE', 'SLEEP', 'MOOD', 'BODY_METRIC', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('MANUAL', 'IMPORT', 'INTEGRATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "ResourceKind" AS ENUM ('BOOKMARK', 'ARTICLE', 'BOOK', 'COURSE', 'VIDEO', 'PODCAST', 'NEWS', 'FILE', 'OTHER');

-- CreateEnum
CREATE TYPE "AIRunKind" AS ENUM ('COACH', 'MENTOR', 'DAILY_REVIEW', 'WEEKLY_REVIEW', 'MONTHLY_REVIEW', 'SUGGESTION', 'SMART_REMINDER', 'AGENT_RESEARCH');

-- CreateEnum
CREATE TYPE "AIRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AIProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('PENDING', 'DEFERRED', 'ENQUEUED', 'DELIVERED', 'COMPLETED', 'MISSED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'WEB_PUSH', 'EMAIL');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'ACKNOWLEDGED', 'RETRYABLE_FAILURE', 'PERMANENT_FAILURE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "InboxStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'RETRYABLE_FAILURE', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'CANCELLED');

CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("userId")
);

CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

CONSTRAINT "oauth_transactions_pkey" PRIMARY KEY ("id")
);

CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CONSTRAINT "auth_one_time_tokens_pkey" PRIMARY KEY ("id")
);

CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "namespace" VARCHAR(80) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpointHash" CHAR(64) NOT NULL,
    "endpointEncrypted" BYTEA NOT NULL,
    "p256dhEncrypted" BYTEA NOT NULL,
    "authEncrypted" BYTEA NOT NULL,
    "userAgent" VARCHAR(300),
    "deviceName" VARCHAR(120),
    "expiresAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "lastSuccessAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "parentGoalId" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "GoalStatus" NOT NULL DEFAULT 'DRAFT',
    "horizon" VARCHAR(30) NOT NULL,
    "successMeasure" TEXT,
    "targetValue" DECIMAL(18,4),
    "targetUnit" VARCHAR(40),
    "targetDate" DATE,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "dueDate" DATE,
    "status" "ItemStatus" NOT NULL DEFAULT 'PLANNED',
    "position" INTEGER NOT NULL,
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "life_visions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "narrative" TEXT,
    "values" JSONB NOT NULL DEFAULT '[]',
    "antiGoals" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),

CONSTRAINT "life_visions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "life_vision_areas" (
    "id" UUID NOT NULL,
    "lifeVisionId" UUID NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "statement" TEXT,
    "position" INTEGER NOT NULL,

CONSTRAINT "life_vision_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "PlanType" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "timeZone" VARCHAR(80) NOT NULL,
    "title" VARCHAR(200),
    "theme" VARCHAR(160),
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "capacityMinutes" INTEGER,
    "notDoing" JSONB NOT NULL DEFAULT '[]',
    "closedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_items" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "goalId" UUID,
    "parentItemId" UUID,
    "title" VARCHAR(240) NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'PLANNED',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "estimateMinutes" INTEGER,
    "position" INTEGER NOT NULL,
    "completedAt" TIMESTAMPTZ(6),
    "carryForwardFromId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_blocks" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "planItemId" UUID,
    "title" VARCHAR(200) NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "timeZone" VARCHAR(80) NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "source" VARCHAR(30) NOT NULL DEFAULT 'FOCUSED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "time_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_proposals" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "inputVersion" VARCHAR(100) NOT NULL,
    "status" "AIProposalStatus" NOT NULL DEFAULT 'PENDING',
    "constraints" JSONB NOT NULL,
    "proposedBlocks" JSONB NOT NULL,
    "explanation" JSONB NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMPTZ(6),

CONSTRAINT "schedule_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_connections" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "providerAccountId" VARCHAR(255) NOT NULL,
    "accessTokenEncrypted" BYTEA NOT NULL,
    "refreshTokenEncrypted" BYTEA,
    "scopes" TEXT[],
    "syncCursorEncrypted" BYTEA,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "connectionId" UUID,
    "externalId" VARCHAR(255),
    "title" VARCHAR(240) NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "timeZone" VARCHAR(80) NOT NULL,
    "busy" BOOLEAN NOT NULL DEFAULT true,
    "sourceVersion" VARCHAR(120),
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "focus_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "goalId" UUID,
    "kind" "FocusKind" NOT NULL,
    "status" "FocusStatus" NOT NULL DEFAULT 'RUNNING',
    "intent" VARCHAR(300) NOT NULL,
    "plannedSeconds" INTEGER NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL,
    "completedAt" TIMESTAMPTZ(6),
    "abandonedAt" TIMESTAMPTZ(6),
    "outcome" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "focus_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_pauses" (
    "id" UUID NOT NULL,
    "focusSessionId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL,
    "endedAt" TIMESTAMPTZ(6),
    "reason" VARCHAR(160),

CONSTRAINT "session_pauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interruptions" (
    "id" UUID NOT NULL,
    "focusSessionId" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" VARCHAR(60) NOT NULL,
    "note" VARCHAR(500),
    "resumed" BOOLEAN,

CONSTRAINT "interruptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habits" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "kind" "HabitKind" NOT NULL,
    "targetValue" DECIMAL(18,4),
    "unit" VARCHAR(40),
    "schedule" JSONB NOT NULL,
    "startsOn" DATE NOT NULL,
    "pausedAt" TIMESTAMPTZ(6),
    "archivedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "habits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_entries" (
    "id" UUID NOT NULL,
    "habitId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "timeZone" VARCHAR(80) NOT NULL,
    "value" DECIMAL(18,4),
    "completed" BOOLEAN,
    "skippedReason" VARCHAR(160),
    "source" "EntrySource" NOT NULL DEFAULT 'MANUAL',
    "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "habit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracker_items" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "TrackerKind" NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "startedOn" DATE,
    "targetDate" DATE,
    "archivedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "tracker_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracker_entries" (
    "id" UUID NOT NULL,
    "trackerItemId" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "localDate" DATE NOT NULL,
    "timeZone" VARCHAR(80) NOT NULL,
    "durationSeconds" INTEGER,
    "quantity" DECIMAL(18,4),
    "unit" VARCHAR(40),
    "rating" INTEGER,
    "note" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "source" "EntrySource" NOT NULL DEFAULT 'MANUAL',
    "sourceKey" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "tracker_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "timeZone" VARCHAR(80) NOT NULL,
    "title" VARCHAR(240),
    "body" TEXT NOT NULL,
    "format" VARCHAR(20) NOT NULL DEFAULT 'MARKDOWN',
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_revisions" (
    "id" UUID NOT NULL,
    "journalEntryId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "journal_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reflections" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "responses" JSONB NOT NULL,
    "lessons" JSONB NOT NULL DEFAULT '[]',
    "experiments" JSONB NOT NULL DEFAULT '[]',
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "reflections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "body" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "tags" TEXT[],
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "canonicalUrlHash" CHAR(64) NOT NULL,
    "title" VARCHAR(500),
    "description" TEXT,
    "tags" TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "kind" "ResourceKind" NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "canonicalUrl" TEXT,
    "providerKey" VARCHAR(255),
    "description" TEXT,
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[],
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" VARCHAR(60) NOT NULL,
    "title" VARCHAR(200),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB NOT NULL DEFAULT '[]',
    "model" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_runs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "conversationId" UUID,
    "kind" "AIRunKind" NOT NULL,
    "status" "AIRunStatus" NOT NULL DEFAULT 'QUEUED',
    "promptVersion" VARCHAR(80) NOT NULL,
    "policyVersion" VARCHAR(80) NOT NULL,
    "modelAlias" VARCHAR(60) NOT NULL,
    "provider" VARCHAR(60),
    "model" VARCHAR(100),
    "inputManifest" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB,
    "evaluation" JSONB,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costMicros" BIGINT,
    "queuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6),
    "failureCode" VARCHAR(100),

CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_context_grants" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "aiRunId" UUID,
    "sourceType" VARCHAR(80) NOT NULL,
    "sourceId" UUID,
    "scope" JSONB NOT NULL,
    "sourceVersion" VARCHAR(100),
    "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),

CONSTRAINT "ai_context_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_proposals" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "aiRunId" UUID NOT NULL,
    "targetType" VARCHAR(80) NOT NULL,
    "targetId" UUID,
    "targetVersion" INTEGER,
    "operation" VARCHAR(80) NOT NULL,
    "patch" JSONB NOT NULL,
    "rationale" TEXT,
    "status" "AIProposalStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "decidedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "ai_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(500),
    "status" "ReminderStatus" NOT NULL DEFAULT 'ACTIVE',
    "timeZone" VARCHAR(80) NOT NULL,
    "localTime" VARCHAR(12),
    "rrule" TEXT,
    "oneTimeAt" TIMESTAMPTZ(6),
    "quietHoursPolicy" JSONB NOT NULL DEFAULT '{}',
    "deliveryPolicy" JSONB NOT NULL DEFAULT '{}',
    "ruleVersion" INTEGER NOT NULL DEFAULT 1,
    "expandedThrough" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_occurrences" (
    "id" UUID NOT NULL,
    "reminderId" UUID NOT NULL,
    "occurrenceKey" VARCHAR(180) NOT NULL,
    "scheduledFor" TIMESTAMPTZ(6) NOT NULL,
    "localDate" DATE NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'PENDING',
    "snoozedUntil" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

CONSTRAINT "reminder_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "userId" UUID NOT NULL,
    "categories" JSONB NOT NULL DEFAULT '{}',
    "quietHours" JSONB NOT NULL DEFAULT '{}',
    "digestPolicy" JSONB NOT NULL DEFAULT '{}',
    "previewPolicy" VARCHAR(30) NOT NULL DEFAULT 'MINIMAL',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "occurrenceId" UUID,
    "category" VARCHAR(60) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(300),
    "deepLink" VARCHAR(500),
    "deduplicationKey" VARCHAR(180) NOT NULL,
    "preferenceSnapshot" JSONB NOT NULL,
    "readAt" TIMESTAMPTZ(6),
    "archivedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_attempts" (
    "id" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "DeliveryStatus" NOT NULL,
    "providerMessageId" VARCHAR(255),
    "errorCode" VARCHAR(100),
    "attemptedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextAttemptAt" TIMESTAMPTZ(6),

CONSTRAINT "delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_definitions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "version" INTEGER NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "rule" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "achievement_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_awards" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "definitionId" UUID NOT NULL,
    "sourceEventId" VARCHAR(180) NOT NULL,
    "awardedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(6),

CONSTRAINT "achievement_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_ledger_entries" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "ruleKey" VARCHAR(100) NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "sourceEventId" VARCHAR(180) NOT NULL,
    "reversalOfId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "xp_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "level_definitions" (
    "id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "minimumXp" INTEGER NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "level_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_levels" (
    "userId" UUID NOT NULL,
    "levelDefinitionId" UUID NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

CONSTRAINT "user_levels_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "streaks" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "subjectType" VARCHAR(60) NOT NULL,
    "subjectId" UUID NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "bestCount" INTEGER NOT NULL DEFAULT 0,
    "lastQualifiedDate" DATE,
    "pausedUntil" DATE,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

CONSTRAINT "streaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "eligibility" JSONB NOT NULL,
    "metricRule" JSONB NOT NULL,
    "rewardRule" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_enrollments" (
    "id" UUID NOT NULL,
    "challengeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "progress" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ENROLLED',
    "enrolledAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "withdrawnAt" TIMESTAMPTZ(6),

CONSTRAINT "challenge_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "localDate" DATE NOT NULL,
    "value" DECIMAL(20,6),
    "dimensions" JSONB NOT NULL DEFAULT '{}',
    "sourceEventId" VARCHAR(180) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "metric_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_metric_snapshots" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "metricVersion" VARCHAR(40) NOT NULL,
    "values" JSONB NOT NULL,
    "computedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceThrough" TIMESTAMPTZ(6) NOT NULL,

CONSTRAINT "daily_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_jobs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "parameters" JSONB NOT NULL,
    "result" JSONB,
    "schemaVersion" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6),
    "failureCode" VARCHAR(100),

CONSTRAINT "report_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "categories" TEXT[],
    "rangeStart" TIMESTAMPTZ(6),
    "rangeEnd" TIMESTAMPTZ(6),
    "schemaVersion" VARCHAR(40) NOT NULL,
    "assetProvider" VARCHAR(40),
    "assetId" VARCHAR(255),
    "checksum" CHAR(64),
    "sizeBytes" BIGINT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6),
    "downloadedAt" TIMESTAMPTZ(6),
    "failureCode" VARCHAR(100),

CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "route" VARCHAR(160) NOT NULL,
    "key" VARCHAR(160) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "statusCode" INTEGER,
    "response" JSONB,
    "resourceId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,

CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_inbox" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(60) NOT NULL,
    "externalEventId" VARCHAR(255) NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "payloadEncrypted" BYTEA NOT NULL,
    "encryptionKeyId" VARCHAR(80) NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "InboxStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMPTZ(6),
    "lockedBy" VARCHAR(120),
    "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(6),
    "failureCode" VARCHAR(100),

CONSTRAINT "webhook_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "aggregateType" VARCHAR(80) NOT NULL,
    "aggregateId" UUID NOT NULL,
    "aggregateVersion" INTEGER NOT NULL,
    "eventType" VARCHAR(120) NOT NULL,
    "eventVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMPTZ(6),
    "publishAttempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMPTZ(6),
    "lockedBy" VARCHAR(120),
    "failureCode" VARCHAR(100),
    "deadLetteredAt" TIMESTAMPTZ(6),

CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "queue" VARCHAR(80) NOT NULL,
    "type" VARCHAR(120) NOT NULL,
    "deduplicationKey" VARCHAR(200),
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMPTZ(6),
    "lockedBy" VARCHAR(120),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6),
    "failureCode" VARCHAR(100),

CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_definitions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "version" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "unit" VARCHAR(40) NOT NULL,
    "rule" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "metric_definitions_pkey" PRIMARY KEY ("id")
);

CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_namespace_key_key" ON "user_preferences"("userId", "namespace", "key");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpointHash_key" ON "push_subscriptions"("endpointHash");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_revokedAt_idx" ON "push_subscriptions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "goals_userId_status_targetDate_idx" ON "goals"("userId", "status", "targetDate");

-- CreateIndex
CREATE INDEX "goals_parentGoalId_idx" ON "goals"("parentGoalId");

-- CreateIndex
CREATE INDEX "milestones_goalId_status_idx" ON "milestones"("goalId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "milestones_goalId_position_key" ON "milestones"("goalId", "position");

-- CreateIndex
CREATE INDEX "life_visions_userId_archivedAt_idx" ON "life_visions"("userId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "life_visions_userId_revision_key" ON "life_visions"("userId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "life_vision_areas_lifeVisionId_key_key" ON "life_vision_areas"("lifeVisionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "life_vision_areas_lifeVisionId_position_key" ON "life_vision_areas"("lifeVisionId", "position");

-- CreateIndex
CREATE INDEX "plans_userId_type_status_periodStart_idx" ON "plans"("userId", "type", "status", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "plans_userId_type_periodStart_key" ON "plans"("userId", "type", "periodStart");

-- CreateIndex
CREATE INDEX "plan_items_goalId_idx" ON "plan_items"("goalId");

-- CreateIndex
CREATE INDEX "plan_items_planId_status_idx" ON "plan_items"("planId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "plan_items_planId_position_key" ON "plan_items"("planId", "position");

-- CreateIndex
CREATE INDEX "time_blocks_userId_startsAt_endsAt_idx" ON "time_blocks"("userId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "time_blocks_planItemId_idx" ON "time_blocks"("planItemId");

-- CreateIndex
CREATE INDEX "schedule_proposals_userId_status_expiresAt_idx" ON "schedule_proposals"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "calendar_connections_userId_status_idx" ON "calendar_connections"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connections_userId_provider_providerAccountId_key" ON "calendar_connections"("userId", "provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "calendar_events_userId_startsAt_endsAt_idx" ON "calendar_events"("userId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_connectionId_externalId_key" ON "calendar_events"("connectionId", "externalId");

-- CreateIndex
CREATE INDEX "focus_sessions_userId_startedAt_id_idx" ON "focus_sessions"("userId", "startedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "focus_sessions_userId_status_idx" ON "focus_sessions"("userId", "status");

-- CreateIndex
CREATE INDEX "session_pauses_focusSessionId_startedAt_idx" ON "session_pauses"("focusSessionId", "startedAt");

-- CreateIndex
CREATE INDEX "interruptions_focusSessionId_occurredAt_idx" ON "interruptions"("focusSessionId", "occurredAt");

-- CreateIndex
CREATE INDEX "habits_userId_archivedAt_idx" ON "habits"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "habit_entries_habitId_recordedAt_idx" ON "habit_entries"("habitId", "recordedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "habit_entries_habitId_localDate_key" ON "habit_entries"("habitId", "localDate");

-- CreateIndex
CREATE INDEX "tracker_items_userId_kind_status_idx" ON "tracker_items"("userId", "kind", "status");

-- CreateIndex
CREATE INDEX "tracker_entries_trackerItemId_occurredAt_id_idx" ON "tracker_entries"("trackerItemId", "occurredAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "tracker_entries_localDate_idx" ON "tracker_entries"("localDate");

-- CreateIndex
CREATE UNIQUE INDEX "tracker_entries_trackerItemId_source_sourceKey_key" ON "tracker_entries"("trackerItemId", "source", "sourceKey");

-- CreateIndex
CREATE INDEX "journal_entries_userId_localDate_id_idx" ON "journal_entries"("userId", "localDate" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "journal_revisions_journalEntryId_revision_key" ON "journal_revisions"("journalEntryId", "revision");

-- CreateIndex
CREATE INDEX "reflections_userId_periodStart_idx" ON "reflections"("userId", "periodStart" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "reflections_userId_type_periodStart_key" ON "reflections"("userId", "type", "periodStart");

-- CreateIndex
CREATE INDEX "notes_userId_updatedAt_id_idx" ON "notes"("userId", "updatedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "bookmarks_userId_createdAt_idx" ON "bookmarks"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_userId_canonicalUrlHash_key" ON "bookmarks"("userId", "canonicalUrlHash");

-- CreateIndex
CREATE INDEX "resources_kind_publishedAt_idx" ON "resources"("kind", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "resources_userId_createdAt_idx" ON "resources"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "resources_userId_kind_providerKey_key" ON "resources"("userId", "kind", "providerKey");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_updatedAt_idx" ON "ai_conversations"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_createdAt_id_idx" ON "ai_messages"("conversationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ai_runs_userId_kind_queuedAt_idx" ON "ai_runs"("userId", "kind", "queuedAt" DESC);

-- CreateIndex
CREATE INDEX "ai_runs_status_queuedAt_idx" ON "ai_runs"("status", "queuedAt");

-- CreateIndex
CREATE INDEX "ai_context_grants_userId_expiresAt_idx" ON "ai_context_grants"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "ai_context_grants_aiRunId_idx" ON "ai_context_grants"("aiRunId");

-- CreateIndex
CREATE INDEX "ai_proposals_userId_status_expiresAt_idx" ON "ai_proposals"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "reminders_userId_status_idx" ON "reminders"("userId", "status");

-- CreateIndex
CREATE INDEX "reminders_status_expandedThrough_idx" ON "reminders"("status", "expandedThrough");

-- CreateIndex
CREATE INDEX "reminder_occurrences_status_scheduledFor_idx" ON "reminder_occurrences"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_occurrences_reminderId_occurrenceKey_key" ON "reminder_occurrences"("reminderId", "occurrenceKey");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_id_idx" ON "notifications"("userId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_userId_deduplicationKey_key" ON "notifications"("userId", "deduplicationKey");

-- CreateIndex
CREATE INDEX "delivery_attempts_status_nextAttemptAt_idx" ON "delivery_attempts"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_attempts_notificationId_channel_attempt_key" ON "delivery_attempts"("notificationId", "channel", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_definitions_key_key" ON "achievement_definitions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_definitions_key_version_key" ON "achievement_definitions"("key", "version");

-- CreateIndex
CREATE INDEX "achievement_awards_userId_awardedAt_idx" ON "achievement_awards"("userId", "awardedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "achievement_awards_userId_definitionId_sourceEventId_key" ON "achievement_awards"("userId", "definitionId", "sourceEventId");

-- CreateIndex
CREATE INDEX "xp_ledger_entries_userId_createdAt_idx" ON "xp_ledger_entries"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "xp_ledger_entries_userId_sourceEventId_ruleKey_key" ON "xp_ledger_entries"("userId", "sourceEventId", "ruleKey");

-- CreateIndex
CREATE UNIQUE INDEX "level_definitions_level_key" ON "level_definitions"("level");

-- CreateIndex
CREATE UNIQUE INDEX "level_definitions_minimumXp_key" ON "level_definitions"("minimumXp");

-- CreateIndex
CREATE INDEX "user_levels_levelDefinitionId_idx" ON "user_levels"("levelDefinitionId");

-- CreateIndex
CREATE INDEX "streaks_userId_updatedAt_idx" ON "streaks"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "streaks_userId_subjectType_subjectId_key" ON "streaks"("userId", "subjectType", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "challenges_key_key" ON "challenges"("key");

-- CreateIndex
CREATE INDEX "challenges_status_startsAt_endsAt_idx" ON "challenges"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "challenge_enrollments_userId_status_idx" ON "challenge_enrollments"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_enrollments_challengeId_userId_key" ON "challenge_enrollments"("challengeId", "userId");

-- CreateIndex
CREATE INDEX "metric_events_userId_name_occurredAt_idx" ON "metric_events"("userId", "name", "occurredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "metric_events_userId_sourceEventId_name_key" ON "metric_events"("userId", "sourceEventId", "name");

-- CreateIndex
CREATE INDEX "daily_metric_snapshots_userId_localDate_idx" ON "daily_metric_snapshots"("userId", "localDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "daily_metric_snapshots_userId_localDate_metricVersion_key" ON "daily_metric_snapshots"("userId", "localDate", "metricVersion");

-- CreateIndex
CREATE INDEX "report_jobs_userId_createdAt_idx" ON "report_jobs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "report_jobs_status_createdAt_idx" ON "report_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "export_jobs_userId_createdAt_idx" ON "export_jobs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "export_jobs_status_createdAt_idx" ON "export_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "export_jobs_expiresAt_idx" ON "export_jobs"("expiresAt");

-- CreateIndex
CREATE INDEX "idempotency_records_status_createdAt_idx" ON "idempotency_records"("status", "createdAt");

-- CreateIndex
CREATE INDEX "idempotency_records_expiresAt_idx" ON "idempotency_records"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_userId_route_key_key" ON "idempotency_records"("userId", "route", "key");

-- CreateIndex
CREATE INDEX "webhook_inbox_status_nextAttemptAt_receivedAt_idx" ON "webhook_inbox"("status", "nextAttemptAt", "receivedAt");

-- CreateIndex
CREATE INDEX "webhook_inbox_lockedAt_idx" ON "webhook_inbox"("lockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_inbox_provider_externalEventId_key" ON "webhook_inbox"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "outbox_events_publishedAt_nextAttemptAt_occurredAt_id_idx" ON "outbox_events"("publishedAt", "nextAttemptAt", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "outbox_events_lockedAt_idx" ON "outbox_events"("lockedAt");

-- CreateIndex
CREATE INDEX "outbox_events_userId_occurredAt_idx" ON "outbox_events"("userId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_aggregateType_aggregateId_aggregateVersion_ev_key" ON "outbox_events"("aggregateType", "aggregateId", "aggregateVersion", "eventType");

-- CreateIndex
CREATE INDEX "background_jobs_queue_status_availableAt_createdAt_idx" ON "background_jobs"("queue", "status", "availableAt", "createdAt");

-- CreateIndex
CREATE INDEX "background_jobs_lockedAt_idx" ON "background_jobs"("lockedAt");

-- CreateIndex
CREATE INDEX "background_jobs_userId_createdAt_idx" ON "background_jobs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "background_jobs_expiresAt_idx" ON "background_jobs"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "background_jobs_queue_deduplicationKey_key" ON "background_jobs"("queue", "deduplicationKey");

-- CreateIndex
CREATE INDEX "metric_definitions_active_key_idx" ON "metric_definitions"("active", "key");

-- CreateIndex
CREATE UNIQUE INDEX "metric_definitions_key_version_key" ON "metric_definitions"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_parentGoalId_fkey" FOREIGN KEY ("parentGoalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "life_visions" ADD CONSTRAINT "life_visions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "life_vision_areas" ADD CONSTRAINT "life_vision_areas_lifeVisionId_fkey" FOREIGN KEY ("lifeVisionId") REFERENCES "life_visions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_parentItemId_fkey" FOREIGN KEY ("parentItemId") REFERENCES "plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_proposals" ADD CONSTRAINT "schedule_proposals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "calendar_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_pauses" ADD CONSTRAINT "session_pauses_focusSessionId_fkey" FOREIGN KEY ("focusSessionId") REFERENCES "focus_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interruptions" ADD CONSTRAINT "interruptions_focusSessionId_fkey" FOREIGN KEY ("focusSessionId") REFERENCES "focus_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habits" ADD CONSTRAINT "habits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_entries" ADD CONSTRAINT "habit_entries_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracker_items" ADD CONSTRAINT "tracker_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracker_entries" ADD CONSTRAINT "tracker_entries_trackerItemId_fkey" FOREIGN KEY ("trackerItemId") REFERENCES "tracker_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_revisions" ADD CONSTRAINT "journal_revisions_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_context_grants" ADD CONSTRAINT "ai_context_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_context_grants" ADD CONSTRAINT "ai_context_grants_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "ai_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "ai_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_occurrences" ADD CONSTRAINT "reminder_occurrences_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "reminder_occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_awards" ADD CONSTRAINT "achievement_awards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_awards" ADD CONSTRAINT "achievement_awards_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "achievement_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_ledger_entries" ADD CONSTRAINT "xp_ledger_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_levels" ADD CONSTRAINT "user_levels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_levels" ADD CONSTRAINT "user_levels_levelDefinitionId_fkey" FOREIGN KEY ("levelDefinitionId") REFERENCES "level_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_enrollments" ADD CONSTRAINT "challenge_enrollments_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_enrollments" ADD CONSTRAINT "challenge_enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_events" ADD CONSTRAINT "metric_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_metric_snapshots" ADD CONSTRAINT "daily_metric_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domain invariants Prisma cannot express.
ALTER TABLE "calendar_events"
  ADD CONSTRAINT "calendar_events_time_range_check" CHECK ("endsAt" > "startsAt");

ALTER TABLE "focus_sessions"
  ADD CONSTRAINT "focus_sessions_planned_seconds_check" CHECK ("plannedSeconds" BETWEEN 1 AND 86400),
  ADD CONSTRAINT "focus_sessions_terminal_time_check" CHECK (
    ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND "abandonedAt" IS NULL)
    OR ("status" = 'ABANDONED' AND "abandonedAt" IS NOT NULL AND "completedAt" IS NULL)
    OR ("status" IN ('RUNNING', 'PAUSED') AND "completedAt" IS NULL AND "abandonedAt" IS NULL)
  );

ALTER TABLE "session_pauses"
  ADD CONSTRAINT "session_pauses_time_range_check" CHECK ("endedAt" IS NULL OR "endedAt" > "startedAt");

ALTER TABLE "challenges"
  ADD CONSTRAINT "challenges_time_range_check" CHECK ("endsAt" > "startsAt");

ALTER TABLE "delivery_attempts"
  ADD CONSTRAINT "delivery_attempts_attempt_check" CHECK ("attempt" > 0);

ALTER TABLE "idempotency_records"
  ADD CONSTRAINT "idempotency_records_expiry_check" CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT "idempotency_records_completion_check" CHECK (
    ("status" = 'PROCESSING' AND "completedAt" IS NULL AND "statusCode" IS NULL)
    OR ("status" IN ('COMPLETED', 'FAILED') AND "completedAt" IS NOT NULL AND "statusCode" BETWEEN 100 AND 599)
  );

ALTER TABLE "webhook_inbox"
  ADD CONSTRAINT "webhook_inbox_attempts_check" CHECK ("attempts" >= 0),
  ADD CONSTRAINT "webhook_inbox_schema_version_check" CHECK ("schemaVersion" > 0),
  ADD CONSTRAINT "webhook_inbox_payload_size_check" CHECK (
    octet_length("payloadEncrypted") BETWEEN 1 AND 1048576
  ),
  ADD CONSTRAINT "webhook_inbox_processed_check" CHECK (
    ("status" = 'PROCESSED' AND "processedAt" IS NOT NULL)
    OR ("status" <> 'PROCESSED' AND "processedAt" IS NULL)
  );

ALTER TABLE "outbox_events"
  ADD CONSTRAINT "outbox_events_versions_check" CHECK ("aggregateVersion" > 0 AND "eventVersion" > 0),
  ADD CONSTRAINT "outbox_events_attempts_check" CHECK ("publishAttempts" >= 0),
  ADD CONSTRAINT "outbox_events_payload_size_check" CHECK (pg_column_size("payload") <= 65536),
  ADD CONSTRAINT "outbox_events_terminal_state_check" CHECK (
    NOT ("publishedAt" IS NOT NULL AND "deadLetteredAt" IS NOT NULL)
  );

ALTER TABLE "background_jobs"
  ADD CONSTRAINT "background_jobs_attempts_check" CHECK (
    "attempts" >= 0 AND "maxAttempts" BETWEEN 1 AND 100
  ),
  ADD CONSTRAINT "background_jobs_schema_version_check" CHECK ("schemaVersion" > 0),
  ADD CONSTRAINT "background_jobs_payload_size_check" CHECK (pg_column_size("payload") <= 262144);

ALTER TABLE "metric_definitions"
  ADD CONSTRAINT "metric_definitions_version_check" CHECK ("version" > 0),
  ADD CONSTRAINT "metric_definitions_retirement_check" CHECK (
    "retiredAt" IS NULL OR "retiredAt" >= "effectiveFrom"
  );

-- Hot-path partial indexes keep worker and timer scans bounded.
CREATE UNIQUE INDEX "focus_sessions_one_active_per_user_idx"
  ON "focus_sessions" ("userId")
  WHERE "status" IN ('RUNNING', 'PAUSED');

CREATE INDEX "reminder_occurrences_due_idx"
  ON "reminder_occurrences" ("scheduledFor", "id")
  WHERE "status" IN ('PENDING', 'DEFERRED');

CREATE INDEX "outbox_events_ready_idx"
  ON "outbox_events" ("nextAttemptAt", "occurredAt", "id")
  WHERE "publishedAt" IS NULL AND "deadLetteredAt" IS NULL;

CREATE INDEX "webhook_inbox_ready_idx"
  ON "webhook_inbox" ("nextAttemptAt", "receivedAt", "id")
  WHERE "status" IN ('RECEIVED', 'RETRYABLE_FAILURE');

CREATE INDEX "background_jobs_ready_idx"
  ON "background_jobs" ("queue", "availableAt", "createdAt", "id")
  WHERE "status" = 'QUEUED';

-- Seed only versioned system configuration; never seed member data.
INSERT INTO "level_definitions" ("id", "level", "minimumXp", "title", "active")
VALUES (gen_random_uuid(), 1, 0, 'শুরু', TRUE)
ON CONFLICT ("level") DO UPDATE
SET "minimumXp" = EXCLUDED."minimumXp", "title" = EXCLUDED."title", "active" = EXCLUDED."active";

INSERT INTO "metric_definitions"
  ("id", "key", "version", "name", "description", "unit", "rule", "active")
VALUES
  (gen_random_uuid(), 'focus.duration', 1, 'Focus duration', 'Completed Focus Session duration.', 'seconds', '{"source":"focus_session","aggregation":"sum"}'::jsonb, TRUE),
  (gen_random_uuid(), 'focus.interruptions', 1, 'Focus interruptions', 'Interruptions recorded during Focus Sessions.', 'count', '{"source":"interruption","aggregation":"count"}'::jsonb, TRUE)
ON CONFLICT ("key", "version") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "unit" = EXCLUDED."unit",
    "rule" = EXCLUDED."rule",
    "active" = EXCLUDED."active";

INSERT INTO "feature_flags" ("id", "key", "description", "enabled", "rules", "version", "updatedAt")
VALUES
  (gen_random_uuid(), 'ai.coach', 'Controls staged access to AI Coach.', FALSE, '{}'::jsonb, 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'notifications.web_push', 'Controls staged access to Web Push.', FALSE, '{}'::jsonb, 1, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE
SET "description" = EXCLUDED."description",
    "enabled" = EXCLUDED."enabled",
    "rules" = EXCLUDED."rules",
    "version" = EXCLUDED."version",
    "updatedAt" = CURRENT_TIMESTAMP;

