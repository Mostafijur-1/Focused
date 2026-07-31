import type {
  AuthUser,
  RequestSecurityContext,
} from "@/features/auth/domain/auth-types";
import type {
  OAuthIdentity,
  OAuthProvider,
  OAuthTransaction,
} from "@/features/auth/domain/oauth-types";

export interface OAuthTransactionInput extends OAuthTransaction {
  readonly id: string;
  readonly stateHash: string;
  readonly nonceHash: string | null;
  readonly expiresAt: Date;
}

export interface OAuthRepository {
  createTransaction(input: OAuthTransactionInput): Promise<void>;
  consumeTransaction(
    provider: OAuthProvider,
    stateHash: string,
    now: Date,
  ): Promise<OAuthTransaction | null>;
  resolveIdentity(
    identity: OAuthIdentity,
    locale: "bn-BD" | "en",
    timeZone: string,
    context: RequestSecurityContext,
    now: Date,
  ): Promise<AuthUser>;
}

export interface OAuthAuthorizationInput {
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
}

export interface OAuthCallbackInput {
  readonly code: string;
  readonly nonce: string | null;
  readonly codeVerifier: string;
  readonly redirectUri: string;
}

export interface OAuthProviderAdapter {
  readonly provider: OAuthProvider;
  authorizationUrl(input: OAuthAuthorizationInput): URL;
  exchange(input: OAuthCallbackInput): Promise<OAuthIdentity>;
}

export interface SecretCipher {
  encrypt(plaintext: string): Uint8Array<ArrayBuffer>;
  decrypt(ciphertext: Uint8Array<ArrayBufferLike>): string;
}
