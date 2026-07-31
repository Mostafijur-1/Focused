import type {
  AuthSessionRecord,
  AuthUser,
  OneTimeTokenPurpose,
  RefreshRotationResult,
  RequestSecurityContext,
} from "@/features/auth/domain/auth-types";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string | null, password: string): Promise<boolean>;
}

export interface AccessTokenClaims {
  readonly subject: string;
  readonly sessionId: string;
  readonly jwtId: string;
  readonly permissionVersion: number;
  readonly permissions: readonly string[];
}

export interface AccessTokenIssuer {
  readonly lifetimeSeconds: number;
  issue(claims: AccessTokenClaims, now: Date): Promise<string>;
  verify(token: string, now: Date): Promise<AccessTokenClaims>;
}

export interface SecureTokenGenerator {
  opaque(bytes?: number): string;
  digest(token: string): string;
  id(): string;
}

export interface AuthMessage {
  readonly kind: "verify_email" | "reset_password";
  readonly recipient: string;
  readonly displayName: string;
  readonly actionUrl: string;
  readonly expiresInMinutes: number;
  readonly locale: "bn-BD" | "en";
}

export interface AuthMessageSender {
  send(message: AuthMessage): Promise<void>;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export interface AuthRateLimiter {
  check(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitDecision>;
}

export interface NewUserInput {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly locale: "bn-BD" | "en";
  readonly timeZone: string;
  readonly verificationTokenHash: string;
  readonly verificationExpiresAt: Date;
  readonly context: RequestSecurityContext;
}

export interface NewSessionInput {
  readonly sessionId: string;
  readonly familyId: string;
  readonly refreshTokenId: string;
  readonly refreshTokenHash: string;
  readonly refreshTokenExpiresAt: Date;
  readonly sessionExpiresAt: Date;
  readonly authMethod: string;
  readonly userId: string;
  readonly context: RequestSecurityContext;
  readonly now: Date;
}

export interface RotateRefreshInput {
  readonly presentedTokenHash: string;
  readonly replacementTokenId: string;
  readonly replacementTokenHash: string;
  readonly replacementExpiresAt: Date;
  readonly context: RequestSecurityContext;
  readonly now: Date;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUser | null>;
  resolveActor(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<AuthUser | null>;
  createUser(input: NewUserInput): Promise<"created" | "exists">;
  consumeOneTimeToken(
    purpose: OneTimeTokenPurpose,
    tokenHash: string,
    now: Date,
    context: RequestSecurityContext,
  ): Promise<AuthUser | null>;
  replaceOneTimeToken(
    userId: string,
    purpose: OneTimeTokenPurpose,
    tokenHash: string,
    expiresAt: Date,
    context: RequestSecurityContext,
  ): Promise<void>;
  resetPassword(
    tokenHash: string,
    passwordHash: string,
    now: Date,
    context: RequestSecurityContext,
  ): Promise<boolean>;
  createSession(input: NewSessionInput): Promise<AuthUser>;
  rotateRefreshToken(input: RotateRefreshInput): Promise<RefreshRotationResult>;
  revokeByRefreshToken(
    refreshTokenHash: string,
    reason: string,
    context: RequestSecurityContext,
    now: Date,
  ): Promise<void>;
  revokeSession(
    actorUserId: string,
    sessionId: string,
    reason: string,
    context: RequestSecurityContext,
    now: Date,
  ): Promise<boolean>;
  revokeOtherSessions(
    actorUserId: string,
    currentSessionId: string,
    context: RequestSecurityContext,
    now: Date,
  ): Promise<number>;
  listSessions(
    actorUserId: string,
    currentSessionId: string,
  ): Promise<readonly AuthSessionRecord[]>;
  recordSecurityEvent(input: {
    readonly actorUserId?: string;
    readonly action: string;
    readonly targetId?: string;
    readonly context: RequestSecurityContext;
    readonly metadata?: Readonly<
      Record<string, string | number | boolean | null>
    >;
  }): Promise<void>;
}
