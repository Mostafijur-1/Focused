import { createHash, randomBytes } from "node:crypto";

import type { Actor } from "@/features/auth/application/auth-service";
import { requirePermission } from "@/features/auth/application/authorization-policy";
import type { RequestSecurityContext } from "@/features/auth/domain/auth-types";
import type { AdminReasonCode } from "@/features/admin/domain/admin-types";
import { operationalRoleKeys } from "@/features/admin/domain/admin-types";
import { AppError } from "@/lib/errors/app-error";

import type { AdminRepository } from "./ports";

interface AdminServiceDependencies {
  readonly repository: AdminRepository;
  readonly now: () => Date;
}

interface RequestActorContext {
  readonly actor: Actor;
  readonly request: RequestSecurityContext;
}

export class AdminService {
  constructor(private readonly dependencies: AdminServiceDependencies) {}

  listCases(context: RequestActorContext) {
    requirePermission(context.actor.user, "admin:cases:read");
    return this.dependencies.repository.listCases(context);
  }

  openCase(
    context: RequestActorContext,
    input: {
      readonly externalReference?: string | undefined;
      readonly reasonCode: AdminReasonCode;
      readonly summary: string;
      readonly durationMinutes: number;
    },
  ) {
    requirePermission(context.actor.user, "admin:cases:write");
    const now = this.dependencies.now();
    return this.dependencies.repository.openCase({
      ...context,
      key: `CASE-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(5).toString("hex").toUpperCase()}`,
      ...input,
      expiresAt: new Date(now.getTime() + input.durationMinutes * 60_000),
    });
  }

  getOverview(context: RequestActorContext, caseId: string) {
    requirePermission(context.actor.user, "admin:access");
    requirePermission(context.actor.user, "admin:health:read");
    return this.dependencies.repository.getOverview({ ...context, caseId });
  }

  findMember(context: RequestActorContext, caseId: string, identifier: string) {
    requirePermission(context.actor.user, "admin:users:read:metadata");
    if (!identifier.includes("@") && !isUuid(identifier)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        safeMessage: "Use an exact email address or user ID.",
      });
    }
    return this.dependencies.repository.findMember({
      ...context,
      caseId,
      identifier,
    });
  }

  listFeatureFlags(context: RequestActorContext, caseId: string) {
    requirePermission(context.actor.user, "admin:feature_flags:read");
    return this.dependencies.repository.listFeatureFlags({
      ...context,
      caseId,
    });
  }

  listAuditEvents(
    context: RequestActorContext,
    caseId: string,
    input: { readonly cursor?: string; readonly limit: number },
  ) {
    requirePermission(context.actor.user, "admin:audit:read");
    return this.dependencies.repository.listAuditEvents({
      ...context,
      caseId,
      ...input,
    });
  }

  getHealth(context: RequestActorContext, caseId: string) {
    requirePermission(context.actor.user, "admin:health:read");
    return this.dependencies.repository.getHealth({ ...context, caseId });
  }

  listJobs(context: RequestActorContext, caseId: string) {
    requirePermission(context.actor.user, "admin:jobs:read");
    return this.dependencies.repository.listJobs({ ...context, caseId });
  }

  changeUserStatus(
    context: RequestActorContext,
    input: {
      readonly caseId: string;
      readonly clientCommandId: string;
      readonly stepUpToken: string;
      readonly targetUserId: string;
      readonly status: "ACTIVE" | "SUSPENDED";
      readonly expectedVersion: number;
    },
  ) {
    requirePermission(context.actor.user, "admin:users:status:write");
    return this.dependencies.repository.changeUserStatus({
      ...context,
      ...commandEnvelope(input),
      caseId: input.caseId,
      targetUserId: input.targetUserId,
      status: input.status,
      expectedVersion: input.expectedVersion,
    });
  }

  revokeUserSessions(
    context: RequestActorContext,
    input: {
      readonly caseId: string;
      readonly clientCommandId: string;
      readonly stepUpToken: string;
      readonly targetUserId: string;
    },
  ) {
    requirePermission(context.actor.user, "admin:sessions:revoke");
    return this.dependencies.repository.revokeUserSessions({
      ...context,
      ...commandEnvelope(input),
      caseId: input.caseId,
      targetUserId: input.targetUserId,
    });
  }

  updateFeatureFlag(
    context: RequestActorContext,
    input: {
      readonly caseId: string;
      readonly clientCommandId: string;
      readonly stepUpToken: string;
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
  ) {
    requirePermission(context.actor.user, "admin:feature_flags:write");
    const envelope = commandEnvelope(input);
    return this.dependencies.repository.updateFeatureFlag({
      ...context,
      ...envelope,
      caseId: input.caseId,
      flagId: input.flagId,
      expectedVersion: input.expectedVersion,
      enabled: input.enabled,
      owner: input.owner,
      purpose: input.purpose,
      audience: input.audience,
      reviewAt: input.reviewAt,
      expiresAt: input.expiresAt,
      rollbackPlan: input.rollbackPlan,
    });
  }

  retryJob(
    context: RequestActorContext,
    input: {
      readonly caseId: string;
      readonly clientCommandId: string;
      readonly stepUpToken: string;
      readonly jobId: string;
      readonly expectedVersion: number;
    },
  ) {
    requirePermission(context.actor.user, "admin:jobs:retry");
    return this.dependencies.repository.retryJob({
      ...context,
      ...commandEnvelope(input),
      caseId: input.caseId,
      jobId: input.jobId,
      expectedVersion: input.expectedVersion,
    });
  }

  listApprovals(context: RequestActorContext, caseId: string) {
    requirePermission(context.actor.user, "admin:roles:read");
    return this.dependencies.repository.listApprovals({ ...context, caseId });
  }

  requestRoleChange(
    context: RequestActorContext,
    input: {
      readonly caseId: string;
      readonly clientCommandId: string;
      readonly stepUpToken: string;
      readonly targetUserId: string;
      readonly roleKey: string;
      readonly operation: "GRANT" | "REVOKE";
      readonly expectedUserVersion: number;
      readonly expiresAt?: Date | undefined;
    },
  ) {
    requirePermission(context.actor.user, "admin:roles:write");
    if (!(operationalRoleKeys as readonly string[]).includes(input.roleKey)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        safeMessage: "The operational role is invalid.",
      });
    }
    const envelope = commandEnvelope(input);
    return this.dependencies.repository.requestRoleChange({
      ...context,
      ...envelope,
      caseId: input.caseId,
      targetUserId: input.targetUserId,
      roleKey: input.roleKey,
      operation: input.operation,
      expectedUserVersion: input.expectedUserVersion,
      expiresAt: input.expiresAt,
    });
  }

  approveRoleChange(
    context: RequestActorContext,
    input: {
      readonly caseId: string;
      readonly clientCommandId: string;
      readonly stepUpToken: string;
      readonly approvalId: string;
      readonly expectedApprovalVersion: number;
    },
  ) {
    requirePermission(context.actor.user, "admin:roles:write");
    const envelope = commandEnvelope(input);
    return this.dependencies.repository.approveRoleChange({
      ...context,
      ...envelope,
      caseId: input.caseId,
      approvalId: input.approvalId,
      expectedApprovalVersion: input.expectedApprovalVersion,
    });
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function commandEnvelope(
  input: {
    readonly clientCommandId: string;
    readonly stepUpToken: string;
  } & Readonly<Record<string, unknown>>,
) {
  const { stepUpToken, ...request } = input;
  return {
    clientCommandId: input.clientCommandId,
    requestHash: createHash("sha256")
      .update(canonicalJson(request))
      .digest("hex"),
    stepUpTokenHash: createHash("sha256").update(stepUpToken).digest("hex"),
  };
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const object = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(object)
    .filter((key) => object[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}
