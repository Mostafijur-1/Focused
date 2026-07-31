import "server-only";

import { getPrismaClient } from "@focused/database";

import { AuthService } from "@/features/auth/application/auth-service";
import { OAuthService } from "@/features/auth/application/oauth-service";
import type { OAuthProviderAdapter } from "@/features/auth/application/oauth-ports";
import type { OAuthProvider } from "@/features/auth/domain/oauth-types";
import { AesGcmSecretCipher } from "@/features/auth/infrastructure/crypto/aes-gcm-secret-cipher";
import { ArgonPasswordHasher } from "@/features/auth/infrastructure/crypto/argon-password-hasher";
import { JoseAccessTokenIssuer } from "@/features/auth/infrastructure/crypto/jose-access-token-issuer";
import { NodeTokenGenerator } from "@/features/auth/infrastructure/crypto/node-token-generator";
import { ResendAuthMessageSender } from "@/features/auth/infrastructure/messaging/resend-auth-message-sender";
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
    RESEND_API_KEY: environment.RESEND_API_KEY,
    AUTH_EMAIL_FROM: environment.AUTH_EMAIL_FROM,
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
    passwordHasher: new ArgonPasswordHasher(),
    accessTokens: new JoseAccessTokenIssuer({
      privateKey: decodePem(required.AUTH_JWT_PRIVATE_KEY_BASE64!),
      publicKey: decodePem(required.AUTH_JWT_PUBLIC_KEY_BASE64!),
      keyId: environment.AUTH_JWT_KEY_ID,
      issuer: environment.AUTH_JWT_ISSUER ?? environment.NEXT_PUBLIC_APP_URL,
      audience: environment.AUTH_JWT_AUDIENCE,
    }),
    tokens,
    messages: new ResendAuthMessageSender({
      apiKey: required.RESEND_API_KEY!,
      from: required.AUTH_EMAIL_FROM!,
    }),
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
  addProvider(
    providers,
    "github",
    environment.GITHUB_OAUTH_CLIENT_ID,
    environment.GITHUB_OAUTH_CLIENT_SECRET,
  );
  addProvider(
    providers,
    "microsoft",
    environment.MICROSOFT_OAUTH_CLIENT_ID,
    environment.MICROSOFT_OAUTH_CLIENT_SECRET,
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
  const configuration = providerConfiguration(provider);
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

function providerConfiguration(provider: OAuthProvider) {
  if (provider === "google") {
    return {
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      scopes: ["openid", "email", "profile"],
      issuer: "https://accounts.google.com",
      jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
    } as const;
  }
  if (provider === "microsoft") {
    return {
      authorizationEndpoint:
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenEndpoint:
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      scopes: ["openid", "email", "profile"],
      jwksUri: "https://login.microsoftonline.com/common/discovery/v2.0/keys",
    } as const;
  }
  return {
    authorizationEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
    scopes: ["read:user", "user:email"],
  } as const;
}
