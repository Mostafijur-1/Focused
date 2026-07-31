import type { FocusedPrismaClient } from "@focused/database";
import { Prisma } from "@focused/database/generated/client";

import type {
  OAuthRepository,
  OAuthTransactionInput,
  SecretCipher,
} from "@/features/auth/application/oauth-ports";
import type {
  AuthUser,
  RequestSecurityContext,
} from "@/features/auth/domain/auth-types";
import type {
  OAuthIdentity,
  OAuthProvider,
  OAuthTransaction,
} from "@/features/auth/domain/oauth-types";
import { AppError } from "@/lib/errors/app-error";

interface UserWithAuthorization {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string | null;
  readonly emailVerifiedAt: Date | null;
  readonly status: AuthUser["status"];
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
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  },
} as const;

export class PrismaOAuthRepository implements OAuthRepository {
  constructor(
    private readonly prisma: FocusedPrismaClient,
    private readonly cipher: SecretCipher,
  ) {}

  async createTransaction(input: OAuthTransactionInput): Promise<void> {
    await this.prisma.oAuthTransaction.create({
      data: {
        id: input.id,
        provider: input.provider,
        stateHash: input.stateHash,
        nonceHash: input.nonceHash,
        nonceEncrypted: input.nonce ? this.cipher.encrypt(input.nonce) : null,
        codeVerifierEncrypted: this.cipher.encrypt(input.codeVerifier),
        redirectUri: input.redirectUri,
        returnTo: input.returnTo,
        locale: input.locale,
        timeZone: input.timeZone,
        expiresAt: input.expiresAt,
      },
    });
  }

  async consumeTransaction(
    provider: OAuthProvider,
    stateHash: string,
    now: Date,
  ): Promise<OAuthTransaction | null> {
    return this.prisma.$transaction(
      async (transaction) => {
        const record = await transaction.oAuthTransaction.findFirst({
          where: {
            provider,
            stateHash,
            consumedAt: null,
            expiresAt: { gt: now },
          },
        });
        if (!record) return null;
        const consumed = await transaction.oAuthTransaction.updateMany({
          where: { id: record.id, consumedAt: null },
          data: { consumedAt: now },
        });
        if (consumed.count !== 1) return null;
        return {
          provider,
          codeVerifier: this.cipher.decrypt(record.codeVerifierEncrypted),
          nonce: record.nonceEncrypted
            ? this.cipher.decrypt(record.nonceEncrypted)
            : null,
          redirectUri: record.redirectUri,
          returnTo: record.returnTo,
          locale: record.locale as "bn-BD" | "en",
          timeZone: record.timeZone,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async resolveIdentity(
    identity: OAuthIdentity,
    locale: "bn-BD" | "en",
    timeZone: string,
    context: RequestSecurityContext,
    now: Date,
  ): Promise<AuthUser> {
    return this.prisma.$transaction(
      async (transaction) => {
        const existingAccount = await transaction.oAuthAccount.findUnique({
          where: {
            provider_providerSubject: {
              provider: identity.provider,
              providerSubject: identity.subject,
            },
          },
          select: { user: { include: authorizationInclude } },
        });
        if (existingAccount) return toAuthUser(existingAccount.user);

        const emailOwner = await transaction.user.findUnique({
          where: { email: identity.email },
          select: { id: true },
        });
        if (emailOwner) {
          throw new AppError({
            code: "CONFLICT",
            safeMessage:
              "This provider cannot be linked automatically. Sign in first and link it from security settings.",
          });
        }

        const user = await transaction.user.create({
          data: {
            email: identity.email,
            emailVerifiedAt: now,
            status: "ACTIVE",
            profile: {
              create: { displayName: identity.displayName, locale, timeZone },
            },
            roles: { create: { role: { connect: { key: "member" } } } },
            oauthAccounts: {
              create: {
                provider: identity.provider,
                providerSubject: identity.subject,
                providerEmail: identity.email,
              },
            },
          },
          include: authorizationInclude,
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: user.id,
            actorType: "USER",
            action: "auth.oauth_user_registered",
            targetType: "USER",
            targetId: user.id,
            correlationId: context.requestId,
            ipPrefix: context.ipPrefix,
            metadata: { provider: identity.provider },
          },
        });
        return toAuthUser(user);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
    status: user.status,
    permissionVersion: user.permissionVersion,
    permissions: [...permissions].sort(),
  };
}
