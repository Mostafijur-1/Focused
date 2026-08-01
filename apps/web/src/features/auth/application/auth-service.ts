import type { Clock } from "@/application/ports/clock";
import type {
  AuthSessionRecord,
  AuthUser,
  IssuedSession,
  RequestSecurityContext,
} from "@/features/auth/domain/auth-types";
import {
  authPolicy,
  canAuthenticate,
  normalizeEmail,
  validatePassword,
} from "@/features/auth/domain/auth-policy";
import { AppError } from "@/lib/errors/app-error";

import { requirePermission } from "./authorization-policy";

import type {
  AccessTokenIssuer,
  AuthMessageSender,
  AuthRateLimiter,
  AuthRepository,
  PasswordHasher,
  SecureTokenGenerator,
} from "./ports";

export interface AuthServiceDependencies {
  readonly repository: AuthRepository;
  readonly passwordHasher?: PasswordHasher;
  readonly accessTokens: AccessTokenIssuer;
  readonly tokens: SecureTokenGenerator;
  readonly messages?: AuthMessageSender;
  readonly rateLimiter: AuthRateLimiter;
  readonly clock: Clock;
  readonly appUrl: string;
}

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly locale: "bn-BD" | "en";
  readonly timeZone: string;
  readonly context: RequestSecurityContext;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
  readonly context: RequestSecurityContext;
}

export interface Actor {
  readonly user: AuthUser;
  readonly sessionId: string;
}

const genericRegistrationResult = {
  accepted: true,
  message:
    "If the address can be registered, a verification message will arrive shortly.",
} as const;

const genericRecoveryResult = {
  accepted: true,
  message:
    "If the account is eligible, recovery instructions will arrive shortly.",
} as const;

export class AuthService {
  constructor(private readonly dependencies: AuthServiceDependencies) {}

  async register(
    input: RegisterInput,
  ): Promise<typeof genericRegistrationResult> {
    const passwordHasher = this.requirePasswordHasher();
    const messageSender = this.requireMessageSender();
    const email = normalizeEmail(input.email);
    await this.enforceRateLimit(
      `register:${this.dependencies.tokens.digest(email)}`,
      5,
      3600,
    );

    const passwordIssues = validatePassword(input.password, email);
    if (passwordIssues.length > 0) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        status: 422,
        safeMessage: "Password does not meet the security requirements.",
        details: { passwordIssues },
      });
    }

    const now = this.dependencies.clock.now();
    const rawToken = this.dependencies.tokens.opaque();
    const tokenHash = this.dependencies.tokens.digest(rawToken);
    const existingUser =
      await this.dependencies.repository.findUserByEmail(email);

    if (existingUser?.status === "PENDING_VERIFICATION") {
      await this.dependencies.repository.replaceOneTimeToken(
        existingUser.id,
        "EMAIL_VERIFICATION",
        tokenHash,
        addSeconds(now, authPolicy.verificationTokenSeconds),
        input.context,
      );
      await this.sendActionMessage(
        messageSender,
        existingUser,
        rawToken,
        "verify_email",
        input.locale,
      );
      return genericRegistrationResult;
    }

    if (existingUser) return genericRegistrationResult;

    const passwordHash = await passwordHasher.hash(input.password);
    const userId = this.dependencies.tokens.id();
    const created = await this.dependencies.repository.createUser({
      id: userId,
      email,
      displayName: input.displayName.trim(),
      passwordHash,
      locale: input.locale,
      timeZone: input.timeZone,
      verificationTokenHash: tokenHash,
      verificationExpiresAt: addSeconds(
        now,
        authPolicy.verificationTokenSeconds,
      ),
      context: input.context,
    });

    if (created === "created") {
      await this.sendActionMessage(
        messageSender,
        {
          email,
          displayName: input.displayName.trim(),
        },
        rawToken,
        "verify_email",
        input.locale,
      );
    }

    return genericRegistrationResult;
  }

  async verifyEmail(
    token: string,
    context: RequestSecurityContext,
  ): Promise<{ readonly verified: true }> {
    const user = await this.dependencies.repository.consumeOneTimeToken(
      "EMAIL_VERIFICATION",
      this.dependencies.tokens.digest(token),
      this.dependencies.clock.now(),
      context,
    );

    if (!user) throw invalidOneTimeTokenError();
    return { verified: true };
  }

  async login(input: LoginInput): Promise<IssuedSession> {
    const passwordHasher = this.requirePasswordHasher();
    const email = normalizeEmail(input.email);
    const rateKey = this.dependencies.tokens.digest(
      `${email}:${input.context.ipPrefix ?? "unknown"}`,
    );
    await this.enforceRateLimit(`login:${rateKey}`, 10, 15 * 60);

    const user = await this.dependencies.repository.findUserByEmail(email);
    const passwordMatches = await passwordHasher.verify(
      user?.passwordHash ?? null,
      input.password,
    );

    if (!user || !passwordMatches) {
      await this.dependencies.repository.recordSecurityEvent({
        action: "auth.login_failed",
        context: input.context,
        metadata: { emailHash: this.dependencies.tokens.digest(email) },
      });
      throw invalidCredentialsError();
    }

    if (
      user.status === "PENDING_VERIFICATION" &&
      user.emailVerifiedAt === null
    ) {
      throw new AppError({
        code: "AUTH_EMAIL_NOT_VERIFIED",
        safeMessage: "Email verification is required before sign-in.",
      });
    }

    if (!canAuthenticate(user.status, user.emailVerifiedAt)) {
      throw invalidCredentialsError();
    }

    return this.createSession(user, "password", input.context);
  }

  async loginWithOAuthUser(
    user: AuthUser,
    provider: string,
    context: RequestSecurityContext,
  ): Promise<IssuedSession> {
    if (!canAuthenticate(user.status, user.emailVerifiedAt)) {
      throw invalidCredentialsError();
    }
    return this.createSession(user, `oauth:${provider}`, context);
  }

  async refresh(
    rawRefreshToken: string,
    context: RequestSecurityContext,
  ): Promise<IssuedSession> {
    const now = this.dependencies.clock.now();
    const replacementToken = this.dependencies.tokens.opaque();
    const replacementExpiresAt = addSeconds(
      now,
      authPolicy.refreshTokenSeconds,
    );
    const result = await this.dependencies.repository.rotateRefreshToken({
      presentedTokenHash: this.dependencies.tokens.digest(rawRefreshToken),
      replacementTokenId: this.dependencies.tokens.id(),
      replacementTokenHash: this.dependencies.tokens.digest(replacementToken),
      replacementExpiresAt,
      context,
      now,
    });

    if (result.kind !== "rotated") {
      throw invalidCredentialsError();
    }

    const accessToken = await this.issueAccessToken(
      result.user,
      result.sessionId,
      now,
    );
    return {
      accessToken,
      accessTokenExpiresInSeconds:
        this.dependencies.accessTokens.lifetimeSeconds,
      refreshToken: replacementToken,
      refreshTokenExpiresAt: result.refreshTokenExpiresAt,
      csrfToken: this.dependencies.tokens.opaque(24),
      sessionId: result.sessionId,
      user: publicUser(result.user),
    };
  }

  async requestPasswordReset(
    emailInput: string,
    locale: "bn-BD" | "en",
    context: RequestSecurityContext,
  ): Promise<typeof genericRecoveryResult> {
    const messageSender = this.requireMessageSender();
    const email = normalizeEmail(emailInput);
    await this.enforceRateLimit(
      `recovery:${this.dependencies.tokens.digest(email)}`,
      3,
      3600,
    );
    const user = await this.dependencies.repository.findUserByEmail(email);

    if (!user || user.status !== "ACTIVE" || !user.passwordHash)
      return genericRecoveryResult;

    const now = this.dependencies.clock.now();
    const rawToken = this.dependencies.tokens.opaque();
    await this.dependencies.repository.replaceOneTimeToken(
      user.id,
      "PASSWORD_RESET",
      this.dependencies.tokens.digest(rawToken),
      addSeconds(now, authPolicy.passwordResetTokenSeconds),
      context,
    );
    await this.sendActionMessage(
      messageSender,
      user,
      rawToken,
      "reset_password",
      locale,
    );
    return genericRecoveryResult;
  }

  async resetPassword(
    token: string,
    password: string,
    context: RequestSecurityContext,
  ): Promise<{ readonly reset: true }> {
    const passwordHasher = this.requirePasswordHasher();
    const passwordIssues = validatePassword(password);
    if (passwordIssues.length > 0) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        status: 422,
        safeMessage: "Password does not meet the security requirements.",
        details: { passwordIssues },
      });
    }

    const passwordHash = await passwordHasher.hash(password);
    const reset = await this.dependencies.repository.resetPassword(
      this.dependencies.tokens.digest(token),
      passwordHash,
      this.dependencies.clock.now(),
      context,
    );
    if (!reset) throw invalidOneTimeTokenError();
    return { reset: true };
  }

  async authenticateAccessToken(token: string): Promise<Actor> {
    const now = this.dependencies.clock.now();
    const claims = await this.dependencies.accessTokens.verify(token, now);
    const user = await this.dependencies.repository.resolveActor(
      claims.subject,
      claims.sessionId,
      now,
    );

    if (!user || user.permissionVersion !== claims.permissionVersion) {
      throw invalidCredentialsError();
    }

    return { user, sessionId: claims.sessionId };
  }

  listSessions(actor: Actor): Promise<readonly AuthSessionRecord[]> {
    requirePermission(actor.user, "sessions:read:own");
    return this.dependencies.repository.listSessions(
      actor.user.id,
      actor.sessionId,
    );
  }

  revokeSession(
    actor: Actor,
    sessionId: string,
    context: RequestSecurityContext,
  ): Promise<boolean> {
    requirePermission(actor.user, "sessions:revoke:own");
    return this.dependencies.repository.revokeSession(
      actor.user.id,
      sessionId,
      "user_revoked",
      context,
      this.dependencies.clock.now(),
    );
  }

  revokeOtherSessions(
    actor: Actor,
    context: RequestSecurityContext,
  ): Promise<number> {
    requirePermission(actor.user, "sessions:revoke:own");
    return this.dependencies.repository.revokeOtherSessions(
      actor.user.id,
      actor.sessionId,
      context,
      this.dependencies.clock.now(),
    );
  }

  async logout(
    rawRefreshToken: string,
    context: RequestSecurityContext,
  ): Promise<void> {
    await this.dependencies.repository.revokeByRefreshToken(
      this.dependencies.tokens.digest(rawRefreshToken),
      "user_logout",
      context,
      this.dependencies.clock.now(),
    );
  }

  private async createSession(
    user: AuthUser,
    authMethod: string,
    context: RequestSecurityContext,
  ): Promise<IssuedSession> {
    const now = this.dependencies.clock.now();
    const sessionId = this.dependencies.tokens.id();
    const refreshToken = this.dependencies.tokens.opaque();
    const refreshTokenExpiresAt = addSeconds(
      now,
      authPolicy.refreshTokenSeconds,
    );
    const persistedUser = await this.dependencies.repository.createSession({
      sessionId,
      familyId: this.dependencies.tokens.id(),
      refreshTokenId: this.dependencies.tokens.id(),
      refreshTokenHash: this.dependencies.tokens.digest(refreshToken),
      refreshTokenExpiresAt,
      sessionExpiresAt: addSeconds(now, authPolicy.sessionSeconds),
      authMethod,
      userId: user.id,
      context,
      now,
    });

    return {
      accessToken: await this.issueAccessToken(persistedUser, sessionId, now),
      accessTokenExpiresInSeconds:
        this.dependencies.accessTokens.lifetimeSeconds,
      refreshToken,
      refreshTokenExpiresAt,
      csrfToken: this.dependencies.tokens.opaque(24),
      sessionId,
      user: publicUser(persistedUser),
    };
  }

  private issueAccessToken(
    user: AuthUser,
    sessionId: string,
    now: Date,
  ): Promise<string> {
    return this.dependencies.accessTokens.issue(
      {
        subject: user.id,
        sessionId,
        jwtId: this.dependencies.tokens.id(),
        permissionVersion: user.permissionVersion,
        permissions: user.permissions,
      },
      now,
    );
  }

  private async sendActionMessage(
    sender: AuthMessageSender,
    user: Pick<AuthUser, "email" | "displayName">,
    token: string,
    kind: "verify_email" | "reset_password",
    locale: "bn-BD" | "en",
  ): Promise<void> {
    const path = kind === "verify_email" ? "verify-email" : "reset-password";
    const url = new URL(`/${locale}/${path}`, this.dependencies.appUrl);
    url.hash = `token=${encodeURIComponent(token)}`;
    await sender.send({
      kind,
      recipient: user.email,
      displayName: user.displayName,
      actionUrl: url.toString(),
      expiresInMinutes:
        kind === "verify_email"
          ? authPolicy.verificationTokenSeconds / 60
          : authPolicy.passwordResetTokenSeconds / 60,
      locale,
    });
  }

  private requirePasswordHasher(): PasswordHasher {
    if (this.dependencies.passwordHasher) {
      return this.dependencies.passwordHasher;
    }
    throw passwordAuthenticationUnavailable();
  }

  private requireMessageSender(): AuthMessageSender {
    if (this.dependencies.messages) {
      return this.dependencies.messages;
    }
    throw passwordAuthenticationUnavailable();
  }

  private async enforceRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<void> {
    const decision = await this.dependencies.rateLimiter.check(
      key,
      limit,
      windowSeconds,
    );
    if (!decision.allowed) {
      throw new AppError({
        code: "RATE_LIMITED",
        safeMessage: "Too many attempts. Please wait before trying again.",
        details: { retryAfterSeconds: decision.retryAfterSeconds },
      });
    }
  }
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function publicUser(
  user: AuthUser,
): Pick<AuthUser, "id" | "displayName" | "permissions"> {
  return {
    id: user.id,
    displayName: user.displayName,
    permissions: user.permissions,
  };
}

function invalidCredentialsError(): AppError {
  return new AppError({
    code: "AUTH_INVALID_CREDENTIALS",
    safeMessage: "The credentials or session are not valid.",
  });
}

function invalidOneTimeTokenError(): AppError {
  return new AppError({
    code: "AUTH_TOKEN_INVALID",
    safeMessage: "This security link is invalid or has expired.",
  });
}

function passwordAuthenticationUnavailable(): AppError {
  return new AppError({
    code: "DEPENDENCY_UNAVAILABLE",
    safeMessage: "Password authentication is not available.",
  });
}
