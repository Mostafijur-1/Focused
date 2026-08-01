# Notifications and Reminder Engine — Milestone 9

Focused delivers calm, privacy-preserving reminders. PostgreSQL is the source of truth; QStash only wakes a bounded worker. Losing or replaying a queue message therefore cannot lose a reminder or create a second inbox item.

## Architecture

The `notifications` feature is a Clean Architecture slice:

- `domain`: schedule expansion, quiet-hours policy, safe push copy, limits, and time-zone/DST rules.
- `application`: owner-authorized notification, preference, subscription, reminder, occurrence, and worker use cases.
- `infrastructure/persistence`: Prisma repositories, optimistic concurrency, idempotency, encrypted subscriptions, delivery attempts, and PostgreSQL work claiming.
- `infrastructure/jobs`: QStash publishing and signature verification.
- `infrastructure/push`: provider-neutral Web Push adapter using VAPID.
- `transport`: strict Zod schemas and authenticated REST handlers.
- `ui`: native Bangla/English inbox, reminder editor, occurrence actions, preferences, push consent, and offline read fallback.

```text
Browser → REST API → Notification/Reminder service → PostgreSQL
                    ↓ best-effort wake-up
                  QStash → signed internal route → bounded worker
                                                   ├─ in-app inbox
                                                   └─ Web Push service
```

The worker expands a 31-day schedule horizon and claims at most 100 due occurrences with `FOR UPDATE SKIP LOCKED`. A stable occurrence key and notification deduplication key make queue replay safe. Per-target delivery attempts prevent already successful devices from receiving a retry again.

## Scheduling and member control

- One-time reminders use an absolute future instant.
- Daily reminders support a 1–30 day interval.
- Weekly reminders require one or more weekdays.
- Recurrence is interpreted in the reminder's IANA time zone. A daylight-saving gap advances to the first valid local instant; an overlap consistently uses the earlier instant.
- Members can pause, resume, complete, or delete a reminder, and snooze for 10 minutes, skip, or complete its next occurrence.
- Every mutation is owner-scoped. Aggregate and occurrence changes use `expectedVersion`; create uses `clientCommandId` for replay safety.

AI Smart Reminder remains a later, opt-in capability. It may propose a schedule but cannot create or alter one without explicit member confirmation through the normal Reminder use case.

## Privacy and security

The lock-screen payload never contains a reminder title, body, goal, habit, or other private content. It carries generic locale-aware copy, a notification ID, and an allow-listed same-origin deep link; authenticated REST fetches the private inbox content after the app opens.

Push endpoint, `p256dh`, and auth secret are encrypted with the existing AES-GCM Authentication data key, while a SHA-256 endpoint fingerprint provides lookup/deduplication without exposing the endpoint. Service workers do not cache authenticated responses. Revoked, expired, `404`, or `410` subscriptions are retired. QStash requests are accepted only after current/next signing-key verification against the exact request body and URL.

System and security notification preferences must never become a substitute for mandatory transactional security delivery. This milestone implements in-app and Web Push reminders; email security delivery stays in the Authentication subsystem.

## REST contracts

- `GET /api/v1/notifications` — cursor-paginated inbox.
- `GET /api/v1/notifications/overview` — inbox, preferences, reminders, and push capability.
- `PATCH /api/v1/notifications/{notificationId}` — read, unread, archive, or restore.
- `GET|PATCH /api/v1/notification-preferences` — category channels, quiet hours, and generic preview policy.
- `POST /api/v1/push-subscriptions` — register or rotate this browser subscription.
- `DELETE /api/v1/push-subscriptions/{subscriptionId}` — revoke an owned device.
- `POST /api/v1/push-subscriptions/test` — send a privacy-safe test push.
- `GET|POST /api/v1/reminders` and `PUT|DELETE /api/v1/reminders/{reminderId}` — reminder lifecycle.
- `POST /api/v1/reminders/{reminderId}/state` — pause, resume, complete, or cancel.
- `POST /api/v1/reminder-occurrences/{occurrenceId}/action` — snooze, skip, or complete one occurrence.
- `POST /api/internal/notifications/tick` — QStash-signed internal worker; never a member API.

The canonical schemas and errors are in [`../api/openapi.yaml`](../api/openapi.yaml).

## Configuration

All values except the public VAPID key returned by an authenticated overview response remain server-only.

| Variable                          | Purpose                              | Local behavior when absent                           |
| --------------------------------- | ------------------------------------ | ---------------------------------------------------- |
| `VAPID_SUBJECT`                   | `mailto:` or HTTPS VAPID contact     | Web Push disabled                                    |
| `VAPID_PUBLIC_KEY`                | Browser application-server key       | Web Push disabled                                    |
| `VAPID_PRIVATE_KEY`               | Server signing key                   | Web Push disabled                                    |
| `QSTASH_TOKEN`                    | Publish an immediate worker wake-up  | Durable data remains; periodic worker still required |
| `QSTASH_CURRENT_SIGNING_KEY`      | Verify current QStash signature      | Internal worker rejects requests                     |
| `QSTASH_NEXT_SIGNING_KEY`         | Rotation-safe signature verification | Internal worker rejects requests                     |
| `AUTH_DATA_ENCRYPTION_KEY_BASE64` | Encrypt subscription secrets         | Subscription persistence unavailable                 |

Generate one VAPID pair with `pnpm --filter @focused/web exec web-push generate-vapid-keys`. Store it in Vercel encrypted environment variables; never regenerate it during a deploy because existing subscriptions depend on the public key.

## QStash production setup

After the production URL and all three QStash values are configured, create one QStash schedule that sends this JSON every minute:

```json
{
  "reason": "schedule",
  "schemaVersion": 1
}
```

Destination: `https://<production-host>/api/internal/notifications/tick`  
Method: `POST`  
Header: `Content-Type: application/json`  
Cron: `* * * * *`

QStash provides the signature header automatically. Never add a bypass token or expose a manually callable cron secret. Set schedule retries to 3 and preserve worker flow-control parallelism at 1. Reminder writes also publish an immediate best-effort wake-up; the periodic schedule is the reconciliation path if that publish fails.

## Operations, observability, and recovery

Monitor claimed, delivered, deferred, and failed occurrence counts; due-occurrence age; invalid/retryable push rates; active subscriptions; delivery-attempt latency; per-member daily cap hits; and QStash signature failures. Alert on a growing due backlog, repeated worker `5xx`, or a sudden rise in invalid subscriptions.

Retryable push failures defer an occurrence for one minute. Permanent failures are recorded; invalid subscriptions are revoked. In-app materialization is idempotent, so operators may safely replay a tick. Reconciliation consists of restoring QStash, then triggering the signed worker until due-occurrence age returns to normal—never editing occurrence rows by hand.

Rollback the app independently of the additive migration. Disable push by removing the VAPID private key, disable immediate publication by removing the QStash token, or remove the schedule. Existing reminders and delivery audit records remain readable. Do not drop tables or revoke member permissions during an application rollback.

After a migration or RBAC incident, load the direct Database URL into the server environment and run `pnpm --filter @focused/web notifications:permissions:verify`. The read-only check fails unless all five Milestone 9 permissions are attached to the `member` role.

## Browser and platform limitations

- Permission must follow an explicit member gesture and may remain denied permanently until browser settings change.
- Web Push requires a secure context in production; localhost is permitted for development.
- Installed iOS/iPadOS web apps may have different permission and delivery behavior from a normal browser tab.
- Operating-system focus modes, battery policies, expired subscriptions, and vendor outages can delay or suppress a push. The in-app inbox remains authoritative.
- Offline mode shows the last private overview only in the current browser tab (`sessionStorage`) and disables mutations; the service worker stores no private API response.

## Testing and acceptance traceability

Unit/property tests cover schedule bounds, DST behavior, quiet hours, safe copy, validation, authorization, idempotent service orchestration, retry behavior, and invalid subscription retirement. Playwright covers responsive rendering, WCAG checks, idempotent reminder creation, unavailable Web Push, and occurrence snooze with optimistic concurrency. OpenAPI lint, Prisma validation, strict TypeScript, ESLint, coverage, production build, and SonarQube remain CI gates.

These controls satisfy the Milestone 9 Reminder, Notification, Web Push, preference, privacy, failure, accessibility, loading, empty, offline, and operational acceptance criteria. AI Smart Reminder is intentionally deferred to its approved future slice.
