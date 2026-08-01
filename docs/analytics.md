# Analytics, Reports, Exports, and Gamification

Milestone 10 implements owner-scoped Focus and Distraction Analytics as a versioned read model. It is a reflection tool, not a score of a person's worth.

## Architecture

```text
Focus / Habit / Goal / Plan records (authoritative)
                    │
                    ▼
       bounded deterministic reconciler
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
 privacy-filtered       daily_metric_snapshots
 metric_events          focused.analytics.v1
          └─────────┬─────────┘
                    ▼
 Analytics REST API → responsive UI / reports / encrypted exports
```

The modular boundary is `apps/web/src/features/analytics`:

- `domain`: metric version, formulas, ranges, and date/time behavior
- `application`: permission checks and Analytics, Report, Export, and Gamification use cases
- `infrastructure`: indexed Prisma reads, deterministic rebuilds, encrypted artifacts, and immutable ledgers
- `transport`: strict Zod contracts and HTTP parsing
- `ui`: Bangla-first accessible presentation with chart/table parity

Source tables remain authoritative. A projection rebuild deletes only the current member's derived metric events inside the requested local-date range and recreates them from authoritative rows. Snapshot writes are upserts, so retries and event replay cannot increment totals twice. Requests accept at most 366 inclusive local dates.

## Metric catalog v1

| Metric                      | Rule                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Focused time                | Sum `completedFocusSeconds` for completed Focus Sessions only                                           |
| Completed sessions          | Count completed Focus Sessions                                                                          |
| Abandoned sessions          | Count abandoned Focus Sessions; excluded from completed-time metrics                                    |
| Plan attainment             | Focused seconds divided by planned seconds for completed sessions, displayed at no more than 100%       |
| Outcome rate                | Completed sessions with a non-empty outcome divided by completed sessions; outcome text is never copied |
| Active focus days           | Days containing at least one completed Focus Session                                                    |
| Self-reported interruptions | Interruptions explicitly recorded by the member, grouped only by category and local hour                |
| Habit completion            | Completed occurrences divided by due, completed, skipped, and excused occurrences                       |
| Goal check-ins              | Count and mean progress value; notes and evidence are excluded                                          |
| Weekly planning             | Count finalized weekly plans by their local period start                                                |

Every response declares `metricVersion`, `computedAt`, `sourceThrough`, formula definitions, and known limitations. Older Goal check-ins created before the Analytics migration did not store a historical timezone; those rows use the current profile timezone and produce `historic_goal_check_in_timezone_fallback`.

## Privacy and product safety

Analytics never copies Focus intent or outcome text, interruption notes, Habit or Goal notes, Journal/Reflection content, AI prompts/outputs, or notification content. Distraction Analytics is based only on deliberate user input; Focused does not monitor applications, browsing, keystrokes, or device activity.

Charts always have a semantically equivalent table. Category and trend meaning never depend on color alone. Correlation views must show sample size and state that a pattern is not causation. There are no public rankings.

Gamification is optional. XP is positive-only, capped per local day, and keyed by metric version plus local date so overlapping report ranges cannot farm XP. Rest, missed habits, faith practices, mood, sleep, and accessibility-related behavior never subtract XP.

## REST API

All endpoints require a short-lived bearer access token and owner-scoped permission:

| Endpoint                            | Permission                                         |
| ----------------------------------- | -------------------------------------------------- |
| `GET /api/v1/analytics`             | `analytics:read:own`                               |
| `POST /api/v1/analytics/rebuild`    | `analytics:write:own`                              |
| `GET/POST /api/v1/reports`          | `reports:read:own` / `reports:write:own`           |
| `GET/POST /api/v1/exports`          | `exports:read:own` / `exports:write:own`           |
| `GET /api/v1/exports/{id}/download` | `exports:read:own`                                 |
| `GET/PATCH /api/v1/gamification`    | `gamification:read:own` / `gamification:write:own` |

The complete machine-readable contract is in `api/openapi.yaml`.

Report and Export creation require a UUID `clientCommandId`. Replaying the same command returns the original resource; reusing it with a different range or format returns `409 Conflict`.

## Export controls

CSV and JSON artifacts are capped at 5 MiB, encrypted with AES-256-GCM using `AUTH_DATA_ENCRYPTION_KEY_BASE64`, owner-scoped, checksum-verified at download, and expire after seven days. The database is the initial controlled artifact store. The repository port permits a later migration to dedicated encrypted object storage without changing the API. Cloudinary is deliberately not used for private analytics exports.

Reports preserve the exact versioned snapshot and expire after 90 days. PDF is represented by the browser's accessible print-ready report in this milestone; server-side PDF generation remains deferred until a vetted renderer and storage lifecycle are selected.

## Operations and recovery

1. Watch structured `Analytics projection served` logs for duration, range size, and freshness; no private values are logged.
2. If a projection is suspected to be wrong, call the owner-scoped rebuild endpoint for the smallest affected range.
3. Rebuilds are deterministic and safe to retry. Compare golden fixtures and aggregate totals before and after a metric-version change.
4. Introduce formula changes under a new metric version. Never rewrite the meaning of `focused.analytics.v1`.
5. Expired export bytes can be purged by a bounded scheduled cleanup job in the deployment operations milestone.

After deploying the migration, load `DIRECT_URL` and run `pnpm db:analytics:verify`. The read-only check verifies the migration ledger, schema objects, metric and level seeds, and all eight member-role permission grants without printing credentials or member data.

## Verification

- Unit golden fixtures cover denominators, rounding, empty data, Dhaka boundaries, leap days, and strict transport schemas.
- Repository integration tests require `TEST_DATABASE_URL` and run against PostgreSQL.
- Playwright covers English/Bangla rendering, mobile access, no horizontal overflow, API filtering, report/export actions, and automated WCAG checks.
- CI runs Prisma validation, formatting, ESLint, strict TypeScript, coverage, OpenAPI lint, production build, Playwright, and SonarQube.
