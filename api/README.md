# Focused REST API

The canonical machine-readable contract is [`openapi.yaml`](./openapi.yaml). It uses OpenAPI 3.1 to describe Focused's own REST interface; OpenAPI is not an AI provider. Groq and Gemini are separate infrastructure adapters planned for Milestone 8.

## Conventions

- Base path: `/api/v1`
- Media type: `application/json`
- Authentication: short-lived bearer access token for protected routes; rotating refresh cookie only on the refresh endpoint
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

| Method | Path             | Authentication | Purpose                                                           |
| ------ | ---------------- | -------------- | ----------------------------------------------------------------- |
| `GET`  | `/api/v1/health` | Public         | Process availability, version, timestamp, and request correlation |

The remaining paths are approved forward contracts and are implemented milestone by milestone. Unimplemented contracts must not be deployed as handlers returning misleading success states.

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
