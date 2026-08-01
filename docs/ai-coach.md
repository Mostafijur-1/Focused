# AI Coach and Daily Review — Milestone 8

Focused treats AI as a consented advisory boundary, not an authority or a privileged automation channel. The member owns the conversation, chooses each context scope, sees the evidence manifest, and confirms every proposed write.

## Architecture

The `ai` feature follows Clean Architecture:

- `domain`: privacy policy, input limits, prompt-injection controls, proposal invariants, and versioned Bangla/English prompts.
- `application`: AI Coach, Daily Review, proposal decision use cases, provider/repository/executor ports, authorization, and rate limits.
- `infrastructure/providers`: raw server-side Groq and Gemini HTTP adapters normalized to one stream/structured-output contract.
- `infrastructure/persistence`: Prisma-owned conversations, messages, runs, request-scoped grants, evidence manifests, usage, failures, and proposals.
- `transport`: strict Zod request/response/SSE schemas and authenticated REST Route Handlers.
- `ui`: Bangla-first accessible Coach, scope controls, Review, evidence labels, proposal edit/apply/reject, and deterministic fallback states.

Neither Route Handlers nor application services import a vendor SDK. Model identifiers are operational configuration. `fast_text` prefers Groq; `deep_review` prefers Gemini only when the provider is eligible for the request's data class, then falls back to another eligible adapter.

## Privacy and consent

Milestone 8 exposes only four aggregate context scopes:

- `daily_plan`
- `focus_summary`
- `habit_summary`
- `goal_summary`

Each request persists a short-lived `AIContextGrant` with source version and expiry. Context is minimized to a daily summary, escaped, wrapped as untrusted data, and included in an auditable `AIRun.inputManifest`. Raw Journal, notes, mood, sleep, workout/health, Prayer/Quran, Life Vision, uploaded files, and other sensitive content are not valid transport values and cannot be loaded by the context assembler.

Gemini unpaid service is not eligible for personal Focused context. Groq is eligible only when an operator confirms Zero Data Retention in the provider console and sets `GROQ_ZERO_DATA_RETENTION=true`. Gemini becomes eligible for personal context only with an approved paid-service privacy review and `GEMINI_SERVICE_TIER=paid`. Missing or ineligible providers produce a deterministic local response; policy never silently weakens on fallback.

Official provider references used for the adapter contract and privacy policy:

- Groq [Chat Completions and streaming](https://console.groq.com/docs/text-chat), [API reference](https://console.groq.com/docs/api-reference), [models](https://console.groq.com/docs/models), [rate limits](https://console.groq.com/docs/rate-limits), and [data controls/ZDR](https://console.groq.com/docs/your-data).
- Gemini [generateContent and streamGenerateContent](https://ai.google.dev/api/generate-content), [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output), [models](https://ai.google.dev/gemini-api/docs/models), and [unpaid/paid data terms](https://ai.google.dev/gemini-api/terms).

## Configuration

All values are server-only. Never use a `NEXT_PUBLIC_` prefix.

| Variable                       | Purpose                                     | Safe default                                                         |
| ------------------------------ | ------------------------------------------- | -------------------------------------------------------------------- |
| `GROQ_API_KEY`                 | Groq server credential                      | unset                                                                |
| `GROQ_MODEL`                   | Model behind `fast_text`                    | `llama-3.3-70b-versatile`                                            |
| `GROQ_ZERO_DATA_RETENTION`     | Operator assertion that Groq ZDR is enabled | `false`                                                              |
| `GEMINI_API_KEY`               | Gemini server credential                    | unset                                                                |
| `GEMINI_MODEL`                 | Model behind `deep_review`                  | `gemini-3.6-flash`                                                   |
| `GEMINI_SERVICE_TIER`          | Approved privacy tier                       | `unpaid`                                                             |
| `UPSTASH_REDIS_REST_URL/TOKEN` | Distributed per-member AI rate limit        | optional locally; required for multi-instance production enforcement |

Before enabling an adapter in production, verify current model availability, quota, region, retention controls, content terms, and spend ceiling. Free-tier availability is not an SLA.

## REST and SSE contracts

- `GET /api/v1/ai` — recent conversations, latest Daily Review, eligible status, context scope catalog, and pending proposals.
- `POST /api/v1/ai/coach/messages` — one idempotent Coach turn; returns `text/event-stream`.
- `POST /api/v1/ai/reviews/daily` — one idempotent structured Daily Review or deterministic fallback.
- `POST /api/v1/ai/proposals/{proposalId}/decision` — explicit `apply` or `reject` with `expectedVersion` and `clientCommandId`.

Coach event types are `run.started`, `message.delta`, `citation`, `usage`, `warning`, `run.completed`, and `run.failed`. The provider stream is never forwarded verbatim. Adapter events are parsed, bounded, normalized, and re-encoded by Focused.

## Proposal safety

Generated Goal proposals are Zod-validated and stored as expiring `PENDING` records. Apply follows this state machine:

```text
PENDING/APPLY_FAILED → APPLYING → ACCEPTED
                              ↘ APPLY_FAILED
PENDING → REJECTED
```

The compare-and-set transition to `APPLYING` happens before any domain call. Only then does `GoalProposalExecutor` call the existing authorized `GoalService.create` with the decision command ID. Goal creation is idempotent on that ID. An AI provider cannot call this executor and receives no member bearer or refresh token.

## Failure and fallback behavior

- Provider `429`/`5xx`, invalid JSON, empty output, timeout, and safety/schema failure are normalized and do not leak provider bodies.
- A per-provider circuit breaker opens after consecutive failures; distributed request limits and a rolling 50,000-token member budget bound abuse and free-tier exposure.
- A second provider is attempted only when privacy policy permits it.
- Coach falls back to a short local next-step prompt; Daily Review falls back to a source-aware local template.
- No fallback sends excluded data or creates a proposal silently.
- The UI does not queue AI or proposal-acceptance work offline.
- API keys, prompt bodies, model output, and private context are excluded from application logs.

## Testing and acceptance traceability

- Policy tests cover scope allowlists, prompt exfiltration, privacy-tier routing, markup escaping, and proposal bounds.
- Adapter contract tests cover Groq SSE, Gemini structured output, usage normalization, and API-key placement.
- Service tests prove the normal Goal use case is not invoked before explicit apply and rejection performs no mutation.
- Transport tests reject undeclared sensitive scopes and unversioned decisions.
- Playwright covers native Bangla/English rendering, scope selection, streaming, deterministic Review, proposal confirmation, responsive overflow, keyboard behavior, and automated WCAG checks.

These controls satisfy FR-AICOACH-001 through FR-AICOACH-003 and FR-AIDAILY-001 through FR-AIDAILY-003 for the Milestone 8 slice. AI Mentor and weekly/monthly reviews remain later milestones.

## Operations and rollback

Monitor run counts by status/provider/model alias, p95 first-token and total latency, normalized provider failures, fallback rate, input/output tokens, proposal acceptance, and apply failures. Alert on privacy-policy denials changing unexpectedly, sustained fallback, repeated schema failures, or token-budget spikes.

Rollback does not require deleting audit history: disable provider eligibility by setting ZDR false/removing keys, or deploy the previous application. Existing conversations, completed runs, grants, and proposals remain owner-scoped. Pending proposals may be rejected or allowed to expire; never rewrite them during rollback.
