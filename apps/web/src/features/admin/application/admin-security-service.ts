import { createHash } from "node:crypto";

import type { SecretCipher } from "@/features/auth/application/oauth-ports";
import type {
  PasswordHasher,
  SecureTokenGenerator,
} from "@/features/auth/application/ports";
import { requirePermission } from "@/features/auth/application/authorization-policy";
import type {
  AdminMfaEnrollment,
  AdminStepUpGrantView,
  AdminStepUpScope,
} from "@/features/admin/domain/admin-security-types";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  verifyTotp,
} from "@/features/admin/infrastructure/security/totp";
import { AppError } from "@/lib/errors/app-error";

import type { AdminOperationContext, AdminSecurityRepository } from "./ports";

interface AdminSecurityServiceDependencies {
  readonly repository: AdminSecurityRepository;
  readonly cipher: SecretCipher;
  readonly passwordHasher: PasswordHasher;
  readonly tokens: SecureTokenGenerator;
  readonly encryptionKeyId: string;
  readonly now: () => Date;
}

export class AdminSecurityService {
  constructor(
    private readonly dependencies: AdminSecurityServiceDependencies,
  ) {}

  getMfaState(context: AdminOperationContext) {
    requirePermission(context.actor.user, "admin:mfa:manage:own");
    return this.dependencies.repository.getMfaState(context);
  }

  async beginMfaEnrollment(
    context: AdminOperationContext,
  ): Promise<AdminMfaEnrollment> {
    requirePermission(context.actor.user, "admin:mfa:manage:own");
    const secret = generateTotpSecret();
    const recoveryCodes = generateRecoveryCodes();
    const version = await this.dependencies.repository.saveMfaEnrollment({
      ...context,
      encryptedSecret: this.dependencies.cipher.encrypt(secret),
      encryptionKeyId: this.dependencies.encryptionKeyId,
      recoveryCodeHashes: recoveryCodes.map((code) =>
        digest(`${context.actor.user.id}:${code}`),
      ),
    });
    const label = encodeURIComponent(`Focused:${context.actor.user.email}`);
    const issuer = encodeURIComponent("Focused");
    return {
      secret,
      otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
      recoveryCodes,
      version,
    };
  }

  confirmMfaEnrollment(
    context: AdminOperationContext,
    code: string,
    expectedVersion: number,
  ) {
    requirePermission(context.actor.user, "admin:mfa:manage:own");
    return this.acceptCode(context, code, expectedVersion, true);
  }

  verifyMfaSession(
    context: AdminOperationContext,
    code: string,
    expectedVersion: number,
  ) {
    requirePermission(context.actor.user, "admin:mfa:manage:own");
    return this.acceptCode(context, code, expectedVersion, false);
  }

  async grantStepUp(
    context: AdminOperationContext,
    input: {
      readonly code: string;
      readonly password?: string | undefined;
      readonly expectedMfaVersion: number;
      readonly scope: AdminStepUpScope;
      readonly targetType?: string | undefined;
      readonly targetId?: string | undefined;
    },
  ): Promise<AdminStepUpGrantView> {
    requirePermission(context.actor.user, "admin:access");
    const material = await this.requireActiveMaterial(context);
    const now = this.dependencies.now();
    const counter = verifyTotp(
      this.dependencies.cipher.decrypt(material.encryptedSecret),
      input.code,
      now,
      material.lastAcceptedCounter,
    );
    if (counter === null || material.version !== input.expectedMfaVersion) {
      throw invalidMfa();
    }

    let method: "PASSWORD_TOTP" | "OAUTH_TOTP";
    if (material.passwordHash) {
      const validPassword = await this.dependencies.passwordHasher.verify(
        material.passwordHash,
        input.password ?? "",
      );
      if (!validPassword) throw invalidMfa();
      method = "PASSWORD_TOTP";
    } else {
      const freshOAuth =
        material.authMethod === "oauth:google" &&
        now.getTime() - material.authenticatedAt.getTime() <= 10 * 60_000;
      if (!freshOAuth) {
        throw new AppError({
          code: "FORBIDDEN",
          safeMessage:
            "Sign in with Google again before this sensitive action.",
          details: { reason: "oauth_reauthentication_required" },
        });
      }
      method = "OAUTH_TOTP";
    }

    const accepted = await this.dependencies.repository.acceptMfa({
      ...context,
      counter,
      expectedVersion: material.version,
      activate: false,
    });
    if (!accepted) throw invalidMfa();

    const token = this.dependencies.tokens.opaque(32);
    const expiresAt = new Date(now.getTime() + 5 * 60_000);
    await this.dependencies.repository.createStepUpGrant({
      ...context,
      tokenHash: this.dependencies.tokens.digest(token),
      scope: input.scope,
      targetType: input.targetType,
      targetId: input.targetId,
      method,
      verifiedAt: now,
      expiresAt,
    });
    return {
      token,
      expiresAt: expiresAt.toISOString(),
      scope: input.scope,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
    };
  }

  private async acceptCode(
    context: AdminOperationContext,
    code: string,
    expectedVersion: number,
    activate: boolean,
  ): Promise<{ readonly verified: true }> {
    const material = await this.dependencies.repository.getMfaMaterial(context);
    if (!material || material.version !== expectedVersion) throw invalidMfa();
    if (
      activate ? material.status !== "PENDING" : material.status !== "ACTIVE"
    ) {
      throw invalidMfa();
    }
    const counter = verifyTotp(
      this.dependencies.cipher.decrypt(material.encryptedSecret),
      code,
      this.dependencies.now(),
      material.lastAcceptedCounter,
    );
    if (counter === null) throw invalidMfa();
    const accepted = await this.dependencies.repository.acceptMfa({
      ...context,
      counter,
      expectedVersion,
      activate,
    });
    if (!accepted) throw invalidMfa();
    return { verified: true };
  }

  private async requireActiveMaterial(context: AdminOperationContext) {
    const material = await this.dependencies.repository.getMfaMaterial(context);
    if (!material || material.status !== "ACTIVE") throw invalidMfa();
    return material;
  }
}

function invalidMfa(): AppError {
  return new AppError({
    code: "AUTH_INVALID_CREDENTIALS",
    safeMessage: "The MFA verification could not be completed.",
  });
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
