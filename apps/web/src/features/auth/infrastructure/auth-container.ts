import "server-only";

import { getPrismaClient } from "@focused/database";

import { AuthService } from "@/features/auth/application/auth-service";
import { OAuthService } from "@/features/auth/application/oauth-service";
import type { OAuthProviderAdapter } from "@/features/auth/application/oauth-ports";
import type { OAuthProvider } from "@/features/auth/domain/oauth-types";
import { AesGcmSecretCipher } from "@/features/auth/infrastructure/crypto/aes-gcm-secret-cipher";
import { JoseAccessTokenIssuer } from "@/features/auth/infrastructure/crypto/jose-access-token-issuer";
import { NodeTokenGenerator } from "@/features/auth/infrastructure/crypto/node-token-generator";
import { PrismaAuthRepository } from "@/features/auth/infrastructure/persistence/prisma-auth-repository";
import { PrismaOAuthRepository } from "@/features/auth/infrastructure/persistence/prisma-oauth-repository";
import { OAuthHttpProviderAdapter } from "@/features/auth/infrastructure/oauth/oauth-provider-adapter";
import { InMemoryAuthRateLimiter } from "@/features/auth/infrastructure/rate-limit/in-memory-auth-rate-limiter";
import { UpstashAuthRateLimiter } from "@/features/auth/infrastructure/rate-limit/upstash-auth-rate-limiter";
import { SystemClock } from "@/infrastructure/time/system-clock";
import { getServerEnvironment } from "@/lib/config/server-env";
import { AppError } from "@/lib/errors/app-error";

let authService: AuthService | undefined;
let oauthService: OAuthService | undefined;

export function getAuthService(): AuthService {
  if (authService) return authService;
  const environment = getServerEnvironment();
  const required = {
    DATABASE_URL: environment.DATABASE_URL,
    AUTH_JWT_PRIVATE_KEY_BASE64: environment.AUTH_JWT_PRIVATE_KEY_BASE64,
    AUTH_JWT_PUBLIC_KEY_BASE64: environment.AUTH_JWT_PUBLIC_KEY_BASE64,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new AppError({
      code: "DEPENDENCY_UNAVAILABLE",
      safeMessage: "Authentication is not configured for this environment.",
      details: { missing },
    });
  }

  const tokens = new NodeTokenGenerator();
  const rateLimiter =
    environment.UPSTASH_REDIS_REST_URL && environment.UPSTASH_REDIS_REST_TOKEN
      ? new UpstashAuthRateLimiter({
          url: environment.UPSTASH_REDIS_REST_URL,
          token: environment.UPSTASH_REDIS_REST_TOKEN,
        })
      : environment.NODE_ENV === "production"
        ? unavailableProductionRateLimiter()
        : new InMemoryAuthRateLimiter();

  authService = new AuthService({
    repository: new PrismaAuthRepository(
      getPrismaClient(required.DATABASE_URL!),
    ),
    accessTokens: new JoseAccessTokenIssuer({
      privateKey: decodePem(required.AUTH_JWT_PRIVATE_KEY_BASE64!),
      publicKey: decodePem(required.AUTH_JWT_PUBLIC_KEY_BASE64!),
      keyId: environment.AUTH_JWT_KEY_ID,
      issuer: environment.AUTH_JWT_ISSUER ?? environment.NEXT_PUBLIC_APP_URL,
      audience: environment.AUTH_JWT_AUDIENCE,
    }),
    tokens,
    rateLimiter,
    clock: new SystemClock(),
    appUrl: environment.NEXT_PUBLIC_APP_URL,
  });
  return authService;
}

export function getOAuthService(): OAuthService {
  if (oauthService) return oauthService;
  const environment = getServerEnvironment();
  const configuredAuth = getAuthService();
  if (
    !environment.DATABASE_URL ||
    !environment.AUTH_DATA_ENCRYPTION_KEY_BASE64
  ) {
    throw new AppError({
      code: "DEPENDENCY_UNAVAILABLE",
      safeMessage: "OAuth is not configured for this environment.",
    });
  }
  const providers = new Map<OAuthProvider, OAuthProviderAdapter>();
  addProvider(
    providers,
    "google",
    environment.GOOGLE_OAUTH_CLIENT_ID,
    environment.GOOGLE_OAUTH_CLIENT_SECRET,
  );
  const tokens = new NodeTokenGenerator();
  oauthService = new OAuthService({
    repository: new PrismaOAuthRepository(
      getPrismaClient(environment.DATABASE_URL),
      new AesGcmSecretCipher(environment.AUTH_DATA_ENCRYPTION_KEY_BASE64),
    ),
    providers,
    authService: configuredAuth,
    tokens,
    clock: new SystemClock(),
    appUrl: environment.NEXT_PUBLIC_APP_URL,
  });
  return oauthService;
}

function decodePem(value: string): string {
  return Buffer.from(value, "base64").toString("utf8");
}

function unavailableProductionRateLimiter(): never {
  throw new AppError({
    code: "DEPENDENCY_UNAVAILABLE",
    safeMessage: "Authentication rate limiting is not configured.",
  });
}

function addProvider(
  providers: Map<OAuthProvider, OAuthProviderAdapter>,
  provider: OAuthProvider,
  clientId: string | undefined,
  clientSecret: string | undefined,
): void {
  if (!clientId || !clientSecret) return;
  const configuration = providerConfiguration();
  providers.set(
    provider,
    new OAuthHttpProviderAdapter({
      provider,
      clientId,
      clientSecret,
      ...configuration,
    }),
  );
}

function providerConfiguration() {
  return {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    scopes: ["openid", "email", "profile"],
    issuer: "https://accounts.google.com",
    jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
  } as const;
}
