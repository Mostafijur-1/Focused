# Launch record

## Current public deployment observation

| Field                                 | Value                                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Observed URL                          | `https://focused-goal.vercel.app/`                                                                                                |
| Observation date                      | 2026-08-01 (Asia/Dhaka)                                                                                                           |
| Public smoke                          | Pass: 29/29                                                                                                                       |
| Covered                               | Root redirect, health/correlation/no-store, Bangla/English metadata, security headers, PWA manifest, robots and localized sitemap |
| Release SHA assertion                 | Not run; current deployed SHA was not independently obtained                                                                      |
| Authenticated canary                  | Pending                                                                                                                           |
| Protected workflow exercise           | Pending                                                                                                                           |
| Production migration/restore exercise | Pending                                                                                                                           |
| Launch approval                       | Not granted                                                                                                                       |

The public site is reachable and its public deployment contract passed. This does not prove Google OAuth/provider secrets, member authorization, database integrity, push delivery, AI provider paths, Admin permissions, monitoring alerts or rollback readiness.

## Release decision template

Record release tag/SHA, deployment URL/ID, schema migration, artifact attestation, Quality Gate and smoke artifacts, Feature Flag state, metrics observation window, approving roles, exceptions with expiry, rollback tag, and the explicit `hold`, `canary`, or `expand` decision.
