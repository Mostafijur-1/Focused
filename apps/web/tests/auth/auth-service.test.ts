import type { Clock } from "@/application/ports/clock";
import {
  AuthService,
  type AuthServiceDependencies,
} from "@/features/auth/application/auth-service";
import type {
  AccessTokenIssuer,
  AuthMessage,
  AuthRepository,
  PasswordHasher,
  SecureTokenGenerator,
} from "@/features/auth/application/ports";
import type {
  AuthSessionRecord,
  AuthUser,
  RequestSecurityContext,
} from "@/features/auth/domain/auth-types";

const now = new Date("2026-07-31T12:00:00.000Z");
const context: RequestSecurityContext = {
  requestId: "request-12345678",
  ipPrefix: "203.0.113.0/24",
  userAgentHash: "ua-hash",
  deviceName: "Chrome on Windows",
};

const activeUser: AuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "person@example.com",
  displayName: "Person",
  passwordHash: "hashed:correct-password-value",
  emailVerifiedAt: now,
  status: "ACTIVE",
  permissionVersion: 1,
  permissions: ["sessions:read:own", "sessions:revoke:own"],
};

describe("AuthService", () => {
  it("registers a normalized user and sends a fragment-based verification link", async () => {
    const fixture = createFixture();
    const result = await fixture.service.register({
      email: " Person@Example.COM ",
      password: "correct-password-value",
      displayName: " Person ",
      locale: "en",
      timeZone: "Asia/Dhaka",
      context,
    });

    expect(result.accepted).toBe(true);
    expect(fixture.repository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "person@example.com",
        displayName: "Person",
      }),
    );
    expect(fixture.messages).toHaveLength(1);
    expect(fixture.messages[0]?.actionUrl).toContain("/en/verify-email#token=");
    expect(fixture.messages[0]?.actionUrl).not.toContain("?token=");
  });

  it("returns the same registration result for an existing active account", async () => {
    const fixture = createFixture({ findUser: activeUser });
    const result = await fixture.service.register({
      email: activeUser.email,
      password: "correct-password-value",
      displayName: "Person",
      locale: "en",
      timeZone: "UTC",
      context,
    });
    expect(result.accepted).toBe(true);
    expect(fixture.repository.createUser).not.toHaveBeenCalled();
    expect(fixture.messages).toHaveLength(0);
  });

  it("rotates verification tokens for a pending account", async () => {
    const fixture = createFixture({
      findUser: {
        ...activeUser,
        status: "PENDING_VERIFICATION",
        emailVerifiedAt: null,
      },
    });
    await fixture.service.register({
      email: activeUser.email,
      password: "correct-password-value",
      displayName: "Person",
      locale: "bn-BD",
      timeZone: "Asia/Dhaka",
      context,
    });
    expect(fixture.repository.replaceOneTimeToken).toHaveBeenCalledWith(
      activeUser.id,
      "EMAIL_VERIFICATION",
      expect.any(String),
      expect.any(Date),
      context,
    );
    expect(fixture.messages).toHaveLength(1);
  });

  it("rejects weak registration passwords before persistence", async () => {
    const fixture = createFixture();
    await expect(
      fixture.service.register({
        email: "person@example.com",
        password: "weak",
        displayName: "Person",
        locale: "en",
        timeZone: "UTC",
        context,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 422 });
    expect(fixture.repository.createUser).not.toHaveBeenCalled();
  });

  it("creates a session only after constant-work credential verification", async () => {
    const fixture = createFixture({ findUser: activeUser });
    const session = await fixture.service.login({
      email: activeUser.email,
      password: "correct-password-value",
      context,
    });
    expect(session).toMatchObject({
      accessToken: "signed-access-token",
      sessionId: "00000000-0000-4000-8000-000000000100",
      user: { id: activeUser.id },
    });
    expect(fixture.repository.createSession).toHaveBeenCalledOnce();
  });

  it("uses a generic error for an unknown account and records no private email", async () => {
    const fixture = createFixture();
    await expect(
      fixture.service.login({
        email: "unknown@example.com",
        password: "unknown-password-value",
        context,
      }),
    ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS", status: 401 });
    expect(fixture.passwordHasher.verify).toHaveBeenCalledWith(
      null,
      "unknown-password-value",
    );
    expect(fixture.repository.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.login_failed",
        metadata: { emailHash: expect.any(String) },
      }),
    );
  });

  it("requires verification only after a correct password", async () => {
    const pending = {
      ...activeUser,
      status: "PENDING_VERIFICATION" as const,
      emailVerifiedAt: null,
    };
    const fixture = createFixture({ findUser: pending });
    await expect(
      fixture.service.login({
        email: pending.email,
        password: "correct-password-value",
        context,
      }),
    ).rejects.toMatchObject({ code: "AUTH_EMAIL_NOT_VERIFIED" });
  });

  it("rotates refresh tokens and refuses replayed families", async () => {
    const fixture = createFixture();
    fixture.repository.rotateRefreshToken.mockResolvedValueOnce({
      kind: "rotated",
      user: activeUser,
      sessionId: "00000000-0000-4000-8000-000000000100",
      refreshTokenExpiresAt: new Date(now.getTime() + 60_000),
    });
    await expect(
      fixture.service.refresh("refresh-token", context),
    ).resolves.toMatchObject({
      accessToken: "signed-access-token",
      user: { id: activeUser.id },
    });

    fixture.repository.rotateRefreshToken.mockResolvedValueOnce({
      kind: "replayed",
    });
    await expect(
      fixture.service.refresh("replayed-token", context),
    ).rejects.toMatchObject({
      code: "AUTH_INVALID_CREDENTIALS",
    });
  });

  it("keeps password recovery enumeration-safe and revokes sessions on reset", async () => {
    const unknown = createFixture();
    await expect(
      unknown.service.requestPasswordReset(
        "unknown@example.com",
        "en",
        context,
      ),
    ).resolves.toMatchObject({ accepted: true });
    expect(unknown.messages).toHaveLength(0);

    const known = createFixture({ findUser: activeUser });
    await known.service.requestPasswordReset(activeUser.email, "en", context);
    expect(known.repository.replaceOneTimeToken).toHaveBeenCalled();
    expect(known.messages[0]?.kind).toBe("reset_password");
    await expect(
      known.service.resetPassword(
        "reset-token-value-that-is-long-enough",
        "new-correct-password-value",
        context,
      ),
    ).resolves.toEqual({ reset: true });
  });

  it("checks current session state, permission version, and explicit RBAC", async () => {
    const fixture = createFixture();
    fixture.repository.resolveActor.mockResolvedValue(activeUser);
    const actor = await fixture.service.authenticateAccessToken("access-token");
    await expect(fixture.service.listSessions(actor)).resolves.toEqual([]);

    fixture.repository.resolveActor.mockResolvedValue({
      ...activeUser,
      permissionVersion: 2,
    });
    await expect(
      fixture.service.authenticateAccessToken("access-token"),
    ).rejects.toMatchObject({
      code: "AUTH_INVALID_CREDENTIALS",
    });

    const denied = { ...actor, user: { ...actor.user, permissions: [] } };
    expect(() => fixture.service.listSessions(denied)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  it("fails closed when a rate limit is exceeded", async () => {
    const fixture = createFixture({ rateAllowed: false });
    await expect(
      fixture.service.login({
        email: activeUser.email,
        password: "correct-password-value",
        context,
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });
});

function createFixture(
  options: { findUser?: AuthUser; rateAllowed?: boolean } = {},
) {
  const messages: AuthMessage[] = [];
  let opaqueSequence = 0;
  let idSequence = 99;
  const repository = {
    findUserByEmail: vi.fn(async () => options.findUser ?? null),
    resolveActor: vi.fn<AuthRepository["resolveActor"]>(async () => null),
    createUser: vi.fn(async () => "created" as const),
    consumeOneTimeToken: vi.fn(async () => activeUser),
    replaceOneTimeToken: vi.fn(async () => undefined),
    resetPassword: vi.fn(async () => true),
    createSession: vi.fn(async () => activeUser),
    rotateRefreshToken: vi.fn<AuthRepository["rotateRefreshToken"]>(
      async () => ({
        kind: "invalid" as const,
      }),
    ),
    revokeByRefreshToken: vi.fn(async () => undefined),
    revokeSession: vi.fn(async () => true),
    revokeOtherSessions: vi.fn(async () => 0),
    listSessions: vi.fn(async () => [] as readonly AuthSessionRecord[]),
    recordSecurityEvent: vi.fn(async () => undefined),
  } satisfies AuthRepository;
  const passwordHasher = {
    hash: vi.fn(async (password: string) => `hashed:${password}`),
    verify: vi.fn(
      async (hash: string | null, password: string) =>
        hash === `hashed:${password}`,
    ),
  } satisfies PasswordHasher;
  const accessTokens = {
    lifetimeSeconds: 600,
    issue: vi.fn(async () => "signed-access-token"),
    verify: vi.fn(async () => ({
      subject: activeUser.id,
      sessionId: "00000000-0000-4000-8000-000000000100",
      jwtId: "00000000-0000-4000-8000-000000000101",
      permissionVersion: 1,
      permissions: activeUser.permissions,
    })),
  } satisfies AccessTokenIssuer;
  const tokens = {
    opaque: vi.fn(
      () => `opaque-token-${++opaqueSequence}-with-sufficient-length`,
    ),
    digest: vi.fn((value: string) => `digest:${value}`),
    id: vi.fn(
      () => `00000000-0000-4000-8000-${String(++idSequence).padStart(12, "0")}`,
    ),
  } satisfies SecureTokenGenerator;
  const clock: Clock = { now: () => new Date(now) };
  const dependencies: AuthServiceDependencies = {
    repository,
    passwordHasher,
    accessTokens,
    tokens,
    messages: { send: async (message) => void messages.push(message) },
    rateLimiter: {
      check: async () => ({
        allowed: options.rateAllowed ?? true,
        retryAfterSeconds: 60,
      }),
    },
    clock,
    appUrl: "https://focused.test",
  };
  return {
    service: new AuthService(dependencies),
    repository,
    passwordHasher,
    accessTokens,
    tokens,
    messages,
  };
}
