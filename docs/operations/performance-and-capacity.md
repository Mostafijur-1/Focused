# Performance and capacity operations

Focused scales as a measured modular monolith. PostgreSQL remains authoritative; browser caches, Redis, projections, and queues may accelerate or defer work but may not become the only copy of member state.

## Enforced build budgets

`pnpm analyze:build` reads the production Turbopack client-reference manifests, measures unique route assets with gzip, and writes `apps/web/.next/optimization-report.json`. CI fails when any localized page crosses a versioned threshold in `config/performance-budgets.json`.

| Signal                     | Initial limit | Purpose                                     |
| -------------------------- | ------------: | ------------------------------------------- |
| Route JavaScript, gzip     |       180 KiB | Bound hydration and parse work              |
| Route stylesheet, gzip     |        16 KiB | Bound render-blocking style transfer        |
| Loading-boundary JS, gzip  |        30 KiB | Keep streamed transitions responsive        |
| Service-worker source, raw |        10 KiB | Keep PWA startup logic small and reviewable |

Budgets are ceilings, not targets. Raising one requires a measured user benefit, before/after evidence, and review. Hash changes alone are not evidence; compare bytes and browser/server outcomes from the same toolchain and environment.

## Runtime objectives and measurement

The service objectives and privacy-safe label policy are defined in [observability.md](observability.md). Production dashboards must correlate the release SHA with:

- mobile p75 LCP, INP, and CLS by public/private route class and locale;
- p50/p95/p99 API duration, error ratio, cold starts, and function memory;
- Neon query duration, rows read/returned, connections, compute, and slow plans;
- QStash oldest age, retry count, dead-letter growth, and worker saturation;
- Groq/Gemini latency, normalized failure reason, fallback rate, and tokens—never prompts or responses;
- notification attempts and outcomes without title/body/member-content labels.

Use synthetic accounts and non-production content for load tests. Each result records SHA, deployment, region, dataset size, concurrency or arrival rate, warm-up, duration, percentile distribution, errors, provider limits, and artifact location.

## Scaling triggers

| Trigger observed in a representative window                      | First action                                                      | Escalation condition and next action                                        |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Ordinary read p95 > 300 ms with database time dominant           | Inspect bounded query and `EXPLAIN (ANALYZE, BUFFERS)`            | Proven repeated read pressure: projection/index; then evaluate read replica |
| Ordinary write p95 > 500 ms or connection use > 80%              | Reduce transaction/query work and verify pooled Neon URL/limits   | Sustained after tuning: raise compute/connection capacity with load proof   |
| Queue oldest age > 2x cadence or retry/DLQ growth                | Check provider health, lease contention, batch size, and backoff  | Isolate worker/concurrency only after replay and idempotency tests          |
| Reconstructable hot read consumes material database capacity     | Measure key cardinality, freshness, and invalidation requirements | Add Redis TTL/versioned tenant keys with database fallback                  |
| Analytics/export reads disturb transactional SLOs                | Tighten ranges, pagination, projection, and scheduled execution   | Move replicas/warehouse only when isolation benefit is demonstrated         |
| AI p95/quota/cost exceeds approved model envelope                | Reduce granted context and tune provider routing/timeouts         | Add asynchronous work or provider capacity without storing private prompts  |
| A bounded table/index remains hot at forecast scale after tuning | Review partition key and retention against real access patterns   | Partition only with migration, rollback, and query-plan evidence            |
| Independent workload needs a different runtime/scaling profile   | Document coupling, latency, ownership, and operational cost       | Extract to FastAPI/service only when the boundary benefit exceeds overhead  |

No row-count-only threshold automatically creates a service, cache, replica, or partition. Latency, saturation, failure isolation, and cost evidence must agree.

## PWA and offline policy

The globally registered service worker caches only an explicit public allowlist and provides a locale-matched landing fallback for failed navigations. It does not cache API responses or authenticated pages. Private offline continuity remains feature-owned in scoped browser storage with user identity/version keys and replay-safe commands.

Changing the service-worker cache name is the deployment mechanism for invalidating old public assets. Validate online upgrade, offline locale fallback, notification click-through, storage pressure, and browser compatibility before promotion.

## Optimization workflow

1. Capture a reproducible baseline and identify the user/SLO impact.
2. Change the smallest relevant boundary; do not add infrastructure by default.
3. Run `pnpm quality` and `pnpm test:e2e`.
4. Compare the same measurements and check security, privacy, accessibility, Bangla, reliability, and cost regressions.
5. Attach the generated report and runtime artifacts to the release SHA; revert changes that miss the target.
