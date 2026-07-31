# Habit System (Milestone 5)

Focused treats a habit as a private, versioned commitment—not a score of personal worth. A missed day is historical information; a deliberate pause is excluded from consistency, and the interface emphasizes returning instead of preserving a streak.

## Architecture

```text
Bangla/English Habit UI ── Bearer REST API ── HabitService ── HabitRepository port
          │                                      │                   │
          └── private IndexedDB command queue    ├── schedule policy └── Prisma/PostgreSQL
                                                 ├── target policy       ├── immutable schedules
                                                 └── authorization       ├── occurrences + entries
                                                                          ├── correction ledger
                                                                          └── transactional outbox
```

The module follows a feature-owned Clean Architecture layout:

```text
apps/web/src/features/habits/
├── domain/          Pure schedules, targets, consistency, and public types
├── application/     Use cases, repository ports, and occurrence worker
├── infrastructure/ Prisma adapter, atomic outbox writes, and composition
├── transport/       Strict Zod request/response contracts and route helpers
└── ui/              Native copy, forms, states, history, and offline commands
```

`features/tracking/domain/tracker-definition.ts` is a deliberately small type seam for Reading, Learning, Programming, Quran, Prayer, Workout, Sleep, and Mood milestones. Those modules can reuse entry-field definitions without turning the generic Habit aggregate into an unbounded JSON framework.

## Data ownership and historical truth

- `Habit` is the member-owned aggregate root. `version` is the optimistic lock.
- `HabitScheduleVersion` is immutable after it closes. A change starts on a member-local `effectiveFrom`; previous occurrences and entries retain their original target and time zone.
- `HabitOccurrence` represents whether one habit was due on one local date. `(habitId, localDate)` is unique, so a due day cannot be counted twice.
- `HabitEntry` is the current answer for an occurrence. `(habitId, clientCommandId)` and `occurrenceId` are unique.
- `HabitEntryRevision` preserves every correction and undo. It is never used as a destructive overwrite log.
- `HabitPause` marks an inclusive excused range. Resume closes today; the habit can become due again from the next local date.

Schedule input is intentionally bounded: daily, selected weekdays, an interval of 2–30 days, or at most 128 explicit dates spanning at most 366 days. Arbitrary cron/RRULE input is not accepted.

## REST resources

All routes require `habits:read:own` or `habits:write:own`; another member's identifier resolves as not found.

| Method            | Route                                   | Purpose                                                         |
| ----------------- | --------------------------------------- | --------------------------------------------------------------- |
| `GET`             | `/api/v1/habits`                        | Expand the bounded local window and list active/archived habits |
| `POST`            | `/api/v1/habits`                        | Create a habit idempotently with `clientCommandId`              |
| `PATCH`           | `/api/v1/habits/{habitId}`              | Create a future-effective schedule version                      |
| `GET`             | `/api/v1/habits/{habitId}/entries`      | Read 42 reverse-chronological occurrences per page              |
| `POST`            | `/api/v1/habits/{habitId}/entries`      | Record, skip, or correct an entry idempotently                  |
| `POST`            | `/api/v1/habits/{habitId}/entries/undo` | Record an undo revision for today's entry                       |
| `POST`            | `/api/v1/habits/{habitId}/pause`        | Start an excused period                                         |
| `POST`            | `/api/v1/habits/{habitId}/resume`       | Close the current excused period                                |
| `POST` / `DELETE` | `/api/v1/habits/{habitId}/archive`      | Archive / restore without deleting history                      |

The canonical payloads and error responses are in [`api/openapi.yaml`](../api/openapi.yaml). Mutations use an explicit expected version. A `409` means the client must refresh rather than silently overwrite another device.

## Occurrence expansion and time zones

Due dates are date-only values evaluated with the member profile's IANA time zone. This avoids DST hour ambiguity. The read path self-heals a 42-day history window and 14-day future window before returning habits. `HabitOccurrenceWorker.runPage(cursor)` exposes the same idempotent expansion in bounded 100-member pages for a future durable scheduler; a cursor is returned instead of scanning all members in one Vercel invocation.

Travel does not rewrite history. A schedule version records the time zone used when its future occurrences were generated. A later product flow may ask the member whether to adopt a new zone before creating a new version.

## Offline and privacy rules

Only simple check-ins can queue Offline. The IndexedDB record contains client command ID, habit ID, local date, numeric value or completion state, and an expected entry version for a correction. Titles, notes, pause reasons, evidence, profile data, and access/refresh tokens are never written to this queue.

Commands replay in order when connectivity returns. Server idempotency makes duplicate delivery safe; a stale correction stops with `409` for explicit user resolution.

## Events and Dashboard consistency

Habit mutations append an outbox event in the same PostgreSQL transaction as the aggregate write. Events include `HabitCreated`, `HabitScheduleChanged`, `HabitEntryRecorded`, `HabitEntryCorrected`, `HabitPaused`, `HabitResumed`, `HabitArchived`, and `HabitRestored`. Aggregate-version uniqueness prevents duplicate publication. The same transaction marks the member's Dashboard snapshot stale; the Dashboard counts only due occurrences and excludes excused days.

## Limits and scaling

- 100 active habits per member; reads are hard-bounded to 150 active/archived records.
- Occurrence uniqueness plus `createMany(skipDuplicates)` makes expansion retry-safe.
- Date and owner indexes serve the hot list/history paths without global scans.
- Entry corrections use an append-only ledger and optimistic locks.
- Worker pagination is cursor-based; future queue extraction does not change the domain or REST contract.
- Archive is reversible; there is no destructive habit-delete endpoint.

## Verification

- Unit and property tests cover schedules, interval invariants, targets, completion, pauses, consistency, and strict Zod input.
- Application tests cover authorization, local-date bounds, occurrence expansion, target derivation, not-due behavior, and conflict mapping.
- PostgreSQL integration tests cover owner isolation, creation replay, occurrence uniqueness, entry replay, immutable schedules, history, pause behavior, and atomic events.
- Browser tests cover both locales, responsive behavior, keyboard operation, and automated accessibility checks.

Run `pnpm quality` for the static/unit suite and provide `INTEGRATION_DATABASE_URL` to exercise repository tests against migrated PostgreSQL.

For a permissioned non-production environment, run `k6 run -e BASE_URL=https://preview.example -e ACCESS_TOKEN=... apps/web/performance/habits.k6.js`. The default gate requires under 1% failures, p95 below 500 ms, and p99 below 1 s at 25 bounded list requests per second. Never load-test production without an approved capacity window.
