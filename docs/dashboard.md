# Dashboard (Milestone 4)

The Dashboard is a calm, owner-scoped read model for deciding what deserves attention now. It is not a second source of truth: plans, Focus Sessions, habits, goals, and reminders remain authoritative in their own tables and modules.

## Architecture

```text
Server route shell
  -> authenticated Dashboard client island
    -> GET /api/v1/dashboard
      -> DashboardService
        -> DashboardRepository port
          -> bounded PostgreSQL source queries
          -> versioned dashboard_snapshots projection
```

The feature lives in `apps/web/src/features/dashboard` and follows the dependency direction `UI/transport -> application -> domain`; the Prisma adapter implements application ports. The page itself stays a Server Component. A narrow Client Component fetches the private projection because browser access tokens intentionally live only in memory and the refresh cookie is restricted to Authentication routes.

## Projection and freshness

- `dashboard_snapshots` stores one schema-versioned projection per member-local date.
- Fresh projections have a five-minute time-to-live and are returned without rebuilding.
- Independent source reads use partial degradation. One failed module does not make the whole Dashboard unusable.
- If every live source fails, the latest same-day cached projection is returned as `stale`; otherwise the API fails safely.
- `dashboard_projection_cursors` records ordered event progress. A newer source event makes matching snapshots stale, and replaying the same or older cursor is idempotent. Normal authenticated reads reconcile the complete projection, so missed or delayed events cannot become permanent drift.
- Responses use `Cache-Control: private, no-store` and `Vary: Authorization`. Redis is deliberately unnecessary at this scale because the PostgreSQL projection already avoids fan-out on warm reads.

## Privacy and security

Every repository query includes the authenticated `userId`. The read model contains only display name, up to three primary priorities, aggregate progress, one active Focus Session, one next goal, and one next reminder. Journal, mood, faith, health, notes, and AI prompt contents are excluded. Logs record only safe timing, freshness, and count metadata.

The browser keeps the last successful response only in current-tab `sessionStorage` to support an explicit offline/stale state. It is not written to cross-tab local storage, service-worker caches, URLs, analytics, or logs.

Permissions:

| Capability                      |                         Member |                Admin |
| ------------------------------- | -----------------------------: | -------------------: |
| Read own Dashboard              |           `dashboard:read:own` |   No implicit access |
| Update own widget layout        | `dashboard:widgets:update:own` |   No implicit access |
| Read another member's Dashboard |                          Never | Never in Milestone 4 |

## UI states and accessibility

The primary Focus card remains visible and first. Users can reorder the remaining widgets or hide them with native checkbox and keyboard-operable move controls; optimistic concurrency prevents lost updates. The page defines loading, signed-out, first-use, empty, partial, stale, offline, save-conflict, and retry states in native-authored Bangla and English.

Mobile uses bottom navigation, tablet uses a compact rail, and desktop adds a contextual side panel. Landmarks, headings, visible focus, reduced motion, progress labels, 44px targets, light/dark themes, 320px layouts, and 200% text zoom are covered by the browser accessibility suite.

## API

- `GET /api/v1/dashboard` returns `DashboardSnapshot`.
- `PATCH /api/v1/dashboard/widgets` accepts exactly seven unique widgets and an `expectedVersion`.
- The primary `today_focus` widget must be first and visible; at least two widgets must remain visible.
- Validation uses Zod, authorization uses application permissions, and write conflicts return HTTP 409.

See the canonical schemas and response details in [`../api/openapi.yaml`](../api/openapi.yaml).

## Operational limits and testing

Hot reads use the `(userId, localDate)` unique index. Source queries cap primary priorities at 3, habits at 50, and weekly Focus Sessions at 500. Higher-volume analytics belongs to the later analytics projection, not this request path.

Unit tests cover layout policy, time zones/DST, freshness, permissions, cache use, partial failure, stale fallback, and concurrency. PostgreSQL tests cover owner isolation, index use, persistence, event replay, and version conflicts. Playwright covers responsive behavior, offline fallback, keyboard customization, privacy-safe UI, and automated WCAG checks.

Habit, goal, Focus Timer, and AI Coach cards intentionally expose only readiness boundaries until their owning milestones implement commands. Milestone 4 does not create shadow write paths for future features.
