import type { Actor } from "@/features/auth/application/auth-service";
import type { RequestSecurityContext } from "@/features/auth/domain/auth-types";
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
  AdminReasonCode,
} from "@/features/admin/domain/admin-types";
import type {
  AdminMfaState,
  AdminStepUpScope,
} from "@/features/admin/domain/admin-security-types";

export interface AdminOperationContext {
  readonly actor: Actor;
  readonly request: RequestSecurityContext;
}

export interface OpenAdminCaseCommand extends AdminOperationContext {
  readonly key: string;
  readonly externalReference?: string | undefined;
  readonly reasonCode: AdminReasonCode;
  readonly summary: string;
  readonly expiresAt: Date;
}

export interface CaseBoundQuery extends AdminOperationContext {
  readonly caseId: string;
}

export interface AdminRepository {
  listCases(context: AdminOperationContext): Promise<readonly AdminCaseView[]>;
  openCase(command: OpenAdminCaseCommand): Promise<AdminCaseView>;
  getOverview(query: CaseBoundQuery): Promise<AdminOverview>;
  findMember(
    query: CaseBoundQuery & { readonly identifier: string },
  ): Promise<AdminMemberView | null>;
  listFeatureFlags(
    query: CaseBoundQuery,
  ): Promise<readonly AdminFeatureFlagView[]>;
  listAuditEvents(
    query: CaseBoundQuery & {
      readonly cursor?: string;
      readonly limit: number;
    },
  ): Promise<{
    readonly items: readonly AdminAuditEventView[];
    readonly nextCursor: string | null;
  }>;
  getHealth(query: CaseBoundQuery): Promise<AdminHealthView>;
  listJobs(query: CaseBoundQuery): Promise<readonly AdminJobView[]>;
  changeUserStatus(
    input: CaseBoundQuery &
      AdminCommand & {
        readonly targetUserId: string;
        readonly status: "ACTIVE" | "SUSPENDED";
        readonly expectedVersion: number;
      },
  ): Promise<AdminMutationResult>;
  revokeUserSessions(
    input: CaseBoundQuery &
      AdminCommand & {
        readonly targetUserId: string;
      },
  ): Promise<AdminMutationResult>;
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
  ): Promise<AdminMutationResult>;
  retryJob(
    input: CaseBoundQuery &
      AdminCommand & {
        readonly jobId: string;
        readonly expectedVersion: number;
      },
  ): Promise<AdminMutationResult>;
  listApprovals(query: CaseBoundQuery): Promise<readonly AdminApprovalView[]>;
  requestRoleChange(
    input: CaseBoundQuery &
      AdminCommand & {
        readonly targetUserId: string;
        readonly roleKey: string;
        readonly operation: "GRANT" | "REVOKE";
        readonly expectedUserVersion: number;
        readonly expiresAt?: Date | undefined;
      },
  ): Promise<AdminMutationResult>;
  approveRoleChange(
    input: CaseBoundQuery &
      AdminCommand & {
        readonly approvalId: string;
        readonly expectedApprovalVersion: number;
      },
  ): Promise<AdminMutationResult>;
}

export interface AdminCommand {
  readonly clientCommandId: string;
  readonly requestHash: string;
  readonly stepUpTokenHash: string;
}

export interface AdminMfaMaterial {
  readonly encryptedSecret: Uint8Array<ArrayBuffer>;
  readonly status: "PENDING" | "ACTIVE" | "REVOKED";
  readonly lastAcceptedCounter: bigint;
  readonly version: number;
  readonly passwordHash: string | null;
  readonly authMethod: string;
  readonly authenticatedAt: Date;
}

export interface AdminSecurityRepository {
  getMfaState(context: AdminOperationContext): Promise<AdminMfaState>;
  saveMfaEnrollment(
    input: AdminOperationContext & {
      readonly encryptedSecret: Uint8Array<ArrayBuffer>;
      readonly encryptionKeyId: string;
      readonly recoveryCodeHashes: readonly string[];
    },
  ): Promise<number>;
  getMfaMaterial(
    context: AdminOperationContext,
  ): Promise<AdminMfaMaterial | null>;
  acceptMfa(
    input: AdminOperationContext & {
      readonly counter: bigint;
      readonly expectedVersion: number;
      readonly activate: boolean;
    },
  ): Promise<boolean>;
  createStepUpGrant(
    input: AdminOperationContext & {
      readonly tokenHash: string;
      readonly scope: AdminStepUpScope;
      readonly targetType?: string | undefined;
      readonly targetId?: string | undefined;
      readonly method: "PASSWORD_TOTP" | "OAUTH_TOTP";
      readonly verifiedAt: Date;
      readonly expiresAt: Date;
    },
  ): Promise<void>;
}
