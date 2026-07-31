import type { Clock } from "@/application/ports/clock";
import type { AuthService } from "@/features/auth/application/auth-service";
import type {
  OAuthProviderAdapter,
  OAuthRepository,
} from "@/features/auth/application/oauth-ports";
import { authPolicy } from "@/features/auth/domain/auth-policy";
import type {
  IssuedSession,
  RequestSecurityContext,
} from "@/features/auth/domain/auth-types";
import type { OAuthProvider } from "@/features/auth/domain/oauth-types";
import { AppError } from "@/lib/errors/app-error";

import type { SecureTokenGenerator } from "./ports";

interface OAuthServiceDependencies {
  readonly repository: OAuthRepository;
  readonly providers: ReadonlyMap<OAuthProvider, OAuthProviderAdapter>;
  readonly authService: AuthService;
  readonly tokens: SecureTokenGenerator;
  readonly clock: Clock;
  readonly appUrl: string;
}

export interface OAuthStartInput {
  readonly provider: OAuthProvider;
  readonly locale: "bn-BD" | "en";
  readonly timeZone: string;
  readonly returnTo: string;
}

export interface OAuthStartResult {
  readonly authorizationUrl: string;
  readonly state: string;
  readonly expiresAt: Date;
}

export interface OAuthCompletion {
  readonly session: IssuedSession;
  readonly returnTo: string;
}

export class OAuthService {
  constructor(private readonly dependencies: OAuthServiceDependencies) {}

  enabledProviders(): readonly OAuthProvider[] {
    return [...this.dependencies.providers.keys()];
  }

  async start(input: OAuthStartInput): Promise<OAuthStartResult> {
    const provider = this.provider(input.provider);
    const returnTo = safeReturnTo(input.returnTo, input.locale);
    const now = this.dependencies.clock.now();
    const expiresAt = new Date(
      now.getTime() + authPolicy.oauthTransactionSeconds * 1000,
    );
    const state = this.dependencies.tokens.opaque();
    const nonce = this.dependencies.tokens.opaque();
    const codeVerifier = this.dependencies.tokens.opaque(48);
    const redirectUri = new URL(
      `/api/v1/auth/oauth/${input.provider}/callback`,
      this.dependencies.appUrl,
    ).toString();

    await this.dependencies.repository.createTransaction({
      id: this.dependencies.tokens.id(),
      provider: input.provider,
      stateHash: this.dependencies.tokens.digest(state),
      nonceHash: this.dependencies.tokens.digest(nonce),
      codeVerifier,
      nonce,
      redirectUri,
      returnTo,
      locale: input.locale,
      timeZone: input.timeZone,
      expiresAt,
    });
    return {
      authorizationUrl: provider
        .authorizationUrl({ state, nonce, codeVerifier, redirectUri })
        .toString(),
      state,
      expiresAt,
    };
  }

  async complete(
    providerName: OAuthProvider,
    state: string,
    code: string,
    context: RequestSecurityContext,
  ): Promise<OAuthCompletion> {
    const transaction = await this.dependencies.repository.consumeTransaction(
      providerName,
      this.dependencies.tokens.digest(state),
      this.dependencies.clock.now(),
    );
    if (!transaction) throw oauthFailure();
    const identity = await this.provider(providerName).exchange({
      code,
      nonce: transaction.nonce,
      codeVerifier: transaction.codeVerifier,
      redirectUri: transaction.redirectUri,
    });
    const user = await this.dependencies.repository.resolveIdentity(
      identity,
      transaction.locale,
      transaction.timeZone,
      context,
      this.dependencies.clock.now(),
    );
    return {
      session: await this.dependencies.authService.loginWithOAuthUser(
        user,
        providerName,
        context,
      ),
      returnTo: transaction.returnTo,
    };
  }

  private provider(name: OAuthProvider): OAuthProviderAdapter {
    const provider = this.dependencies.providers.get(name);
    if (!provider) {
      throw new AppError({
        code: "DEPENDENCY_UNAVAILABLE",
        safeMessage: "This identity provider is not configured.",
      });
    }
    return provider;
  }
}

function safeReturnTo(value: string, locale: "bn-BD" | "en"): string {
  if (!value.startsWith(`/${locale}/`) || value.startsWith(`/${locale}//`)) {
    return `/${locale}/auth-complete`;
  }
  const url = new URL(value, "https://focused.invalid");
  if (url.origin !== "https://focused.invalid")
    return `/${locale}/auth-complete`;
  return `${url.pathname}${url.search}${url.hash}`;
}

function oauthFailure(): AppError {
  return new AppError({
    code: "AUTH_INVALID_CREDENTIALS",
    safeMessage: "The OAuth transaction is invalid or has expired.",
  });
}
