# Focused Authentication

## Architecture

Authentication is a feature-owned Clean Architecture boundary inside the Next.js modular monolith. Route Handlers and React UI depend on application use cases; use cases depend on ports; Prisma, Neon, Google OIDC, Upstash, JOSE, and OAuth HTTP adapters implement those ports.

```text
app/api + auth UI
       |
transport validation/cookies
       |
application use cases ---- authorization policy
       |
domain policy/types
       ^
Prisma | crypto | Google OIDC | Upstash adapters
```

The REST boundary is mobile-neutral at the use-case and resource level. Browser refresh credentials are deliberately cookie-only. A future native client can add a platform credential transport adapter without changing user, session, token-family, OAuth identity, or authorization models.

## Security decisions

| Control         | Decision                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Identity        | Google Authorization Code with PKCE S256, state, OIDC nonce, exact callback, and verified provider identity              |
| Access token    | Ed25519/EdDSA JWT, 10-minute lifetime, issuer/audience/key ID, permission version, unique JWT ID                         |
| Refresh token   | 256-bit opaque value; only SHA-256 digest stored; 30-day rolling lifetime; 90-day absolute session                       |
| Replay response | Reuse of a consumed refresh token revokes the entire token family and its session                                        |
| Browser storage | Access token is memory-only; refresh token is HttpOnly, Secure in production, SameSite=Lax, and scoped to `/api/v1/auth` |
| CSRF            | Exact trusted `Origin` plus constant-time double-submit token for cookie-authenticated mutations                         |
| OAuth           | Authorization Code, PKCE S256, state, OIDC nonce, exact server callback, encrypted short-lived transaction secrets       |
| Account linking | Provider subject is authoritative; a matching email is never silently linked to an existing account                      |
| Authorization   | Deny by default; server resolves live session/user state and checks permission version before permission checks          |
| Rate limiting   | Upstash Redis in production; production fails closed if it is absent; bounded in-memory adapter is development-only      |
| Audit           | OAuth identity, session creation/revocation, refresh replay, and authorization events                                    |

Google access and refresh tokens are not persisted. Only Google's stable provider subject and verified email are stored. Google ID tokens are verified against Google's remote JWKS. Focused exposes no password registration, password login, email-verification, or password-recovery endpoints.

Privileged role definitions exist so the data model does not need to change later, but Milestone 2 grants no privileged permissions. Admin permission assignment and mandatory MFA/step-up enforcement belong to Milestone 11; privileged capabilities must not be granted before that control exists.

## Folder structure

```text
apps/web/src/features/auth/
|-- domain/          Lifetimes, identities, session types, migration-compatible policies
|-- application/     Authentication/OAuth use cases, ports, RBAC policy
|-- infrastructure/  Prisma, crypto, Google provider, rate-limit adapters
|-- transport/       Zod request contracts, cookies, request security, responses
`-- ui/              Native copy, Google entry panel, in-memory session provider, session view
```

Database access is published by `packages/platform/database`; committed migrations remain at `prisma/migrations`. Transport contracts are versioned under `/api/v1` and documented in `api/openapi.yaml`.

## Configuration

Copy `apps/web/.env.example` to `apps/web/.env.local`. Required for Google Authentication:

- `DATABASE_URL`: Neon pooled runtime URL.
- `DIRECT_URL`: Neon direct URL for Prisma migrations.
- `AUTH_JWT_PRIVATE_KEY_BASE64` and `AUTH_JWT_PUBLIC_KEY_BASE64`: base64-encoded Ed25519 PKCS#8/SPKI PEM.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: mandatory in production.
- `AUTH_DATA_ENCRYPTION_KEY_BASE64`: exactly 32 random bytes for short-lived OAuth transaction secrets.
- `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`: Google OIDC application credentials.

The production application URL, JWT issuer, Google authorized origin, and callback URL must agree exactly. The callback is:

```text
https://YOUR_HOST/api/v1/auth/oauth/google/callback
```

Generate local key material with OpenSSL, then base64-encode the complete PEM files using a trusted local tool. Keep private and encryption keys only in encrypted secret storage; never paste them into source, issues, logs, or `NEXT_PUBLIC_*` variables.

## Database and deployment

```bash
pnpm db:validate
pnpm db:generate
pnpm db:migrate:deploy
```

Run migration deployment once per environment before promoting application traffic. Use a Neon branch for previews and migration rehearsals. Never run `prisma db push` against shared or production databases. The CI authentication database job applies committed migrations to an ephemeral PostgreSQL 16 service and tests OAuth identity persistence plus refresh replay revocation.

On Vercel, set all production secrets in the Production environment and provider callback secrets separately for Preview when previews need Authentication. `NEXT_PUBLIC_APP_URL`, token issuer, OAuth callback registration, and the deployed origin must agree exactly.

## Key rotation and incidents

The current verifier loads one Ed25519 public key. Rotate with a coordinated deploy: stop issuing from the old key, deploy the new key pair, and accept that existing access tokens can require sign-in again for at most 10 minutes. A later JWKS key ring can provide overlap without changing token claims.

If a refresh token is suspected compromised, revoke the session. If a Google identity is compromised, revoke Focused sessions and follow Google's account-recovery process. For signing-key compromise, replace the pair, increment affected users' `permissionVersion` or revoke sessions, rotate OAuth transaction encryption material after short-lived transactions expire, and preserve audit evidence. Rotate Upstash, Google OAuth, Neon, and Vercel credentials at their providers, then update environment secrets and redeploy.

Security responses are generic by design. Operators correlate a reported failure using `X-Request-Id`/`correlationId`; logs and audit metadata must never contain raw passwords, tokens, authorization codes, provider secrets, or full IP addresses.

## Verification

```bash
pnpm test
pnpm test:coverage
pnpm api:lint
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
```

Live Google smoke tests require controlled provider credentials and must be run in an isolated Preview environment before production enablement.
