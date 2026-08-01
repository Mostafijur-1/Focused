# Focused REST API

The canonical machine-readable contract is [`openapi.yaml`](./openapi.yaml). It uses OpenAPI 3.1 to describe Focused's own REST interface; OpenAPI is not an AI provider. Groq and Gemini are separate infrastructure adapters behind the AI application ports.

## Conventions

- Base path: `/api/v1`
- Media type: `application/json`
- Authentication: 10-minute EdDSA bearer access token for protected routes; opaque rotating refresh cookie for browser session lifecycle
- Validation: Zod at transport boundaries, with unknown fields rejected for command payloads unless explicitly documented
- Errors: stable code, localized safe message, request correlation ID, and optional field errors defined by the contract
- Dates: RFC 3339/ISO 8601; authoritative timestamps are UTC
- Pagination: cursor-based for mutable or large collections
- Idempotency: `Idempotency-Key` on documented retryable commands
- Privacy: owner scope and authorization are enforced by application use cases, never implied by route visibility

## Local validation

```bash
pnpm api:lint
```

The CI quality gate runs the same command. Route handlers must update their Zod contracts, tests, and this OpenAPI document in the same change.

## Implemented endpoints

Milestones 1–9 implement health, Authentication, member sessions, Dashboard, Habits, Goals and planning, Focus Timer, AI Coach, AI Daily Review, explicit AI proposal decisions, Notifications, Reminders, and Web Push subscriptions. Retryable commands use body-level `clientCommandId` values; mutable aggregates and occurrences use `expectedVersion`. AI Coach responses use typed SSE, while Daily Review responses are Zod-validated structured JSON. The canonical paths and schemas are in OpenAPI; operations are documented under `docs/`, including [`../docs/ai-coach.md`](../docs/ai-coach.md) and [`../docs/notifications.md`](../docs/notifications.md).

Other paths remain approved forward contracts and are implemented milestone by milestone. Unimplemented contracts must not be deployed as handlers returning misleading success states.

## Health example

```http
GET /api/v1/health HTTP/1.1
Host: localhost:3000
X-Request-Id: example-trace-1234
```

```json
{
  "status": "ok",
  "service": "focused-web",
  "version": "development",
  "timestamp": "2026-07-31T12:00:00.000Z"
}
```

The response includes `Cache-Control: no-store` and echoes a valid `X-Request-Id`. It intentionally does not reveal provider credentials, database topology, or private readiness details.
