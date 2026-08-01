import { describe, expect, it, vi } from "vitest";

import { AdminSecurityService } from "@/features/admin/application/admin-security-service";
import type { AdminSecurityRepository } from "@/features/admin/application/ports";
import type { AuthUser } from "@/features/auth/domain/auth-types";

const now = new Date(59_000);
const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const user: AuthUser = {
  id: "9b523680-d60a-40e9-889b-ded3c417944b",
  email: "admin@example.test",
  displayName: "Admin",
  passwordHash: "hash",
  emailVerifiedAt: now,
  status: "ACTIVE",
  permissionVersion: 1,
  permissions: ["admin:access", "admin:mfa:manage:own"],
};
const context = {
  actor: { user, sessionId: "8ecb5ce5-39bc-40f9-a878-f1eb7f410401" },
  request: {
    requestId: "request-1",
    ipPrefix: null,
    userAgentHash: null,
    deviceName: null,
  },
};

describe("AdminSecurityService", () => {
  it("starts encrypted enrollment and returns one-time recovery material", async () => {
    const repository = securityRepository();
    const enrollment =
      await buildService(repository).beginMfaEnrollment(context);

    expect(enrollment.secret).toMatch(/^[A-Z2-7]{32}$/u);
    expect(enrollment.recoveryCodes).toHaveLength(8);
    expect(enrollment.otpauthUri).toContain(
      "otpauth://totp/Focused%3Aadmin%40example.test",
    );
    expect(repository.saveMfaEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({ encryptionKeyId: "test-key" }),
    );
  });

  it("creates a password plus TOTP scoped one-time grant", async () => {
    const repository = securityRepository();
    const service = buildService(repository);

    const grant = await service.grantStepUp(context, {
      code: "287082",
      password: "correct",
      expectedMfaVersion: 3,
      scope: "USER_STATUS_WRITE",
      targetType: "User",
      targetId: "f0fed090-f920-46f5-a092-4071bb08d3fd",
    });

    expect(grant.token).toBe("raw-step-up-token");
    expect(repository.acceptMfa).toHaveBeenCalledWith(
      expect.objectContaining({ counter: 1n, activate: false }),
    );
    expect(repository.createStepUpGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: "hashed:raw-step-up-token",
        method: "PASSWORD_TOTP",
        scope: "USER_STATUS_WRITE",
      }),
    );
  });

  it("requires a fresh Google login for a passwordless operator", async () => {
    const repository = securityRepository();
    vi.mocked(repository.getMfaMaterial).mockResolvedValue({
      encryptedSecret: Uint8Array.from(Buffer.from(secret)),
      status: "ACTIVE",
      lastAcceptedCounter: -1n,
      version: 3,
      passwordHash: null,
      authMethod: "oauth:google",
      authenticatedAt: new Date(now.getTime() - 11 * 60_000),
    });

    await expect(
      buildService(repository).grantStepUp(context, {
        code: "287082",
        expectedMfaVersion: 3,
        scope: "FEATURE_FLAG_WRITE",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("accepts a fresh Google login plus TOTP without a password", async () => {
    const repository = securityRepository();
    vi.mocked(repository.getMfaMaterial).mockResolvedValue({
      encryptedSecret: Uint8Array.from(Buffer.from(secret)),
      status: "ACTIVE",
      lastAcceptedCounter: -1n,
      version: 3,
      passwordHash: null,
      authMethod: "oauth:google",
      authenticatedAt: new Date(now.getTime() - 60_000),
    });

    await buildService(repository).grantStepUp(context, {
      code: "287082",
      expectedMfaVersion: 3,
      scope: "FEATURE_FLAG_WRITE",
    });

    expect(repository.createStepUpGrant).toHaveBeenCalledWith(
      expect.objectContaining({ method: "OAUTH_TOTP" }),
    );
  });

  it("activates a pending enrollment and rejects a wrong credential state", async () => {
    const repository = securityRepository();
    vi.mocked(repository.getMfaMaterial).mockResolvedValue({
      encryptedSecret: Uint8Array.from(Buffer.from(secret)),
      status: "PENDING",
      lastAcceptedCounter: -1n,
      version: 3,
      passwordHash: "hash",
      authMethod: "password",
      authenticatedAt: now,
    });
    const service = buildService(repository);

    await expect(
      service.confirmMfaEnrollment(context, "287082", 3),
    ).resolves.toEqual({ verified: true });
    await expect(
      service.verifyMfaSession(context, "287082", 3),
    ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });
  });
});

function buildService(repository: AdminSecurityRepository) {
  return new AdminSecurityService({
    repository,
    cipher: {
      encrypt: (value) => Uint8Array.from(Buffer.from(value)),
      decrypt: (value) => Buffer.from(value).toString("utf8"),
    },
    passwordHasher: {
      hash: vi.fn(async (value) => value),
      verify: vi.fn(async (_hash, value) => value === "correct"),
    },
    tokens: {
      opaque: vi.fn(() => "raw-step-up-token"),
      digest: vi.fn((value) => `hashed:${value}`),
      id: vi.fn(() => "token-id"),
    },
    encryptionKeyId: "test-key",
    now: () => now,
  });
}

function securityRepository(): AdminSecurityRepository {
  return {
    getMfaState: vi.fn(),
    saveMfaEnrollment: vi.fn(async () => 1),
    getMfaMaterial: vi.fn<AdminSecurityRepository["getMfaMaterial"]>(
      async () => ({
        encryptedSecret: Uint8Array.from(Buffer.from(secret)),
        status: "ACTIVE",
        lastAcceptedCounter: -1n,
        version: 3,
        passwordHash: "hash",
        authMethod: "password",
        authenticatedAt: now,
      }),
    ),
    acceptMfa: vi.fn(async () => true),
    createStepUpGrant: vi.fn(async () => undefined),
  };
}
