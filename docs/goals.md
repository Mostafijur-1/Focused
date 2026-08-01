# Goals, Life Vision, and Weekly Planning (Milestone 6)

Milestone 6 connects long-term direction to measurable outcomes and a realistic week. Goals are private by default. AI has no mutation path: a future AI provider may create a proposal, but only the member can save a commitment or move aggregate state.

## Architecture

```text
Bangla/English UI ── Bearer REST ── GoalService ── GoalRepository port
                                             │                 │
                                      pure policies      Prisma/PostgreSQL
                                      state machine      optimistic locks
                                      local dates        append-only history
                                                         transactional outbox
```

The feature lives under `apps/web/src/features/goals/`: `domain` contains pure progress, transition, overdue, capacity, and week policies; `application` owns authorization and use cases; `infrastructure` implements owner-scoped PostgreSQL transactions; `transport` contains strict Zod contracts; and `ui` provides accessible localized workflows.

## Aggregate and history decisions

- `Goal.version` is the optimistic lock. Status changes use an allow-list state machine; REST payloads cannot directly assign status.
- Hierarchies are owner-scoped, cycle-free, and limited to three levels. Moving a parent also considers the depth of its descendants.
- Manual progress is a bounded percentage. Milestone progress is the weighted completed ratio. Key-result progress is the weighted, clamped `current / target` ratio.
- `GoalCheckIn` and `GoalStatusTransition` are append-only. Client command UUIDs make create, transition, check-in, milestone, and key-result delivery safe to retry.
- `LifeVision` is a revision, not a mutable profile field. Saving a changed draft archives the prior draft and creates the next private revision. Publishing is explicit.
- One canonical `WEEKLY` plan exists per member and local week. Draft edits use optimistic locking; final plans are read-only. Capacity excess produces a warning and never blocks finalization.
- `GoalLink` stores a stable reference to an owner-validated resource. It does not copy source content and does not cascade-delete a Goal when a linked source disappears.

## REST resources

All routes require the matching `*:read:own` or `*:write:own` permission. Foreign UUIDs resolve as not found or validation failure without revealing ownership.

| Method            | Route                                              | Purpose                                               |
| ----------------- | -------------------------------------------------- | ----------------------------------------------------- |
| `GET` / `POST`    | `/api/v1/goals`                                    | Bounded search/filter list; idempotent create         |
| `GET` / `PATCH`   | `/api/v1/goals/{goalId}`                           | Detail; optimistic edit                               |
| `POST`            | `/api/v1/goals/{goalId}/transition`                | Explicit state transition and completion confirmation |
| `POST`            | `/api/v1/goals/{goalId}/check-ins`                 | Append measurable progress/evidence                   |
| `POST`            | `/api/v1/goals/{goalId}/milestones`                | Add a weighted milestone                              |
| `PATCH`           | `/api/v1/goals/{goalId}/milestones/{milestoneId}`  | Versioned milestone update                            |
| `POST`            | `/api/v1/goals/{goalId}/key-results`               | Add a weighted key result                             |
| `PATCH`           | `/api/v1/goals/{goalId}/key-results/{keyResultId}` | Update measurable key-result progress                 |
| `POST` / `DELETE` | `/api/v1/goals/{goalId}/links[/linkId]`            | Link or unlink an owned source                        |
| `GET` / `PUT`     | `/api/v1/life-vision`                              | Read current revision; save a new draft revision      |
| `POST`            | `/api/v1/life-vision/{visionId}/publish`           | Publish a draft revision                              |
| `GET` / `PUT`     | `/api/v1/weekly-plans/{weekStart}`                 | Read or save the canonical weekly draft               |
| `POST`            | `/api/v1/weekly-plans/plans/{planId}/transition`   | Finalize or close a weekly plan                       |

Canonical bodies and errors are documented in `api/openapi.yaml`. Reads set `private, no-store`; private narrative is never put in shared caches, telemetry, events, or notification payloads.

## Events and scaling

Mutations append versioned events in the same PostgreSQL transaction and mark the member Dashboard snapshot stale. Events carry identifiers and small projection facts, not descriptions, check-in notes, vision narrative, or reflection. Owner/status/date indexes keep hot queries bounded. Cursor pagination avoids offsets; the list caps at 100 rows and aggregate collections have hard limits.

PostgreSQL remains authoritative. Redis is not required for correctness and may later cache disposable projections. Monthly/yearly planning, calendar allocation, sharing, and smart scheduling extend existing `Plan`, `TimeBlock`, and proposal seams without changing the mobile-neutral REST boundary.

## UI and accessibility

`/{locale}/goals` covers signed-out, loading, empty, offline cached read, unavailable, conflict, active, overdue, archived, and revision states. Private Life Vision text is not queued offline. `/{locale}/week` exposes draft/final state and a non-blocking capacity warning. Inputs have visible labels, progress has native ARIA semantics, actions are keyboard reachable, private pages are `noindex`, and layouts are checked at 320, 768, and 1280 pixels.

## Verification

- Unit/property tests: transitions, progress bounds, draft coherence, overdue rules, local week boundaries, capacity warnings, and strict mass-assignment rejection.
- PostgreSQL integration tests: idempotent create, owner isolation, stale check-in conflict, and immutable history.
- Playwright: authenticated creation, command UUIDs, responsive overflow, and WCAG automated checks.
- Migration constraints enforce progress, weights, dates, JSON size, terminal timestamps, and positive versions below application code.

Run `pnpm quality`. Set `INTEGRATION_DATABASE_URL` to a migrated disposable PostgreSQL database for repository tests.
