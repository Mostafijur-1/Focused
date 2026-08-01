export const adminStepUpScopes = [
  "USER_STATUS_WRITE",
  "SESSION_REVOKE",
  "FEATURE_FLAG_WRITE",
  "JOB_RETRY",
  "ROLE_CHANGE_REQUEST",
  "ROLE_CHANGE_APPROVE",
] as const;

export type AdminStepUpScope = (typeof adminStepUpScopes)[number];

export interface AdminMfaState {
  readonly status: "NOT_ENROLLED" | "PENDING" | "ACTIVE" | "REVOKED";
  readonly sessionVerified: boolean;
  readonly version: number | null;
}

export interface AdminMfaEnrollment {
  readonly secret: string;
  readonly otpauthUri: string;
  readonly recoveryCodes: readonly string[];
  readonly version: number;
}

export interface AdminStepUpGrantView {
  readonly token: string;
  readonly expiresAt: string;
  readonly scope: AdminStepUpScope;
  readonly targetType: string | null;
  readonly targetId: string | null;
}
