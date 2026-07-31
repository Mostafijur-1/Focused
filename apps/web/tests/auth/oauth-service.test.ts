import type { Clock } from "@/application/ports/clock";
import type { AuthService } from "@/features/auth/application/auth-service";
import {
  OAuthService,
  type OAuthStartResult,
} from "@/features/auth/application/oauth-service";
import type {
  OAuthProviderAdapter,
  OAuthRepository,
} from "@/features/auth/application/oauth-ports";
import type { SecureTokenGenerator } from "@/features/auth/application/ports";
import type {
  AuthUser,
  IssuedSession,
} from "@/features/auth/domain/auth-types";

const user: AuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "person@example.com",
  displayName: "Person",
  passwordHash: null,
  emailVerifiedAt: new Date(),
  status: "ACTIVE",
  permissionVersion: 1,
  permissions: [],
};

describe("OAuthService", () => {
  it("creates a bounded PKCE transaction and normalizes unsafe return paths", async () => {
    const fixture = createFixture();
    const result: OAuthStartResult = await fixture.service.start({
      provider: "google",
      locale: "bn-BD",
      timeZone: "Asia/Dhaka",
      returnTo: "https://attacker.example/steal",
    });
    expect(result.authorizationUrl).toContain(
      "https://provider.test/authorize",
    );
    expect(fixture.repository.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "google",
        returnTo: "/bn-BD/auth-complete",
        nonceHash: "digest:nonce-value",
      }),
    );
  });

  it("consumes state once, resolves provider subject, and creates a Focused session", async () => {
    const fixture = createFixture();
    fixture.repository.consumeTransaction.mockResolvedValue({
      provider: "google",
      codeVerifier: "verifier",
      nonce: "nonce",
      redirectUri: "https://focused.test/api/v1/auth/oauth/google/callback",
      returnTo: "/en/auth-complete",
      locale: "en",
      timeZone: "UTC",
    });
    const result = await fixture.service.complete("google", "state", "code", {
      requestId: "request-12345678",
      ipPrefix: null,
      userAgentHash: null,
      deviceName: "Browser",
    });
    expect(result.returnTo).toBe("/en/auth-complete");
    expect(fixture.provider.exchange).toHaveBeenCalledWith(
      expect.objectContaining({ code: "code", codeVerifier: "verifier" }),
    );
    expect(fixture.loginWithOAuthUser).toHaveBeenCalledWith(
      user,
      "google",
      expect.any(Object),
    );
  });

  it("fails closed for disabled providers and consumed state", async () => {
    const fixture = createFixture();
    await expect(
      fixture.service.start({
        provider: "github",
        locale: "en",
        timeZone: "UTC",
        returnTo: "/en/auth-complete",
      }),
    ).rejects.toMatchObject({ code: "DEPENDENCY_UNAVAILABLE" });
    fixture.repository.consumeTransaction.mockResolvedValue(null);
    await expect(
      fixture.service.complete("google", "bad-state", "code", {
        requestId: "request-12345678",
        ipPrefix: null,
        userAgentHash: null,
        deviceName: null,
      }),
    ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });
  });
});

function createFixture() {
  const repository = {
    createTransaction: vi.fn(async () => undefined),
    consumeTransaction: vi.fn<OAuthRepository["consumeTransaction"]>(
      async () => null,
    ),
    resolveIdentity: vi.fn(async () => user),
  } satisfies OAuthRepository;
  const provider = {
    provider: "google" as const,
    authorizationUrl: vi.fn(() => new URL("https://provider.test/authorize")),
    exchange: vi.fn(async () => ({
      provider: "google" as const,
      subject: "provider-subject",
      email: user.email,
      displayName: user.displayName,
    })),
  } satisfies OAuthProviderAdapter;
  const session: IssuedSession = {
    accessToken: "access",
    accessTokenExpiresInSeconds: 600,
    refreshToken: "refresh",
    refreshTokenExpiresAt: new Date(Date.now() + 60_000),
    csrfToken: "csrf",
    sessionId: "00000000-0000-4000-8000-000000000100",
    user,
  };
  const loginWithOAuthUser = vi.fn(async () => session);
  const authService = { loginWithOAuthUser } as unknown as AuthService;
  const tokens = {
    opaque: vi
      .fn<SecureTokenGenerator["opaque"]>()
      .mockReturnValueOnce("state-value")
      .mockReturnValueOnce("nonce-value")
      .mockReturnValueOnce("verifier-value"),
    digest: vi.fn((value: string) => `digest:${value}`),
    id: vi.fn(() => "00000000-0000-4000-8000-000000000200"),
  } satisfies SecureTokenGenerator;
  const clock: Clock = { now: () => new Date("2026-07-31T12:00:00Z") };
  return {
    service: new OAuthService({
      repository,
      providers: new Map([["google", provider]]),
      authService,
      tokens,
      clock,
      appUrl: "https://focused.test",
    }),
    repository,
    provider,
    loginWithOAuthUser,
  };
}
