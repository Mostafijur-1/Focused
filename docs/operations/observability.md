# Observability and SLO ownership

Focused currently emits structured redacted application logs with correlation IDs and exposes public and privileged health surfaces. Provider dashboards and alert routes must be configured before production sign-off.

## Initial service objectives

| Signal                 | Initial objective                           | Alert proposal                       | Owner                |
| ---------------------- | ------------------------------------------- | ------------------------------------ | -------------------- |
| Core API availability  | 99.9% monthly                               | 5-minute and 1-hour burn-rate alerts | On-call Engineering  |
| Ordinary read API p95  | <= 300 ms excluding providers               | p95 above target for 15 minutes      | Backend/Platform     |
| Ordinary write API p95 | <= 500 ms excluding providers               | p95 above target for 15 minutes      | Backend/Platform     |
| Error rate             | < 1% non-user errors                        | > 2% for 5 minutes                   | Incident commander   |
| Neon saturation        | Below provider connection/compute threshold | > 80% for 10 minutes                 | Database owner       |
| Queue oldest age       | Below twice scheduled cadence               | Sustained threshold or DLQ growth    | Notifications owner  |
| Push delivery          | Measured by outcome, not content            | Failure spike by safe provider code  | Notifications owner  |
| AI latency/quota       | Provider-specific baseline                  | timeout/429/circuit-open spike       | AI owner             |
| Export jobs            | Bounded queue and failure age               | failed/stuck jobs above threshold    | Analytics owner      |
| OAuth                  | Successful callback ratio baseline          | state/nonce/provider failures spike  | Authentication owner |

No metric label may contain email, Goal/Focus intent, Journal/note/mood/faith/health content, AI prompt/output, notification body, token, URL query or unbounded user-supplied text. Use route templates, deployment ID, safe outcome codes and pseudonymous/bounded identifiers.

## Required dashboards

- Vercel request count, latency, status and function duration by route template/deployment.
- Neon connections, compute, storage, slow queries and migration state.
- QStash age/retry/DLQ plus notification outcome categories.
- Redis availability/rate-limit fallback without key contents.
- Groq/Gemini requests, latency, quota, circuit state and token totals without prompts.
- OAuth success/failure reason, session revocation and replay detection.
- Release annotations connecting tag, SHA, schema migration and Feature Flag change.

## Synthetic checks

Run `node scripts/deployment/smoke-deployment.mjs --base-url <https-url> --expected-version <sha>` after deploy and from an external uptime runner. Authenticated synthetic identities must use dedicated least-privilege accounts and must never be production member accounts.

Alert routing, dashboards and test incidents: **Pending provider-console setup and named human owners.**
