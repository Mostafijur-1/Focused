import type { FocusedPrismaClient } from "@focused/database";
import { Prisma } from "@focused/database/generated/client";

import type {
  AuthRepository,
  NewSessionInput,
  NewUserInput,
  RotateRefreshInput,
} from "@/features/auth/application/ports";
import type {
  AuthSessionRecord,
  AuthUser,
  OneTimeTokenPurpose,
  RefreshRotationResult,
  RequestSecurityContext,
} from "@/features/auth/domain/auth-types";

type TransactionClient = Parameters<
  Parameters<FocusedPrismaClient["$transaction"]>[0]
>[0];

interface UserWithAuthorization {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string | null;
  readonly emailVerifiedAt: Date | null;
  readonly status: string;
  readonly permissionVersion: number;
  readonly profile: { readonly displayName: string } | null;
  readonly roles: readonly {
    readonly expiresAt: Date | null;
    readonly role: {
      readonly permissions: readonly {
        readonly permission: { readonly key: string };
      }[];
    };
  }[];
}

const authorizationInclude = {
  profile: { select: { displayName: true } },
  roles: {
    select: {
      expiresAt: true,
      role: {
        select: {
          permissions: {
            select: { permission: { select: { key: true } } },
          },
        },
      },
    },
  },
} as const;

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: FocusedPrismaClient) {}

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: authorizationInclude,
    });
    return user ? toAuthUser(user) : null;
  }

  async resolveActor(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<AuthUser | null> {
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        userId,
        status: "ACTIVE",
        expiresAt: { gt: now },
        user: { status: "ACTIVE", emailVerifiedAt: { not: null } },
      },
      select: { user: { include: authorizationInclude } },
    });
    return session ? toAuthUser(session.user) : null;
  }

  async createUser(input: NewUserInput): Promise<"created" | "exists"> {
    try {
      await this.serializable(async (transaction) => {
        await transaction.user.create({
          data: {
            id: input.id,
            email: input.email,
            passwordHash: input.passwordHash,
            profile: {
              create: {
                displayName: input.displayName,
                locale: input.locale,
                timeZone: input.timeZone,
              },
            },
            roles: { create: { role: { connect: { key: "member" } } } },
            authTokens: {
              create: {
                purpose: "EMAIL_VERIFICATION",
                tokenHash: input.verificationTokenHash,
                expiresAt: input.verificationExpiresAt,
                requestedIpPrefix: input.context.ipPrefix,
              },
            },
          },
        });
        await createAudit(transaction, {
          actorUserId: input.id,
          action: "auth.user_registered",
          targetId: input.id,
          context: input.context,
        });
      });
      return "created";
    } catch (error) {
      if (isUniqueViolation(error)) return "exists";
      throw error;
    }
  }

  async consumeOneTimeToken(
    purpose: OneTimeTokenPurpose,
    tokenHash: string,
    now: Date,
    context: RequestSecurityContext,
  ): Promise<AuthUser | null> {
    return this.serializable(async (transaction) => {
      const token = await transaction.authOneTimeToken.findFirst({
        where: { purpose, tokenHash, consumedAt: null, expiresAt: { gt: now } },
        select: { id: true, userId: true },
      });
      if (!token) return null;

      const consumed = await transaction.authOneTimeToken.updateMany({
        where: { id: token.id, consumedAt: null },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) return null;

      if (purpose === "EMAIL_VERIFICATION") {
        await transaction.user.update({
          where: { id: token.userId },
          data: { emailVerifiedAt: now, status: "ACTIVE" },
        });
      }

      await createAudit(transaction, {
        actorUserId: token.userId,
        action:
          purpose === "EMAIL_VERIFICATION"
            ? "auth.email_verified"
            : "auth.token_consumed",
        targetId: token.userId,
        context,
      });
      const user = await transaction.user.findUniqueOrThrow({
        where: { id: token.userId },
        include: authorizationInclude,
      });
      return toAuthUser(user);
    });
  }

  async replaceOneTimeToken(
    userId: string,
    purpose: OneTimeTokenPurpose,
    tokenHash: string,
    expiresAt: Date,
    context: RequestSecurityContext,
  ): Promise<void> {
    await this.serializable(async (transaction) => {
      await transaction.authOneTimeToken.deleteMany({
        where: { userId, purpose, consumedAt: null },
      });
      await transaction.authOneTimeToken.create({
        data: {
          userId,
          purpose,
          tokenHash,
          expiresAt,
          requestedIpPrefix: context.ipPrefix,
        },
      });
      await createAudit(transaction, {
        actorUserId: userId,
        action:
          purpose === "EMAIL_VERIFICATION"
            ? "auth.verification_requested"
            : "auth.password_reset_requested",
        targetId: userId,
        context,
      });
    });
  }

  async resetPassword(
    tokenHash: string,
    passwordHash: string,
    now: Date,
    context: RequestSecurityContext,
  ): Promise<boolean> {
    return this.serializable(async (transaction) => {
      const token = await transaction.authOneTimeToken.findFirst({
        where: {
          purpose: "PASSWORD_RESET",
          tokenHash,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true, userId: true },
      });
      if (!token) return false;

      const consumed = await transaction.authOneTimeToken.updateMany({
        where: { id: token.id, consumedAt: null },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) return false;

      await transaction.user.update({
        where: { id: token.userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          permissionVersion: { increment: 1 },
        },
      });
      await transaction.authSession.updateMany({
        where: { userId: token.userId, status: "ACTIVE" },
        data: {
          status: "REVOKED",
          revokedAt: now,
          revokeReason: "password_reset",
        },
      });
      await transaction.refreshToken.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await createAudit(transaction, {
        actorUserId: token.userId,
        action: "auth.password_reset",
        targetId: token.userId,
        context,
      });
      return true;
    });
  }

  async createSession(input: NewSessionInput): Promise<AuthUser> {
    return this.serializable(async (transaction) => {
      const user = await transaction.user.findFirstOrThrow({
        where: {
          id: input.userId,
          status: "ACTIVE",
          emailVerifiedAt: { not: null },
        },
        include: authorizationInclude,
      });
      await transaction.authSession.create({
        data: {
          id: input.sessionId,
          userId: input.userId,
          status: "ACTIVE",
          deviceName: input.context.deviceName,
          userAgentHash: input.context.userAgentHash,
          ipPrefix: input.context.ipPrefix,
          authMethod: input.authMethod,
          authenticatedAt: input.now,
          lastSeenAt: input.now,
          expiresAt: input.sessionExpiresAt,
          refreshTokens: {
            create: {
              id: input.refreshTokenId,
              userId: input.userId,
              familyId: input.familyId,
              tokenHash: input.refreshTokenHash,
              expiresAt: input.refreshTokenExpiresAt,
              issuedAt: input.now,
            },
          },
        },
      });
      await createAudit(transaction, {
        actorUserId: input.userId,
        action: "auth.session_created",
        targetId: input.sessionId,
        context: input.context,
        metadata: { authMethod: input.authMethod },
      });
      return toAuthUser(user);
    });
  }

  async rotateRefreshToken(
    input: RotateRefreshInput,
  ): Promise<RefreshRotationResult> {
    return this.serializable(async (transaction) => {
      const token = await transaction.refreshToken.findUnique({
        where: { tokenHash: input.presentedTokenHash },
        include: {
          session: true,
          user: { include: authorizationInclude },
        },
      });
      if (!token) return { kind: "invalid" };

      if (token.usedAt || token.replacedById) {
        await revokeFamily(
          transaction,
          token.familyId,
          token.sessionId,
          input.now,
        );
        await createAudit(transaction, {
          actorUserId: token.userId,
          action: "auth.refresh_replay_detected",
          targetId: token.sessionId,
          context: input.context,
          metadata: { familyId: token.familyId },
        });
        return { kind: "replayed" };
      }

      if (
        token.revokedAt ||
        token.expiresAt <= input.now ||
        token.session.status !== "ACTIVE" ||
        token.session.expiresAt <= input.now ||
        token.user.status !== "ACTIVE" ||
        !token.user.emailVerifiedAt
      ) {
        return { kind: "invalid" };
      }

      await transaction.refreshToken.create({
        data: {
          id: input.replacementTokenId,
          userId: token.userId,
          sessionId: token.sessionId,
          familyId: token.familyId,
          tokenHash: input.replacementTokenHash,
          parentId: token.id,
          issuedAt: input.now,
          expiresAt: input.replacementExpiresAt,
        },
      });
      const updated = await transaction.refreshToken.updateMany({
        where: { id: token.id, usedAt: null, replacedById: null },
        data: { usedAt: input.now, replacedById: input.replacementTokenId },
      });
      if (updated.count !== 1) {
        await revokeFamily(
          transaction,
          token.familyId,
          token.sessionId,
          input.now,
        );
        return { kind: "replayed" };
      }

      await transaction.authSession.update({
        where: { id: token.sessionId },
        data: {
          lastSeenAt: input.now,
          userAgentHash: input.context.userAgentHash,
          ipPrefix: input.context.ipPrefix,
        },
      });
      return {
        kind: "rotated",
        user: toAuthUser(token.user),
        sessionId: token.sessionId,
        refreshTokenExpiresAt: input.replacementExpiresAt,
      };
    });
  }

  async revokeByRefreshToken(
    refreshTokenHash: string,
    reason: string,
    context: RequestSecurityContext,
    now: Date,
  ): Promise<void> {
    await this.serializable(async (transaction) => {
      const token = await transaction.refreshToken.findUnique({
        where: { tokenHash: refreshTokenHash },
        select: { userId: true, sessionId: true, familyId: true },
      });
      if (!token) return;
      await revokeFamily(
        transaction,
        token.familyId,
        token.sessionId,
        now,
        reason,
      );
      await createAudit(transaction, {
        actorUserId: token.userId,
        action: "auth.session_revoked",
        targetId: token.sessionId,
        context,
        metadata: { reason },
      });
    });
  }

  async revokeSession(
    actorUserId: string,
    sessionId: string,
    reason: string,
    context: RequestSecurityContext,
    now: Date,
  ): Promise<boolean> {
    return this.serializable(async (transaction) => {
      const updated = await transaction.authSession.updateMany({
        where: { id: sessionId, userId: actorUserId, status: "ACTIVE" },
        data: { status: "REVOKED", revokedAt: now, revokeReason: reason },
      });
      if (updated.count !== 1) return false;
      await transaction.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: now },
      });
      await createAudit(transaction, {
        actorUserId,
        action: "auth.session_revoked",
        targetId: sessionId,
        context,
        metadata: { reason },
      });
      return true;
    });
  }

  async revokeOtherSessions(
    actorUserId: string,
    currentSessionId: string,
    context: RequestSecurityContext,
    now: Date,
  ): Promise<number> {
    return this.serializable(async (transaction) => {
      const sessions = await transaction.authSession.findMany({
        where: {
          userId: actorUserId,
          id: { not: currentSessionId },
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (sessions.length === 0) return 0;
      const ids = sessions.map(({ id }) => id);
      await transaction.authSession.updateMany({
        where: { id: { in: ids } },
        data: { status: "REVOKED", revokedAt: now, revokeReason: "logout_all" },
      });
      await transaction.refreshToken.updateMany({
        where: { sessionId: { in: ids }, revokedAt: null },
        data: { revokedAt: now },
      });
      await createAudit(transaction, {
        actorUserId,
        action: "auth.other_sessions_revoked",
        targetId: actorUserId,
        context,
        metadata: { count: ids.length },
      });
      return ids.length;
    });
  }

  async listSessions(
    actorUserId: string,
    currentSessionId: string,
  ): Promise<readonly AuthSessionRecord[]> {
    const sessions = await this.prisma.authSession.findMany({
      where: { userId: actorUserId },
      orderBy: { lastSeenAt: "desc" },
      select: {
        id: true,
        userId: true,
        status: true,
        deviceName: true,
        lastSeenAt: true,
        expiresAt: true,
        createdAt: true,
      },
      take: 100,
    });
    return sessions.map((session) => ({
      ...session,
      current: session.id === currentSessionId,
    }));
  }

  recordSecurityEvent(input: {
    readonly actorUserId?: string;
    readonly action: string;
    readonly targetId?: string;
    readonly context: RequestSecurityContext;
    readonly metadata?: Readonly<
      Record<string, string | number | boolean | null>
    >;
  }): Promise<void> {
    return createAudit(this.prisma, input);
  }

  private async serializable<TResult>(
    operation: (transaction: TransactionClient) => Promise<TResult>,
  ): Promise<TResult> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 2_000,
          timeout: 5_000,
        });
      } catch (error) {
        if (!isWriteConflict(error) || attempt === 2) throw error;
      }
    }
    throw new Error("Unreachable transaction retry state.");
  }
}

function toAuthUser(user: UserWithAuthorization): AuthUser {
  const now = new Date();
  const permissions = new Set<string>();
  for (const assignment of user.roles) {
    if (assignment.expiresAt && assignment.expiresAt <= now) continue;
    for (const mapping of assignment.role.permissions) {
      permissions.add(mapping.permission.key);
    }
  }
  return {
    id: user.id,
    email: user.email,
    displayName: user.profile?.displayName ?? "Focused member",
    passwordHash: user.passwordHash,
    emailVerifiedAt: user.emailVerifiedAt,
    status: user.status as AuthUser["status"],
    permissionVersion: user.permissionVersion,
    permissions: [...permissions].sort(),
  };
}

async function revokeFamily(
  transaction: TransactionClient,
  familyId: string,
  sessionId: string,
  now: Date,
  reason = "refresh_replay",
): Promise<void> {
  await transaction.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: now },
  });
  await transaction.authSession.updateMany({
    where: { id: sessionId, status: "ACTIVE" },
    data: { status: "REVOKED", revokedAt: now, revokeReason: reason },
  });
}

async function createAudit(
  transaction: Pick<FocusedPrismaClient, "auditEvent"> | TransactionClient,
  input: {
    readonly actorUserId?: string;
    readonly action: string;
    readonly targetId?: string;
    readonly context: RequestSecurityContext;
    readonly metadata?: Readonly<
      Record<string, string | number | boolean | null>
    >;
  },
): Promise<void> {
  const data: Prisma.AuditEventUncheckedCreateInput = {
    ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
    actorType: input.actorUserId ? "USER" : "ANONYMOUS",
    action: input.action,
    targetType: "AUTH_SESSION",
    ...(input.targetId ? { targetId: input.targetId } : {}),
    correlationId: input.context.requestId,
    ipPrefix: input.context.ipPrefix,
    metadata: { ...(input.metadata ?? {}) },
  };
  await transaction.auditEvent.create({
    data,
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}
