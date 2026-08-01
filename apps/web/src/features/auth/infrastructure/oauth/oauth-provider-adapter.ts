import { createHash } from "node:crypto";

import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

import type {
  OAuthAuthorizationInput,
  OAuthCallbackInput,
  OAuthProviderAdapter,
} from "@/features/auth/application/oauth-ports";
import type {
  OAuthIdentity,
  OAuthProvider,
} from "@/features/auth/domain/oauth-types";
import {
  isPlausibleEmail,
  normalizeEmail,
} from "@/features/auth/domain/auth-policy";
import { AppError } from "@/lib/errors/app-error";

interface ProviderOptions {
  readonly provider: OAuthProvider;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly authorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly scopes: readonly string[];
  readonly issuer?: string;
  readonly jwksUri?: string;
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  id_token: z.string().min(1).optional(),
});

export class OAuthHttpProviderAdapter implements OAuthProviderAdapter {
  readonly provider: OAuthProvider;
  private readonly options: ProviderOptions;
  private remoteJwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(options: ProviderOptions) {
    this.options = options;
    this.provider = options.provider;
  }

  authorizationUrl(input: OAuthAuthorizationInput): URL {
    const url = new URL(this.options.authorizationEndpoint);
    url.search = new URLSearchParams({
      client_id: this.options.clientId,
      redirect_uri: input.redirectUri,
      response_type: "code",
      scope: this.options.scopes.join(" "),
      state: input.state,
      nonce: input.nonce,
      code_challenge: base64UrlSha256(input.codeVerifier),
      code_challenge_method: "S256",
    }).toString();
    return url;
  }

  async exchange(input: OAuthCallbackInput): Promise<OAuthIdentity> {
    try {
      const response = await fetch(this.options.tokenEndpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: input.code,
          redirect_uri: input.redirectUri,
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
          code_verifier: input.codeVerifier,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw providerUnavailable();
      const parsed = tokenResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw providerUnavailable();

      return await this.oidcIdentity(parsed.data.id_token, input.nonce);
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      throw providerUnavailable(cause);
    }
  }

  private async oidcIdentity(
    idToken: string | undefined,
    expectedNonce: string | null,
  ): Promise<OAuthIdentity> {
    if (!idToken || !expectedNonce || !this.options.jwksUri)
      throw providerUnavailable();
    if (!this.options.issuer) throw providerUnavailable();
    const result = await jwtVerify(
      idToken,
      (this.remoteJwks ??= createRemoteJWKSet(new URL(this.options.jwksUri))),
      {
        algorithms: ["RS256"],
        issuer: this.options.issuer,
        audience: this.options.clientId,
        clockTolerance: 30,
      },
    );
    if (result.payload.nonce !== expectedNonce) throw providerUnavailable();
    if (result.payload.email_verified !== true) {
      throw new AppError({
        code: "FORBIDDEN",
        safeMessage: "A verified email is required from this provider.",
      });
    }
    const subject = stringClaim(result.payload.sub);
    const email = stringClaim(result.payload.email);
    if (!isPlausibleEmail(email)) {
      throw new AppError({
        code: "FORBIDDEN",
        safeMessage: "A valid email is required from this provider.",
      });
    }
    const name = stringClaim(result.payload.name ?? email.split("@")[0]);
    return {
      provider: this.provider,
      subject,
      email: normalizeEmail(email),
      displayName: name.slice(0, 120),
    };
  }
}

function base64UrlSha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

function stringClaim(value: unknown): string {
  if (typeof value !== "string" || !value) throw providerUnavailable();
  return value;
}

function providerUnavailable(cause?: unknown): AppError {
  return new AppError({
    code: "DEPENDENCY_UNAVAILABLE",
    safeMessage:
      "The identity provider could not complete sign-in. Please try again.",
    cause,
  });
}
