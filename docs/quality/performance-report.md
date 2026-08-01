# Performance and scale assessment

## Existing evidence

- The Next.js production build succeeds with static generation for locale pages and dynamic server execution for private APIs.
- Repository tests inspect selected hot-query plans and domain reads are bounded by explicit limits.
- Timer UI tests use server-authoritative timestamps and do not wait in real time.
- Analytics reads are capped to 366 days and expensive rebuild/export/notification work uses asynchronous boundaries.

## Required measurements

No production-like load or soak result has been recorded yet. The release candidate still requires:

- Mobile p75 LCP/INP/CLS for landing and authenticated shells.
- p95/p99 latency and error rate for Authentication, Dashboard, Focus, habits, reminders, analytics and exports.
- Timer start acknowledgement and reconciliation measurements.
- Notification burst, reminder expansion, export, analytics rebuild and AI quota tests.
- Database connection-pool, queue-lag, Redis-loss and Neon-latency observations.
- Sustained soak and recovery after saturation using synthetic, non-production data.

Each run must record commit SHA, deployment, dataset, concurrency/rate model, warm-up, duration, percentile distribution, error budget, infrastructure limits and raw artifact location.

Performance sign-off: **Pending production-like staging evidence.**
