# Milestone 14 optimization report

## Outcome

The repository optimization gate is implemented and passing. The optimized production build covers 14 localized routes; the largest route is 134,573 bytes gzip of JavaScript against a 184,320-byte ceiling. Production RUM, representative load/soak, provider cost, and real-device review remain external evidence requirements and are not represented as complete.

## Controlled before/after evidence

Baseline: commit `a67868e`, Node 24/pnpm 11 production build on the same Windows workspace. Optimized result: the Milestone 14 working tree using the same build command and analyzer. The loading metric includes the locale layout plus the route loading entry.

| Path/metric                  | Before gzip | After gzip |          Change |
| ---------------------------- | ----------: | ---------: | --------------: |
| Dashboard loading JavaScript |   101,224 B |   14,440 B |          -85.7% |
| Habit loading JavaScript     |   101,786 B |    2,552 B |          -97.5% |
| Dashboard route JavaScript   |   154,441 B |  134,573 B |          -12.9% |
| Largest stylesheet           |           — |   11,294 B | 68.9% of budget |
| Service-worker source (raw)  |     1,623 B |    3,217 B | 31.4% of budget |

The two loading boundaries previously imported full interactive workspaces, including React Hook Form and Zod. Dedicated skeleton modules remove that work from the streamed loading path. The service worker grew intentionally to add public-only offline navigation and version cleanup; its size remains bounded.

## Route budget result

`pnpm analyze:build` writes the complete machine-readable artifact. Current notable results:

| Route class               | JavaScript gzip | Loading JS gzip | CSS gzip |
| ------------------------- | --------------: | --------------: | -------: |
| Public landing            |        36,764 B |         2,552 B | 11,294 B |
| Dashboard (largest route) |       134,573 B |        14,440 B | 11,294 B |
| Habits                    |       131,490 B |         2,552 B | 11,294 B |
| Security                  |        48,512 B |         2,552 B | 11,294 B |

All 14 routes pass the checked budgets. CI runs the analyzer only after a successful production build and uploads `optimization-report.json` as release evidence.

## PWA, SEO, accessibility, and privacy

- Production pages globally register the service worker with update-cache bypass.
- The worker caches only `/bn-BD`, `/en`, `/icon.svg`, and `/manifest.webmanifest`; API and authenticated responses are excluded.
- The manifest now has root scope, design-system theme color, and native Bangla Focus/Dashboard shortcuts.
- Landing pages expose locale-specific `WebApplication` JSON-LD with injection-safe serialization; canonical, alternate locale, sitemap, robots, headings, and private-page `noindex` behavior remain in place.
- Playwright verifies structured metadata, the manifest, an offline English landing fallback, keyboard/mobile behavior, and automated WCAG rules.

No Prisma query, index, Redis cache, QStash concurrency, or AI routing change was made. The available repository evidence did not prove a runtime bottleneck, and speculative changes would add consistency, privacy, or operating risk.

## Prioritized next evidence

1. **P0 — production visibility:** enable privacy-safe Vercel/Neon/QStash/provider dashboards and RUM, annotated by release SHA.
2. **P0 — representative capacity:** run authenticated staging load/soak and recovery tests with production-shaped synthetic data.
3. **P1 — client interaction:** use RUM/long-task evidence to decide whether large feature forms should load as later interactive islands.
4. **P1 — database hot paths:** tune queries/indexes only from slow-query samples and reviewed plans.
5. **P2 — infrastructure expansion:** evaluate Redis, replicas, warehouse, partitions, or service extraction only at the documented triggers.

Repository optimization gate: **Passing.** Production performance/cost and manual native Bangla/accessibility sign-off: **Pending external evidence.**
