import type { UserStatus } from "@/features/auth/domain/auth-types";

export const operationalRoleKeys = [
  "support-administrator",
  "platform-administrator",
  "content-curator",
  "auditor",
] as const;

export type OperationalRoleKey = (typeof operationalRoleKeys)[number];

export const adminReasonCodes = [
  "ACCOUNT_ACCESS",
  "ACCOUNT_SECURITY",
  "DELIVERY_INVESTIGATION",
  "INCIDENT_RESPONSE",
  "COMPLIANCE_REVIEW",
  "CONTENT_OPERATION",
  "ROLLOUT_OPERATION",
] as const;

export type AdminReasonCode = (typeof adminReasonCodes)[number];

export interface AdminCaseView {
  readonly id: string;
  readonly key: string;
  readonly externalReference: string | null;
  readonly reasonCode: string;
  readonly summary: string;
  readonly status: "OPEN" | "CLOSED" | "EXPIRED";
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly version: number;
}

export interface AdminOverview {
  readonly generatedAt: string;
  readonly accounts: {
    readonly total: number;
    readonly byStatus: Readonly<Record<UserStatus, number>>;
    readonly verified: number;
  };
  readonly activeSessions: number;
  readonly operations: {
    readonly queuedJobs: number;
    readonly failedJobs: number;
    readonly pendingOutbox: number;
    readonly deadLetterOutbox: number;
    readonly failedDeliveries: number;
    readonly failedAiRuns: number;
  };
}

export interface AdminMemberView {
  readonly id: string;
  readonly maskedEmail: string;
  readonly status: UserStatus;
  readonly emailVerified: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
  readonly activeSessionCount: number;
  readonly operationalRoles: readonly {
    readonly key: string;
    readonly expiresAt: string | null;
  }[];
}

export interface AdminFeatureFlagView {
  readonly id: string;
  readonly key: string;
  readonly description: string;
  readonly owner: string;
  readonly purpose: string;
  readonly enabled: boolean;
  readonly safeDefault: boolean;
  readonly audience: unknown;
  readonly reviewAt: string | null;
  readonly expiresAt: string | null;
  readonly rollbackPlan: string;
  readonly version: number;
  readonly updatedAt: string;
}

export interface AdminAuditEventView {
  readonly id: string;
  readonly sequence: string | null;
  readonly actorUserId: string | null;
  readonly action: string;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly reasonCode: string | null;
  readonly correlationId: string;
  readonly outcome: "ALLOWED" | "DENIED" | "FAILED";
  readonly metadata: unknown;
  readonly previousHash: string | null;
  readonly eventHash: string | null;
  readonly occurredAt: string;
}

export interface AdminHealthView {
  readonly checkedAt: string;
  readonly overall: "operational" | "degraded";
  readonly checks: readonly {
    readonly key: string;
    readonly status: "operational" | "degraded" | "not_configured";
    readonly message: string;
  }[];
}

export interface AdminApprovalView {
  readonly id: string;
  readonly action: string;
  readonly targetUserId: string | null;
  readonly payload: unknown;
  readonly requestedByUserId: string;
  readonly decidedByUserId: string | null;
  readonly status:
    "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "EXECUTED" | "CANCELLED";
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly version: number;
}

export interface AdminMutationResult {
  readonly id: string;
  readonly version: number;
  readonly state: string;
  readonly replayed: boolean;
}

export interface AdminJobView {
  readonly id: string;
  readonly queue: string;
  readonly type: string;
  readonly status:
    | "QUEUED"
    | "RUNNING"
    | "COMPLETED"
    | "PARTIAL"
    | "FAILED"
    | "CANCELLED"
    | "EXPIRED";
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly failureCode: string | null;
  readonly availableAt: string;
  readonly updatedAt: string;
  readonly version: number;
}
