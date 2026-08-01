# Focus Timer — Milestone 7

Focused treats a Timer as an authoritative execution record, not a browser counter. The browser renders time from server timestamps; PostgreSQL owns session, interval, pause, interruption, and terminal state.

## Architecture

The `focus` feature follows the project feature boundary:

- `domain`: pure duration, pause, and Pomodoro phase policies.
- `application`: authorization, validation, use cases, and stable error mapping.
- `infrastructure`: Prisma transactions, optimistic concurrency, replay detection, and transactional outbox events.
- `transport`: strict Zod REST contracts and authenticated App Router handlers.
- `ui`: Bangla-first responsive Timer, React Hook Form setup, local sound/vibration, recovery, and IndexedDB terminal-command queue.

`FocusSession` is the aggregate root. `FocusInterval` distinguishes focused time from short and long breaks. `SessionPause` stores explicit pause ranges. `FocusSessionCommand` deduplicates replayed mutations. The partial PostgreSQL index on active sessions enforces one active Focus Session per member across tabs and devices.

## Time authority

The API returns `serverNow` and interval timestamps. The client derives its display from the returned remaining duration plus local monotonic wall progress. Refresh, browser throttling, device sleep, and reconnect trigger a server reconciliation. Browser ticks are never persisted or summed as truth.

Focused does not claim that JavaScript continues while a browser is closed or a device sleeps. When execution resumes, timestamps reconstruct the authoritative duration.

## REST API

- `GET /api/v1/focus-sessions` — active session, recent history, private presets, and linkable Goals.
- `POST /api/v1/focus-sessions` — idempotently start Deep Work, Pomodoro, or Custom focus.
- `POST /api/v1/focus-sessions/{id}/pauses`
- `POST /api/v1/focus-sessions/{id}/resumption`
- `POST /api/v1/focus-sessions/{id}/extension`
- `POST /api/v1/focus-sessions/{id}/interruptions`
- `POST /api/v1/focus-sessions/{id}/intervals/advance`
- `POST /api/v1/focus-sessions/{id}/completion`
- `POST /api/v1/focus-sessions/{id}/abandonment`
- `POST /api/v1/pomodoro-presets`
- `PATCH /api/v1/pomodoro-presets/{id}`

Every mutation includes `clientCommandId`; transitions also require `expectedVersion`. A lost response may be retried with the same command identifier without duplicating the state transition or outbox event.

## Offline and multi-device behavior

The current PWA foundation has a manifest but no production Service Worker. Milestone 7 therefore queues only replay-safe completion and abandonment commands in IndexedDB and flushes them when the application reconnects. Active countdown display continues from timestamps. A stale version returns `409 Conflict`, after which the UI reloads the authoritative session.

Push notification delivery remains owned by Milestone 9. Local sound and vibration are optional enhancements and never block completion.

## Events

The aggregate writes these events atomically with state:

- `FocusSessionStarted`
- `FocusSessionPaused`
- `FocusSessionResumed`
- `FocusSessionExtended`
- `FocusInterruptionLogged`
- `FocusIntervalAdvanced`
- `FocusSessionCompleted`
- `FocusSessionAbandoned`

Dashboard invalidation happens in the same transaction. Analytics, XP, reviews, and reminders can consume the outbox without writing into Focus Timer tables.

## Privacy and accessibility

Intent, outcome, presets, and interruption notes are owner-scoped and require `focus:read:own` or `focus:write:own`. The Timer uses large tabular numerals, text labels in addition to color, keyboard-operable controls, reduced-motion-compatible styling, and a single meaningful live-region announcement when an interval reaches zero.
