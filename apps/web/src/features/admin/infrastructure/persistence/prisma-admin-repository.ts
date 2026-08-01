import { createHash, randomUUID } from "node:crypto";

import type { FocusedPrismaClient } from "@focused/database";
import { Prisma } from "@focused/database/generated/client";

import type {
  AdminOperationContext,
  AdminCommand,
  AdminRepository,
  AdminSecurityRepository,
  CaseBoundQuery,
  OpenAdminCaseCommand,
} from "@/features/admin/application/ports";
import type {
  AdminAuditEventView,
  AdminApprovalView,
  AdminCaseView,
  AdminFeatureFlagView,
  AdminHealthView,
  AdminJobView,
  AdminMemberView,
  AdminMutationResult,
  AdminOverview,
} from "@/features/admin/domain/admin-types";
import type { AdminMfaState } from "@/features/admin/domain/admin-security-types";
import type { UserStatus } from "@/features/auth/domain/auth-types";
import { AppError } from "@/lib/errors/app-error";

type TransactionClient = Parameters<
  Parameters<FocusedPrismaClient["$transaction"]>[0]
>[0];

interface AdminRepositoryOptions {
  readonly groqConfigured: boolean;
  readonly geminiConfigured: boolean;
  readonly redisConfigured: boolean;
  readonly pushConfigured: boolean;
}

const adminChainKey = "admin";

export class PrismaAdminRepository
  implements AdminRepository, AdminSecurityRepository
{
  constructor(
    private readonly prisma: FocusedPrismaClient,
    private readonly options: AdminRepositoryOptions,
  ) {}

  async listCases(
    context: AdminOperationContext,
  ): Promise<readonly AdminCaseView[]> {
    return this.serializable(async (transaction) => {
      await requireVerifiedAdminSession(transaction, context);
      await appendAuditEvent(transaction, {
        context,
        action: "admin.cases.listed",
        reasonCode: "CASE_DISCOVERY",
        metadata: {},
      });
      const cases = await transaction.adminCase.findMany({
        where: { openedByUserId: context.actor.user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      return cases.map(toCaseView);
    });
  }

  async openCase(command: OpenAdminCaseCommand): Promise<AdminCaseView> {
    return this.serializable(async (transaction) => {
      await requireVerifiedAdminSession(transaction, command);
      const created = await transaction.adminCase.create({
        data: {
          key: command.key,
          externalReference: command.externalReference ?? null,
          reasonCode: command.reasonCode,
          summary: command.summary,
          openedByUserId: command.actor.user.id,
          expiresAt: command.expiresAt,
        },
      });
      await appendAuditEvent(transaction, {
        context: command,
        action: "admin.case.opened",
        targetType: "AdminCase",
        targetId: created.id,
        reasonCode: command.reasonCode,
        metadata: {
          caseKey: created.key,
          hasExternalReference: Boolean(command.externalReference),
          expiresAt: command.expiresAt.toISOString(),
        },
      });
      return toCaseView(created);
    });
  }

  getOverview(query: CaseBoundQuery): Promise<AdminOverview> {
    return this.withCase(query, "admin.overview.read", async (transaction) => {
      const [statusGroups, verified, activeSessions, queuedJobs, failedJobs] =
        await Promise.all([
          transaction.user.groupBy({ by: ["status"], _count: true }),
          transaction.user.count({ where: { emailVerifiedAt: { not: null } } }),
          transaction.authSession.count({ where: { status: "ACTIVE" } }),
          transaction.backgroundJob.count({ where: { status: "QUEUED" } }),
          transaction.backgroundJob.count({
            where: { status: { in: ["FAILED", "PARTIAL"] } },
          }),
        ]);
      const [pendingOutbox, deadLetterOutbox, failedDeliveries, failedAiRuns] =
        await Promise.all([
          transaction.outboxEvent.count({
            where: { publishedAt: null, deadLetteredAt: null },
          }),
          transaction.outboxEvent.count({
            where: { deadLetteredAt: { not: null } },
          }),
          transaction.deliveryAttempt.count({
            where: {
              status: { in: ["RETRYABLE_FAILURE", "PERMANENT_FAILURE"] },
            },
          }),
          transaction.aIRun.count({ where: { status: "FAILED" } }),
        ]);
      const byStatus = emptyStatusCounts();
      for (const group of statusGroups) {
        byStatus[group.status as UserStatus] = group._count;
      }
      return {
        generatedAt: new Date().toISOString(),
        accounts: {
          total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
          byStatus,
          verified,
        },
        activeSessions,
        operations: {
          queuedJobs,
          failedJobs,
          pendingOutbox,
          deadLetterOutbox,
          failedDeliveries,
          failedAiRuns,
        },
      };
    });
  }

  findMember(
    query: CaseBoundQuery & { readonly identifier: string },
  ): Promise<AdminMemberView | null> {
    return this.withCase(
      query,
      "admin.member.metadata_read",
      async (transaction) => {
        const member = await transaction.user.findFirst({
          where: query.identifier.includes("@")
            ? { email: query.identifier.trim().toLowerCase() }
            : { id: query.identifier },
          select: {
            id: true,
            email: true,
            status: true,
            emailVerifiedAt: true,
            createdAt: true,
            updatedAt: true,
            version: true,
            _count: {
              select: {
                sessions: { where: { status: "ACTIVE" } },
              },
            },
            roles: {
              where: {
                role: {
                  key: {
                    in: [
                      "support-administrator",
                      "platform-administrator",
                      "content-curator",
                      "auditor",
                    ],
                  },
                },
              },
              select: {
                expiresAt: true,
                role: { select: { key: true } },
              },
              orderBy: { grantedAt: "asc" },
            },
          },
        });
        if (!member) return null;
        return {
          id: member.id,
          maskedEmail: maskEmail(member.email),
          status: member.status as UserStatus,
          emailVerified: member.emailVerifiedAt !== null,
          createdAt: member.createdAt.toISOString(),
          updatedAt: member.updatedAt.toISOString(),
          version: member.version,
          activeSessionCount: member._count.sessions,
          operationalRoles: member.roles.map((assignment) => ({
            key: assignment.role.key,
            expiresAt: assignment.expiresAt?.toISOString() ?? null,
          })),
        };
      },
      { queryType: query.identifier.includes("@") ? "exact_email" : "user_id" },
    );
  }

  listFeatureFlags(
    query: CaseBoundQuery,
  ): Promise<readonly AdminFeatureFlagView[]> {
    return this.withCase(
      query,
      "admin.feature_flags.read",
      async (transaction) => {
        const flags = await transaction.featureFlag.findMany({
          orderBy: { key: "asc" },
        });
        return flags.map((flag) => ({
          id: flag.id,
          key: flag.key,
          description: flag.description,
          owner: flag.owner,
          purpose: flag.purpose,
          enabled: flag.enabled,
          safeDefault: flag.safeDefault,
          audience: flag.audience,
          reviewAt: flag.reviewAt?.toISOString() ?? null,
          expiresAt: flag.expiresAt?.toISOString() ?? null,
          rollbackPlan: flag.rollbackPlan,
          version: flag.version,
          updatedAt: flag.updatedAt.toISOString(),
        }));
      },
    );
  }

  listAuditEvents(
    query: CaseBoundQuery & {
      readonly cursor?: string;
      readonly limit: number;
    },
  ): Promise<{
    readonly items: readonly AdminAuditEventView[];
    readonly nextCursor: string | null;
  }> {
    return this.withCase(query, "admin.audit.read", async (transaction) => {
      const events = await transaction.auditEvent.findMany({
        where: { chainKey: adminChainKey },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        ...(query.cursor
          ? { cursor: { id: query.cursor }, skip: 1 }
          : undefined),
        take: query.limit + 1,
      });
      const hasMore = events.length > query.limit;
      const page = hasMore ? events.slice(0, query.limit) : events;
      return {
        items: page.map((event) => ({
          id: event.id,
          sequence: event.sequence?.toString() ?? null,
          actorUserId: event.actorUserId,
          action: event.action,
          targetType: event.targetType,
          targetId: event.targetId,
          reasonCode: event.reasonCode,
          correlationId: event.correlationId,
          outcome: event.outcome,
          metadata: event.metadata,
          previousHash: event.previousHash,
          eventHash: event.eventHash,
          occurredAt: event.occurredAt.toISOString(),
        })),
        nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
      };
    });
  }

  getHealth(query: CaseBoundQuery): Promise<AdminHealthView> {
    return this.withCase(query, "admin.health.read", async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`SELECT 1`);
      const checks: AdminHealthView["checks"] = [
        healthCheck("database", true, "Database query succeeded."),
        healthCheck(
          "redis",
          this.options.redisConfigured,
          "Redis rate limiting",
        ),
        healthCheck(
          "web_push",
          this.options.pushConfigured,
          "Web Push delivery",
        ),
        healthCheck("groq", this.options.groqConfigured, "Groq AI provider"),
        healthCheck(
          "gemini",
          this.options.geminiConfigured,
          "Gemini AI provider",
        ),
      ];
      return {
        checkedAt: new Date().toISOString(),
        overall: checks.some((check) => check.status === "degraded")
          ? "degraded"
          : "operational",
        checks,
      };
    });
  }

  listJobs(query: CaseBoundQuery): Promise<readonly AdminJobView[]> {
    return this.withCase(query, "admin.jobs.read", async (transaction) => {
      const jobs = await transaction.backgroundJob.findMany({
        where: { status: { in: ["QUEUED", "RUNNING", "PARTIAL", "FAILED"] } },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          queue: true,
          type: true,
          status: true,
          attempts: true,
          maxAttempts: true,
          failureCode: true,
          availableAt: true,
          updatedAt: true,
          version: true,
        },
      });
      return jobs.map((job) => ({
        ...job,
        availableAt: job.availableAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      }));
    });
  }

  changeUserStatus(
    input: CaseBoundQuery &
      AdminCommand & {
        readonly targetUserId: string;
        readonly status: "ACTIVE" | "SUSPENDED";
        readonly expectedVersion: number;
      },
  ): Promise<AdminMutationResult> {
    return this.withMutation(
      input,
      "USER_STATUS_WRITE",
      "User",
      input.targetUserId,
      "admin.user.status_changed",
      async (transaction) => {
        if (input.targetUserId === input.actor.user.id) {
          throw new AppError({
            code: "FORBIDDEN",
            safeMessage:
              "Administrators cannot change their own account status.",
          });
        }
        const target = await transaction.user.findUnique({
          where: { id: input.targetUserId },
          select: {
            status: true,
            version: true,
            roles: {
              where: { role: { key: "platform-administrator" } },
              select: { roleId: true },
            },
          },
        });
        if (!target) throw notFound();
        const allowed =
          (target.status === "ACTIVE" && input.status === "SUSPENDED") ||
          (target.status === "SUSPENDED" && input.status === "ACTIVE") ||
          (target.status === "PENDING_VERIFICATION" &&
            input.status === "ACTIVE");
        if (!allowed) {
          throw new AppError({
            code: "CONFLICT",
            safeMessage:
              "The requested account status transition is not allowed.",
          });
        }
        if (
          input.status === "SUSPENDED" &&
          target.roles.length > 0 &&
          (await activePlatformAdminCount(transaction)) <= 1
        ) {
          throw new AppError({
            code: "CONFLICT",
            safeMessage:
              "The last active Platform Administrator cannot be suspended.",
          });
        }
        const updated = await transaction.user.updateMany({
          where: { id: input.targetUserId, version: input.expectedVersion },
          data: {
            status: input.status,
            version: { increment: 1 },
            permissionVersion: { increment: 1 },
            ...(input.status === "ACTIVE" &&
            target.status === "PENDING_VERIFICATION"
              ? { emailVerifiedAt: new Date() }
              : {}),
          },
        });
        if (updated.count !== 1) throw staleState();
        if (input.status === "SUSPENDED") {
          const now = new Date();
          await transaction.authSession.updateMany({
            where: { userId: input.targetUserId, status: "ACTIVE" },
            data: {
              status: "REVOKED",
              revokedAt: now,
              revokeReason: "admin_suspended",
            },
          });
          await transaction.refreshToken.updateMany({
            where: { userId: input.targetUserId, revokedAt: null },
            data: { revokedAt: now },
          });
        }
        return {
          id: input.targetUserId,
          version: input.expectedVersion + 1,
          state: input.status,
          replayed: false,
        };
      },
      { requestedStatus: input.status },
    );
  }

  revokeUserSessions(
    input: CaseBoundQuery & AdminCommand & { readonly targetUserId: string },
  ): Promise<AdminMutationResult> {
    return this.withMutation(
      input,
      "SESSION_REVOKE",
      "User",
      input.targetUserId,
      "admin.user.sessions_revoked",
      async (transaction) => {
        if (input.targetUserId === input.actor.user.id) {
          throw new AppError({
            code: "FORBIDDEN",
            safeMessage: "Use the Security page to revoke your own sessions.",
          });
        }
        const target = await transaction.user.findUnique({
          where: { id: input.targetUserId },
          select: { version: true },
        });
        if (!target) throw notFound();
        const now = new Date();
        const sessions = await transaction.authSession.updateMany({
          where: { userId: input.targetUserId, status: "ACTIVE" },
          data: {
            status: "REVOKED",
            revokedAt: now,
            revokeReason: "admin_revoked",
          },
        });
        await transaction.refreshToken.updateMany({
          where: { userId: input.targetUserId, revokedAt: null },
          data: { revokedAt: now },
        });
        return {
          id: input.targetUserId,
          version: target.version,
          state: `revoked:${sessions.count}`,
          replayed: false,
        };
      },
    );
  }

  updateFeatureFlag(
    input: CaseBoundQuery &
      AdminCommand & {
        readonly flagId: string;
        readonly expectedVersion: number;
        readonly enabled: boolean;
        readonly owner: string;
        readonly purpose: string;
        readonly audience: Readonly<Record<string, unknown>>;
        readonly reviewAt?: Date | undefined;
        readonly expiresAt?: Date | undefined;
        readonly rollbackPlan: string;
      },
  ): Promise<AdminMutationResult> {
    return this.withMutation(
      input,
      "FEATURE_FLAG_WRITE",
      "FeatureFlag",
      input.flagId,
      "admin.feature_flag.changed",
      async (transaction) => {
        if (input.expiresAt && input.expiresAt <= new Date()) {
          throw new AppError({
            code: "VALIDATION_ERROR",
            safeMessage: "Feature Flag expiry must be in the future.",
          });
        }
        const updated = await transaction.featureFlag.updateMany({
          where: { id: input.flagId, version: input.expectedVersion },
          data: {
            enabled: input.enabled,
            owner: input.owner,
            purpose: input.purpose,
            audience: input.audience as Prisma.InputJsonValue,
            reviewAt: input.reviewAt ?? null,
            expiresAt: input.expiresAt ?? null,
            rollbackPlan: input.rollbackPlan,
            updatedByUserId: input.actor.user.id,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw staleState();
        return {
          id: input.flagId,
          version: input.expectedVersion + 1,
          state: input.enabled ? "enabled" : "disabled",
          replayed: false,
        };
      },
      { enabled: input.enabled },
    );
  }

  retryJob(
    input: CaseBoundQuery &
      AdminCommand & {
        readonly jobId: string;
        readonly expectedVersion: number;
      },
  ): Promise<AdminMutationResult> {
    return this.withMutation(
      input,
      "JOB_RETRY",
      "BackgroundJob",
      input.jobId,
      "admin.job.retried",
      async (transaction) => {
        const job = await transaction.backgroundJob.findUnique({
          where: { id: input.jobId },
          select: {
            status: true,
            attempts: true,
            maxAttempts: true,
            version: true,
          },
        });
        if (
          !job ||
          job.version !== input.expectedVersion ||
          !["FAILED", "PARTIAL"].includes(job.status) ||
          job.attempts >= job.maxAttempts
        ) {
          throw staleState();
        }
        const updated = await transaction.backgroundJob.updateMany({
          where: {
            id: input.jobId,
            version: input.expectedVersion,
            status: job.status,
            attempts: job.attempts,
          },
          data: {
            status: "QUEUED",
            availableAt: new Date(),
            lockedAt: null,
            lockedBy: null,
            failureCode: null,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw staleState();
        return {
          id: input.jobId,
          version: input.expectedVersion + 1,
          state: "QUEUED",
          replayed: false,
        };
      },
    );
  }

  listApprovals(query: CaseBoundQuery): Promise<readonly AdminApprovalView[]> {
    return this.withCase(
      query,
      "admin.role_approvals.read",
      async (transaction) => {
        const approvals = await transaction.adminApprovalRequest.findMany({
          where: {
            OR: [
              { status: "PENDING", expiresAt: { gt: new Date() } },
              { requestedByUserId: query.actor.user.id },
              { decidedByUserId: query.actor.user.id },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
        return approvals.map(toApprovalView);
      },
    );
  }

  requestRoleChange(
    input: CaseBoundQuery &
      AdminCommand & {
        readonly targetUserId: string;
        readonly roleKey: string;
        readonly operation: "GRANT" | "REVOKE";
        readonly expectedUserVersion: number;
        readonly expiresAt?: Date | undefined;
      },
  ): Promise<AdminMutationResult> {
    return this.withMutation(
      input,
      "ROLE_CHANGE_REQUEST",
      "User",
      input.targetUserId,
      "admin.role_change.requested",
      async (transaction) => {
        if (input.targetUserId === input.actor.user.id) {
          throw new AppError({
            code: "FORBIDDEN",
            safeMessage: "Self role changes are not allowed.",
          });
        }
        const [target, role] = await Promise.all([
          transaction.user.findUnique({
            where: { id: input.targetUserId },
            select: { version: true },
          }),
          transaction.role.findUnique({
            where: { key: input.roleKey },
            select: {
              id: true,
              permissions: {
                select: { permission: { select: { key: true } } },
              },
            },
          }),
        ]);
        if (!target || !role) throw notFound();
        if (target.version !== input.expectedUserVersion) throw staleState();
        const delegated = role.permissions.every(({ permission }) =>
          input.actor.user.permissions.includes(permission.key),
        );
        if (!delegated) {
          throw new AppError({
            code: "FORBIDDEN",
            safeMessage: "The requested role exceeds your delegation boundary.",
          });
        }
        const payload = {
          roleKey: input.roleKey,
          operation: input.operation,
          expectedUserVersion: input.expectedUserVersion,
          expiresAt: input.expiresAt?.toISOString() ?? null,
        };
        const approval = await transaction.adminApprovalRequest.create({
          data: {
            action: "ROLE_CHANGE",
            targetUserId: input.targetUserId,
            payload,
            payloadHash: createHash("sha256")
              .update(canonicalJson(payload))
              .digest("hex"),
            caseId: input.caseId,
            requestedByUserId: input.actor.user.id,
            expiresAt: new Date(Date.now() + 30 * 60_000),
          },
        });
        return {
          id: approval.id,
          version: approval.version,
          state: approval.status,
          replayed: false,
        };
      },
      { roleKey: input.roleKey, operation: input.operation },
    );
  }

  approveRoleChange(
    input: CaseBoundQuery &
      AdminCommand & {
        readonly approvalId: string;
        readonly expectedApprovalVersion: number;
      },
  ): Promise<AdminMutationResult> {
    return this.withMutation(
      input,
      "ROLE_CHANGE_APPROVE",
      "AdminApprovalRequest",
      input.approvalId,
      "admin.role_change.executed",
      async (transaction) => {
        const approval = await transaction.adminApprovalRequest.findUnique({
          where: { id: input.approvalId },
        });
        if (!approval || approval.action !== "ROLE_CHANGE") throw notFound();
        if (approval.requestedByUserId === input.actor.user.id) {
          throw new AppError({
            code: "FORBIDDEN",
            safeMessage:
              "A different Platform Administrator must approve this change.",
          });
        }
        if (
          approval.status !== "PENDING" ||
          approval.expiresAt <= new Date() ||
          approval.version !== input.expectedApprovalVersion
        ) {
          throw staleState();
        }
        const payload = roleChangePayload(approval.payload);
        if (
          createHash("sha256").update(canonicalJson(payload)).digest("hex") !==
          approval.payloadHash
        ) {
          throw new Error("Role approval payload integrity check failed.");
        }
        if (!approval.targetUserId)
          throw new Error("Role approval target missing.");
        const role = await transaction.role.findUnique({
          where: { key: payload.roleKey },
          select: {
            id: true,
            permissions: {
              select: { permission: { select: { key: true } } },
            },
          },
        });
        if (!role) throw notFound();
        if (
          !role.permissions.every(({ permission }) =>
            input.actor.user.permissions.includes(permission.key),
          )
        ) {
          throw new AppError({
            code: "FORBIDDEN",
            safeMessage: "The role exceeds your delegation boundary.",
          });
        }
        if (
          payload.operation === "REVOKE" &&
          payload.roleKey === "platform-administrator" &&
          (await activePlatformAdminCount(transaction)) <= 1
        ) {
          throw new AppError({
            code: "CONFLICT",
            safeMessage:
              "The last active Platform Administrator cannot be removed.",
          });
        }
        const target = await transaction.user.updateMany({
          where: {
            id: approval.targetUserId,
            version: payload.expectedUserVersion,
          },
          data: {
            version: { increment: 1 },
            permissionVersion: { increment: 1 },
          },
        });
        if (target.count !== 1) throw staleState();
        if (payload.operation === "GRANT") {
          await transaction.userRole.create({
            data: {
              userId: approval.targetUserId,
              roleId: role.id,
              grantedById: input.actor.user.id,
              expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
            },
          });
        } else {
          const removed = await transaction.userRole.deleteMany({
            where: { userId: approval.targetUserId, roleId: role.id },
          });
          if (removed.count !== 1) throw staleState();
        }
        const executed = await transaction.adminApprovalRequest.updateMany({
          where: {
            id: approval.id,
            version: input.expectedApprovalVersion,
            status: "PENDING",
          },
          data: {
            status: "EXECUTED",
            decidedByUserId: input.actor.user.id,
            decidedAt: new Date(),
            executedAt: new Date(),
            version: { increment: 1 },
          },
        });
        if (executed.count !== 1) throw staleState();
        return {
          id: approval.id,
          version: input.expectedApprovalVersion + 1,
          state: "EXECUTED",
          replayed: false,
        };
      },
    );
  }

  async getMfaState(context: AdminOperationContext): Promise<AdminMfaState> {
    return this.serializable(async (transaction) => {
      const [credential, session] = await Promise.all([
        transaction.operationalMfaCredential.findUnique({
          where: { userId: context.actor.user.id },
          select: { status: true, version: true },
        }),
        transaction.authSession.findFirst({
          where: {
            id: context.actor.sessionId,
            userId: context.actor.user.id,
            status: "ACTIVE",
          },
          select: { mfaVerifiedAt: true },
        }),
      ]);
      await appendAuditEvent(transaction, {
        context,
        action: "admin.mfa.state_read",
        targetType: "User",
        targetId: context.actor.user.id,
        reasonCode: "MFA_SETUP",
        metadata: {},
      });
      return {
        status: credential?.status ?? "NOT_ENROLLED",
        sessionVerified: Boolean(session?.mfaVerifiedAt),
        version: credential?.version ?? null,
      };
    });
  }

  saveMfaEnrollment(
    input: AdminOperationContext & {
      readonly encryptedSecret: Uint8Array<ArrayBuffer>;
      readonly encryptionKeyId: string;
      readonly recoveryCodeHashes: readonly string[];
    },
  ): Promise<number> {
    return this.serializable(async (transaction) => {
      const existing = await transaction.operationalMfaCredential.findUnique({
        where: { userId: input.actor.user.id },
        select: { status: true },
      });
      if (existing?.status === "ACTIVE") {
        throw new AppError({
          code: "CONFLICT",
          safeMessage: "Operational MFA is already active.",
        });
      }
      const credential = await transaction.operationalMfaCredential.upsert({
        where: { userId: input.actor.user.id },
        create: {
          userId: input.actor.user.id,
          encryptedSecret: input.encryptedSecret,
          encryptionKeyId: input.encryptionKeyId,
          recoveryCodeHashes: [...input.recoveryCodeHashes],
        },
        update: {
          encryptedSecret: input.encryptedSecret,
          encryptionKeyId: input.encryptionKeyId,
          recoveryCodeHashes: [...input.recoveryCodeHashes],
          status: "PENDING",
          lastAcceptedCounter: -1n,
          enrolledAt: null,
          revokedAt: null,
          version: { increment: 1 },
        },
        select: { version: true },
      });
      await appendAuditEvent(transaction, {
        context: input,
        action: "admin.mfa.enrollment_started",
        targetType: "User",
        targetId: input.actor.user.id,
        reasonCode: "MFA_SETUP",
        metadata: {},
      });
      return credential.version;
    });
  }

  async getMfaMaterial(context: AdminOperationContext) {
    const record = await this.prisma.operationalMfaCredential.findUnique({
      where: { userId: context.actor.user.id },
      select: {
        encryptedSecret: true,
        status: true,
        lastAcceptedCounter: true,
        version: true,
        user: { select: { passwordHash: true } },
      },
    });
    if (!record) return null;
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: context.actor.sessionId,
        userId: context.actor.user.id,
        status: "ACTIVE",
      },
      select: { authMethod: true, authenticatedAt: true },
    });
    if (!session) return null;
    return {
      encryptedSecret: record.encryptedSecret,
      status: record.status,
      lastAcceptedCounter: record.lastAcceptedCounter,
      version: record.version,
      passwordHash: record.user.passwordHash,
      authMethod: session.authMethod,
      authenticatedAt: session.authenticatedAt,
    };
  }

  acceptMfa(
    input: AdminOperationContext & {
      readonly counter: bigint;
      readonly expectedVersion: number;
      readonly activate: boolean;
    },
  ): Promise<boolean> {
    return this.serializable(async (transaction) => {
      const updated = await transaction.operationalMfaCredential.updateMany({
        where: {
          userId: input.actor.user.id,
          version: input.expectedVersion,
          lastAcceptedCounter: { lt: input.counter },
          status: input.activate ? "PENDING" : "ACTIVE",
        },
        data: {
          lastAcceptedCounter: input.counter,
          ...(input.activate
            ? { status: "ACTIVE" as const, enrolledAt: new Date() }
            : {}),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) return false;
      const session = await transaction.authSession.updateMany({
        where: {
          id: input.actor.sessionId,
          userId: input.actor.user.id,
          status: "ACTIVE",
        },
        data: { mfaVerifiedAt: new Date() },
      });
      if (session.count !== 1) throw new Error("Active admin session missing.");
      await appendAuditEvent(transaction, {
        context: input,
        action: input.activate
          ? "admin.mfa.enrollment_completed"
          : "admin.mfa.session_verified",
        targetType: "User",
        targetId: input.actor.user.id,
        reasonCode: "MFA_VERIFICATION",
        metadata: {},
      });
      return true;
    });
  }

  createStepUpGrant(
    input: AdminOperationContext & {
      readonly tokenHash: string;
      readonly scope: import("@/features/admin/domain/admin-security-types").AdminStepUpScope;
      readonly targetType?: string | undefined;
      readonly targetId?: string | undefined;
      readonly method: "PASSWORD_TOTP" | "OAUTH_TOTP";
      readonly verifiedAt: Date;
      readonly expiresAt: Date;
    },
  ): Promise<void> {
    return this.serializable(async (transaction) => {
      await transaction.adminStepUpGrant.create({
        data: {
          userId: input.actor.user.id,
          sessionId: input.actor.sessionId,
          tokenHash: input.tokenHash,
          scopes: [input.scope],
          targetType: input.targetType ?? null,
          targetId: input.targetId ?? null,
          method: input.method,
          mfaVerifiedAt: input.verifiedAt,
          expiresAt: input.expiresAt,
        },
      });
      await appendAuditEvent(transaction, {
        context: input,
        action: "admin.step_up.granted",
        ...(input.targetType ? { targetType: input.targetType } : {}),
        ...(input.targetId ? { targetId: input.targetId } : {}),
        reasonCode: "STEP_UP",
        metadata: {
          scope: input.scope,
          expiresAt: input.expiresAt.toISOString(),
        },
      });
    });
  }

  private async withMutation(
    input: CaseBoundQuery & AdminCommand,
    scope: import("@/features/admin/domain/admin-security-types").AdminStepUpScope,
    targetType: string,
    targetId: string,
    action: string,
    operation: (transaction: TransactionClient) => Promise<AdminMutationResult>,
    metadata: Readonly<Record<string, unknown>> = {},
  ): Promise<AdminMutationResult> {
    return this.serializable(async (transaction) => {
      await requireVerifiedAdminSession(transaction, input);
      const adminCase = await transaction.adminCase.findFirst({
        where: {
          id: input.caseId,
          openedByUserId: input.actor.user.id,
          status: "OPEN",
          expiresAt: { gt: new Date() },
        },
        select: { id: true, key: true, reasonCode: true },
      });
      if (!adminCase) {
        throw new AppError({
          code: "FORBIDDEN",
          safeMessage: "An active operational case is required.",
        });
      }
      const reservation = await reserveAdminCommand(transaction, input, action);
      if (reservation.kind === "replay") {
        return { ...reservation.result, replayed: true };
      }
      await consumeStepUpGrant(transaction, input, scope, targetType, targetId);
      const result = await operation(transaction);
      await appendAuditEvent(transaction, {
        context: input,
        action,
        targetType,
        targetId,
        reasonCode: adminCase.reasonCode,
        metadata: {
          caseKey: adminCase.key,
          scope,
          resultState: result.state,
          ...metadata,
        },
      });
      await transaction.idempotencyRecord.update({
        where: { id: reservation.recordId },
        data: {
          status: "COMPLETED",
          statusCode: 200,
          response: {
            id: result.id,
            version: result.version,
            state: result.state,
            replayed: result.replayed,
          },
          resourceId: result.id,
          completedAt: new Date(),
        },
      });
      return result;
    });
  }

  private async withCase<T>(
    query: CaseBoundQuery,
    action: string,
    read: (transaction: TransactionClient) => Promise<T>,
    metadata: Readonly<Record<string, unknown>> = {},
  ): Promise<T> {
    return this.serializable(async (transaction) => {
      await requireVerifiedAdminSession(transaction, query);
      const adminCase = await transaction.adminCase.findFirst({
        where: {
          id: query.caseId,
          openedByUserId: query.actor.user.id,
          status: "OPEN",
          expiresAt: { gt: new Date() },
        },
        select: { id: true, key: true, reasonCode: true },
      });
      if (!adminCase) {
        throw new AppError({
          code: "FORBIDDEN",
          safeMessage: "An active operational case is required.",
        });
      }
      await appendAuditEvent(transaction, {
        context: query,
        action,
        targetType: "AdminCase",
        targetId: adminCase.id,
        reasonCode: adminCase.reasonCode,
        metadata: { caseKey: adminCase.key, ...metadata },
      });
      return read(transaction);
    });
  }

  private serializable<T>(
    operation: (transaction: TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 15_000,
    });
  }
}

interface AuditInput {
  readonly context: AdminOperationContext;
  readonly action: string;
  readonly targetType?: string;
  readonly targetId?: string;
  readonly reasonCode: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

async function appendAuditEvent(
  transaction: TransactionClient,
  input: AuditInput,
): Promise<void> {
  await transaction.$executeRaw(Prisma.sql`
    INSERT INTO "audit_chain_heads" ("chainKey", "lastSequence", "updatedAt")
    VALUES (${adminChainKey}, 0, CURRENT_TIMESTAMP)
    ON CONFLICT ("chainKey") DO NOTHING
  `);
  const heads = await transaction.$queryRaw<
    readonly { lastSequence: bigint; lastHash: string | null }[]
  >(Prisma.sql`
    SELECT "lastSequence", "lastHash"
    FROM "audit_chain_heads"
    WHERE "chainKey" = ${adminChainKey}
    FOR UPDATE
  `);
  const head = heads[0];
  if (!head) throw new Error("Admin audit chain head is unavailable.");

  const id = randomUUID();
  const occurredAt = new Date();
  const sequence = head.lastSequence + 1n;
  const canonical = canonicalJson({
    action: input.action,
    actorUserId: input.context.actor.user.id,
    actorType: "USER",
    chainKey: adminChainKey,
    correlationId: input.context.request.requestId,
    id,
    metadata: input.metadata,
    occurredAt: occurredAt.toISOString(),
    outcome: "ALLOWED",
    previousHash: head.lastHash,
    reasonCode: input.reasonCode,
    schemaVersion: 1,
    sequence: sequence.toString(),
    targetId: input.targetId ?? null,
    targetType: input.targetType ?? null,
  });
  const eventHash = createHash("sha256").update(canonical).digest("hex");

  await transaction.auditEvent.create({
    data: {
      id,
      actorUserId: input.context.actor.user.id,
      actorType: "USER",
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      reasonCode: input.reasonCode,
      correlationId: input.context.request.requestId,
      ipPrefix: input.context.request.ipPrefix,
      metadata: input.metadata as Prisma.InputJsonValue,
      outcome: "ALLOWED",
      chainKey: adminChainKey,
      sequence,
      previousHash: head.lastHash,
      eventHash,
      occurredAt,
    },
  });
  await transaction.auditChainHead.update({
    where: { chainKey: adminChainKey },
    data: { lastSequence: sequence, lastHash: eventHash },
  });
}

async function requireVerifiedAdminSession(
  transaction: TransactionClient,
  context: AdminOperationContext,
): Promise<void> {
  const session = await transaction.authSession.findFirst({
    where: {
      id: context.actor.sessionId,
      userId: context.actor.user.id,
      status: "ACTIVE",
      mfaVerifiedAt: { not: null },
    },
    select: { id: true },
  });
  if (!session) {
    throw new AppError({
      code: "FORBIDDEN",
      safeMessage: "Operational MFA verification is required.",
      details: { reason: "mfa_required" },
    });
  }
}

async function reserveAdminCommand(
  transaction: TransactionClient,
  input: AdminCommand & AdminOperationContext,
  route: string,
): Promise<
  | { readonly kind: "reserved"; readonly recordId: string }
  | { readonly kind: "replay"; readonly result: AdminMutationResult }
> {
  const existing = await transaction.idempotencyRecord.findUnique({
    where: {
      userId_route_key: {
        userId: input.actor.user.id,
        route,
        key: input.clientCommandId,
      },
    },
  });
  if (existing) {
    if (existing.requestHash !== input.requestHash) {
      throw new AppError({
        code: "CONFLICT",
        safeMessage:
          "The command identifier was already used for different input.",
      });
    }
    if (existing.status !== "COMPLETED" || !existing.response) {
      throw new AppError({
        code: "CONFLICT",
        safeMessage: "The command is already being processed.",
      });
    }
    return { kind: "replay", result: adminMutationResult(existing.response) };
  }
  const created = await transaction.idempotencyRecord.create({
    data: {
      userId: input.actor.user.id,
      route,
      key: input.clientCommandId,
      requestHash: input.requestHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
    },
    select: { id: true },
  });
  return { kind: "reserved", recordId: created.id };
}

async function consumeStepUpGrant(
  transaction: TransactionClient,
  input: AdminCommand & AdminOperationContext,
  scope: string,
  targetType: string,
  targetId: string,
): Promise<void> {
  const grant = await transaction.adminStepUpGrant.findUnique({
    where: { tokenHash: input.stepUpTokenHash },
  });
  const scopes = Array.isArray(grant?.scopes) ? grant.scopes : [];
  const valid =
    grant?.userId === input.actor.user.id &&
    grant.sessionId === input.actor.sessionId &&
    grant.consumedAt === null &&
    grant.expiresAt > new Date() &&
    grant.targetType === targetType &&
    grant.targetId === targetId &&
    scopes.includes(scope);
  if (!valid || !grant) {
    throw new AppError({
      code: "FORBIDDEN",
      safeMessage: "A fresh step-up grant for this action is required.",
      details: { reason: "step_up_required" },
    });
  }
  const consumed = await transaction.adminStepUpGrant.updateMany({
    where: { id: grant.id, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) throw staleState();
}

function adminMutationResult(value: unknown): AdminMutationResult {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !("version" in value) ||
    typeof value.version !== "number" ||
    !("state" in value) ||
    typeof value.state !== "string"
  ) {
    throw new Error("Stored admin command response is invalid.");
  }
  return {
    id: value.id,
    version: value.version,
    state: value.state,
    replayed: true,
  };
}

async function activePlatformAdminCount(
  transaction: TransactionClient,
): Promise<number> {
  return transaction.user.count({
    where: {
      status: "ACTIVE",
      roles: {
        some: {
          role: { key: "platform-administrator" },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      },
    },
  });
}

function toApprovalView(approval: {
  readonly id: string;
  readonly action: string;
  readonly targetUserId: string | null;
  readonly payload: unknown;
  readonly requestedByUserId: string;
  readonly decidedByUserId: string | null;
  readonly status: AdminApprovalView["status"];
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly version: number;
}): AdminApprovalView {
  return {
    ...approval,
    status:
      approval.status === "PENDING" && approval.expiresAt <= new Date()
        ? "EXPIRED"
        : approval.status,
    expiresAt: approval.expiresAt.toISOString(),
    createdAt: approval.createdAt.toISOString(),
  };
}

function roleChangePayload(value: unknown): {
  readonly roleKey: string;
  readonly operation: "GRANT" | "REVOKE";
  readonly expectedUserVersion: number;
  readonly expiresAt: string | null;
} {
  if (
    typeof value !== "object" ||
    value === null ||
    !("roleKey" in value) ||
    typeof value.roleKey !== "string" ||
    !("operation" in value) ||
    (value.operation !== "GRANT" && value.operation !== "REVOKE") ||
    !("expectedUserVersion" in value) ||
    typeof value.expectedUserVersion !== "number" ||
    !("expiresAt" in value) ||
    (value.expiresAt !== null && typeof value.expiresAt !== "string")
  ) {
    throw new Error("Role approval payload is invalid.");
  }
  return {
    roleKey: value.roleKey,
    operation: value.operation,
    expectedUserVersion: value.expectedUserVersion,
    expiresAt: value.expiresAt,
  };
}

function notFound(): AppError {
  return new AppError({
    code: "NOT_FOUND",
    safeMessage: "Resource not found.",
  });
}

function staleState(): AppError {
  return new AppError({
    code: "CONFLICT",
    safeMessage:
      "The resource changed. Refresh and review before trying again.",
  });
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const object = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}

function toCaseView(adminCase: {
  readonly id: string;
  readonly key: string;
  readonly externalReference: string | null;
  readonly reasonCode: string;
  readonly summary: string;
  readonly status: "OPEN" | "CLOSED" | "EXPIRED";
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly version: number;
}): AdminCaseView {
  const expired =
    adminCase.status === "OPEN" && adminCase.expiresAt <= new Date();
  return {
    ...adminCase,
    status: expired ? "EXPIRED" : adminCase.status,
    expiresAt: adminCase.expiresAt.toISOString(),
    createdAt: adminCase.createdAt.toISOString(),
  };
}

function emptyStatusCounts(): Record<UserStatus, number> {
  return {
    PENDING_VERIFICATION: 0,
    ACTIVE: 0,
    SUSPENDED: 0,
    DELETION_PENDING: 0,
    DELETED: 0,
  };
}

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function healthCheck(
  key: string,
  configured: boolean,
  message: string,
): AdminHealthView["checks"][number] {
  return configured
    ? { key, status: "operational", message }
    : {
        key,
        status: "not_configured",
        message: `${message} is not configured.`,
      };
}
