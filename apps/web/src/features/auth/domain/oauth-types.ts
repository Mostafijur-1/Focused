export const oauthProviders = ["google"] as const;
export type OAuthProvider = (typeof oauthProviders)[number];

export interface OAuthIdentity {
  readonly provider: OAuthProvider;
  readonly subject: string;
  readonly email: string;
  readonly displayName: string;
}

export interface OAuthTransaction {
  readonly provider: OAuthProvider;
  readonly codeVerifier: string;
  readonly nonce: string | null;
  readonly redirectUri: string;
  readonly returnTo: string;
  readonly locale: "bn-BD" | "en";
  readonly timeZone: string;
}
