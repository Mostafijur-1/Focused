# Authentication Threat Model

## Scope and assets

This model covers password and OAuth sign-in, verification/recovery, browser sessions, RBAC resolution, security email delivery, and Authentication audit data. Protected assets are account control, refresh credentials, signing/encryption/provider secrets, personal identity data, permissions, and audit integrity.

Trust boundaries are the browser, Vercel Route Handlers, Neon PostgreSQL, Upstash Redis, Resend, and Google endpoints. The application treats all browser input, proxy headers outside the Vercel boundary, provider callbacks, and database state as untrusted until validated.

## Threats and controls

| Threat                                | Primary controls                                                                                    | Residual risk / response                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Credential stuffing                   | Argon2id, constant-work unknown-user path, per-account/IP-prefix distributed limits, generic errors | Add breached-password screening and adaptive signals after consent/privacy review                          |
| User enumeration                      | Same registration/recovery response; generic invalid credentials                                    | Delivery timing can still vary; provider and telemetry access is restricted                                |
| Password database theft               | Salted Argon2id hashes; no plaintext/secrets in logs                                                | Rotate credentials and notify affected members under the incident policy                                   |
| Refresh-token theft/replay            | HttpOnly/path-scoped cookie, digest-only database storage, single-use rotation, family revocation   | XSS can act as the user while active; CSP enforcement is an optimization milestone control                 |
| CSRF/login CSRF                       | SameSite cookies, exact Origin validation, double-submit token, OAuth state cookie                  | Misconfigured canonical origin causes fail-closed availability errors                                      |
| OAuth code interception               | PKCE S256, exact callback, state, one-time transaction, encrypted verifier                          | Provider compromise remains external; disable the provider and revoke affected sessions                    |
| OIDC substitution                     | Issuer, audience, signature, expiry, nonce, subject, and verified-email checks                      | Remote JWKS availability is a dependency                                                                   |
| Account takeover by email collision   | Never silently link a new provider identity to an existing local email                              | User needs a future authenticated account-linking ceremony                                                 |
| JWT privilege staleness               | 10-minute lifetime, live session/user lookup, permission-version comparison, deny-by-default policy | Database lookup trades a small latency cost for immediate revocation                                       |
| Session fixation                      | New server-generated session and token family after every successful authentication                 | Device labels are informational, not identity proof                                                        |
| Recovery-link leakage                 | Token in URL fragment, 15-minute expiry, digest-only storage, atomic use, all-session revocation    | Email account compromise remains outside application control                                               |
| Injection / malformed input           | Strict Zod objects, parameterized Prisma operations, constrained OAuth responses                    | Continue fuzzing transport parsers as endpoints expand                                                     |
| Tenant/ownership bypass               | Actor derived server-side; member session operations always filter by actor user ID                 | Admin cross-user operations remain absent until privileged controls exist                                  |
| Rate-limit bypass / memory exhaustion | Upstash shared limit in production; in-memory adapter bounded and development-only                  | Distributed adversaries require future adaptive abuse detection                                            |
| Sensitive observability               | Correlation IDs, hashed user agent/email where needed, anonymized IP prefix, logger redaction       | Audit access must be restricted and retention formalized before launch                                     |
| Provider/email/database outage        | Typed dependency errors, no-store responses, fail-closed Authentication configuration               | Authentication availability depends on external providers; alerting/SLOs arrive with deployment operations |

## Abuse cases that must remain tested

- A verification or recovery token cannot be consumed twice.
- Reusing an already rotated refresh token revokes every member of its family.
- A revoked/expired session or changed permission version invalidates an otherwise valid access token.
- An OAuth callback with missing/mismatched state, nonce, provider, or expired transaction fails.
- An OAuth identity cannot take over an existing email-owned account.
- A member cannot list or revoke another member's sessions.
- Cookie-authenticated mutations fail without both the exact trusted Origin and matching CSRF values.
- Unknown fields and oversized input fail before reaching application or persistence logic.

## Deferred controls

MFA, recovery codes, authenticated provider linking/unlinking, breached-password screening, device-risk scoring, enforced CSP nonces, full audit retention policy, and privileged admin access are explicitly deferred. No privileged permissions may be activated until MFA/step-up and admin audit acceptance criteria are implemented.
