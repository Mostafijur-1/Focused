export const userStatuses = [
  "PENDING_VERIFICATION",
  "ACTIVE",
  "SUSPENDED",
  "DELETION_PENDING",
  "DELETED",
] as const;

export type UserStatus = (typeof userStatuses)[number];

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string | null;
  readonly emailVerifiedAt: Date | null;
  readonly status: UserStatus;
  readonly permissionVersion: number;
  readonly permissions: readonly string[];
}

export interface AuthSessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly status: "ACTIVE" | "REVOKED" | "EXPIRED";
  readonly deviceName: string | null;
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly current: boolean;
}

export interface IssuedSession {
  readonly accessToken: string;
  readonly accessTokenExpiresInSeconds: number;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
  readonly csrfToken: string;
  readonly sessionId: string;
  readonly user: Pick<AuthUser, "id" | "displayName" | "permissions">;
}

export interface RequestSecurityContext {
  readonly requestId: string;
  readonly ipPrefix: string | null;
  readonly userAgentHash: string | null;
  readonly deviceName: string | null;
}

export type OneTimeTokenPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

export type RefreshRotationResult =
  | {
      readonly kind: "rotated";
      readonly user: AuthUser;
      readonly sessionId: string;
      readonly refreshTokenExpiresAt: Date;
    }
  | { readonly kind: "replayed" }
  | { readonly kind: "invalid" };
