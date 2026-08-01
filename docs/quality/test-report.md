# Integrated test report

## Scope and verdict

Milestone 12 currently has a passing local automated slice, but the integrated release report is **not signed**. Production-like database, complete browser, manual accessibility, native Bangla, security, performance, and recovery evidence must be attached before closure.

## Latest verified local run

Date: 2026-08-01 (Asia/Dhaka)

Environment: Windows, Node.js 24.12.0, pnpm 11.18.0, Next.js 16.2.12, Playwright Chromium desktop and Pixel 7 profiles.

| Gate                                           | Result                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Prettier                                       | Pass                                                                                                |
| ESLint (`--max-warnings=0`)                    | Pass                                                                                                |
| Strict TypeScript                              | Pass                                                                                                |
| Vitest unit/component/contract suite           | Pass; 189 passed, 19 PostgreSQL integration cases skipped without the isolated database environment |
| Enforced coverage                              | Pass; statements 84.67%, branches 76.40%, functions 86.59%, lines 87.23%                            |
| OpenAPI lint                                   | Pass; no warnings                                                                                   |
| REST implementation/OpenAPI method-path parity | Pass                                                                                                |
| Production build                               | Pass; 41 static pages generated and all Route Handlers compiled                                     |
| Complete Playwright browser suite              | Pass; 52/52 across Chromium desktop and mobile profiles                                             |

CI emits `vitest-junit.xml`, `playwright-junit.xml`, coverage, Playwright HTML/trace artifacts, and this evidence directory. Exact CI totals are authoritative for a commit; narrative counts here are supporting context only.

## Required before sign-off

- Run the full PostgreSQL migration/repository suite against an isolated production-like database.
- Repeat the complete Playwright suite on the final release commit and investigate every retry/flaky result.
- Complete the manual/external activities linked from the quality index.
- Record approver, date, release SHA, environment, exceptions, and residual risk.

Sign-off: **Pending**
