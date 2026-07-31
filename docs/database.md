# Focused Database Foundation

## Purpose

Milestone 3 establishes PostgreSQL as Focused's authoritative transactional store. It contains identity, plans, goals, Focus Sessions, habits, generic trackers, private documents, AI run metadata, reminders, notifications, gamification, analytics events, durable work records, and system configuration. Feature behavior remains owned by its later milestone; this foundation defines persistence boundaries and invariants without exposing premature APIs.

Prisma is an Infrastructure adapter. Prisma records must not become Domain entities or REST response contracts. Feature repositories always receive an authenticated actor scope, apply ownership predicates in the query, and map records to Domain types.

## Runtime topology

```text
Next.js Route/Server Action
          |
Application use case
          |
Feature repository port
          |
Prisma repository adapter
          |
Neon pooled DATABASE_URL ----> PostgreSQL

CI / release migration ---- DIRECT_URL ----> PostgreSQL
                                |
                         isolated shadow DB
```

- `DATABASE_URL` is Neon's pooled endpoint and is used only by the runtime Prisma adapter.
- `DIRECT_URL` is the direct endpoint used by Prisma CLI migration commands.
- `SHADOW_DATABASE_URL` is an isolated disposable database used only for migration drift validation.
- The application never runs migrations during startup or a Vercel request.
- Network calls are never made while a database transaction is open.

## Schema and ownership

The canonical model is [`prisma/schema.prisma`](../prisma/schema.prisma). The first migration is the immutable Authentication baseline; Milestone 3 is an additive migration. Every private aggregate root stores `userId`. Child rows inherit ownership through required foreign keys, and hot cross-aggregate worker rows carry direct ownership only where deletion, authorization, or indexing needs it.

Key conventions:

| Concern           | Convention                                                                           |
| ----------------- | ------------------------------------------------------------------------------------ |
| Identifier        | PostgreSQL UUID, generated server-side                                               |
| Instant           | UTC `timestamptz(6)`                                                                 |
| User-local day    | PostgreSQL `date` plus an IANA time zone on the owning policy/event                  |
| Mutable aggregate | `version`, `createdAt`, and `updatedAt`                                              |
| Private deletion  | Soft delete only for recovery/synchronization; otherwise explicit cascading deletion |
| Flexible metadata | Bounded, versioned JSON; never a replacement for frequently queried typed fields     |
| Quantity          | Integer duration or fixed-precision `Decimal`, never binary floating point           |
| Secrets/payloads  | Hash high-entropy tokens; encrypt webhook bodies before persistence                  |

Database foreign keys provide structural ownership. Application repositories remain the authorization boundary. PostgreSQL Row Level Security is intentionally deferred because a pooled serverless connection cannot safely rely on persistent session identity. It may be added later with transaction-local identity after operational testing.

## Native PostgreSQL invariants

Some guarantees cannot be represented in Prisma schema syntax and therefore live in the migration:

- one `RUNNING` or `PAUSED` Focus Session per user;
- valid time ranges and terminal Focus Session timestamps;
- positive bounded attempts, versions, and payload sizes;
- internally consistent idempotency and webhook lifecycle states;
- mutually exclusive published/dead-letter outbox states;
- partial due/ready indexes for reminders, outbox, webhook inbox, and background jobs.

The drift checker allow-lists these named native objects and fails for every other migration/schema difference.

## Transactions, idempotency, and durable work

Feature repository mutations use short transactions. When a mutation must publish an event, the repository calls `appendOutboxEvent(transaction, event)` using the same Prisma transaction that changes the aggregate. Publishing happens after commit.

Idempotent commands use `(userId, route, key)` plus a SHA-256 request hash. Equal requests replay the stored stable response; a reused key with a different hash is a conflict; an unfinished reservation reports in-progress. Responses must be small and contain no secrets.

Outbox, encrypted webhook inbox, and background-job workers claim bounded batches using `FOR UPDATE SKIP LOCKED`. Each claim records a worker ID and lease time. Completion is fenced by the worker ID, so a stale worker cannot acknowledge a newly leased item. Retry schedules use bounded exponential backoff with jitter at the Application layer; permanent failures move to a dead-letter state.

Delivery is at least once. Consumers therefore require their own deduplication key or inbox record. Exactly-once delivery across a database and an external provider is not promised.

## Seed policy

Migrations seed only versioned system configuration: initial level definitions, metric definitions, and disabled feature flags. They never create users, activity, journal content, or other production-like personal data. Test fixtures use unique IDs and are deleted by integration tests.

## Migration workflow

Create migrations against a disposable development database, inspect the SQL, and commit it with the schema change:

```bash
pnpm db:validate
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm db:drift:check
```

Production uses expand/contract changes:

1. Expand with nullable columns, new tables, or compatible indexes.
2. Deploy code that can read old and new shapes.
3. Backfill in resumable bounded batches outside request paths.
4. Switch reads after verification.
5. Contract only in a later reviewed release.

Never edit an applied migration. A failed forward-only data change gets a new corrective migration. Before destructive DDL, record the Neon restore point, estimate lock duration on production-like volume, verify dependent code, and provide a tested roll-forward plan. Point-in-time restore protects disasters but is not a substitute for a compatible migration.

## Query budgets and growth thresholds

All member lists use cursor pagination with a deterministic `(timestamp, id)` order. Request-path queries should normally remain below 50 ms at p95 in the database and scan no more than 10 times the returned rows. Worker claims are capped at 100 rows and must use a ready/partial index. CI verifies critical uniqueness and inspects a hot Focus Session query plan.

Do not partition prematurely. Review monthly range partitioning for `audit_events`, `metric_events`, `delivery_attempts`, `outbox_events`, or `tracker_entries` when any of these becomes true:

- a table exceeds roughly 50 million live rows or an active index exceeds memory budget;
- routine vacuum cannot keep dead tuples below 10%;
- retention deletion repeatedly exceeds the maintenance window;
- measured p95 queries miss budget after query and index tuning.

Introduce Redis only for ephemeral rate limits, short-lived cache entries, presence, or coordination that can be rebuilt. PostgreSQL remains authoritative. Cache keys include user and data version, use bounded TTLs, and never cache private bodies without an explicit encrypted-data design.

## Retention, privacy, and operations

- Webhook encrypted bodies: delete after successful processing and the provider replay window; default target 30 days.
- Completed idempotency records: default 24 hours unless an endpoint documents a longer retry window.
- Published outbox events: default 7 days after relay verification.
- Failed/dead-letter work: default 30 days after incident resolution.
- Export assets: expire from Cloudinary and the database on the recorded expiry.
- Audit and consent evidence: follow the approved legal retention policy; metadata must remain redacted.

Retention jobs are idempotent, bounded, observable, and respect legal holds. User deletion traverses an explicit dependency inventory and verifies that private content, provider assets, and caches are removed. Backups and restore drills must be encrypted, access-controlled, and tested at least quarterly before production maturity.

## CI verification

The `database-foundation` GitHub Actions job starts PostgreSQL 16, creates an isolated shadow database, applies all migrations from an empty database, verifies migration status and allow-listed drift, then runs Authentication and durable-work integration tests. Tests cover idempotency replay/conflict, webhook deduplication, leased worker claims, stale-worker fencing, job retry/completion, active Focus Session uniqueness, and a hot query plan.
