# Focused

Focused is a Bangla-first Focus Operating System (FocusOS) designed to help people protect attention, build discipline, work deeply, and make sustainable progress. This repository contains the product requirements, production architecture, REST contract, Prisma data model, design system, and the Next.js implementation.

## Current implementation

Milestones 1 through 7 establish the production, Authentication, PostgreSQL persistence, Dashboard, Habit System, Goals, and authoritative Focus Timer foundations:

- Next.js 16 App Router with React 19 and strict TypeScript
- Server Components by default and narrow Client Component boundaries
- Tailwind CSS 4 with reusable shadcn-style primitives and Focused semantic tokens
- Native-authored `bn-BD` default locale and complete English secondary shell
- Light/dark themes, responsive landing shell, metadata, sitemap, robots, and PWA manifest
- Zod environment/transport validation, stable errors, request correlation, and redacted structured logging
- Versioned `/api/v1/health` Route Handler and OpenAPI 3.1 validation
- Vitest, Testing Library, Playwright, and automated WCAG checks
- GitHub Actions, SonarQube, Docker, and Vercel configuration
- Password registration, native Bangla/English verification and recovery flows
- EdDSA access tokens, opaque rotating refresh tokens, replay-family revocation, and session controls
- Google OAuth Authorization Code with server-owned PKCE, alongside email/password Authentication
- PostgreSQL identity migration, Prisma/Neon runtime adapter, RBAC, audit events, CSRF/origin checks, and distributed rate-limit adapter
- Complete product-data schema with ownership foreign keys, native invariants, partial hot-path indexes, and versioned configuration seed
- Idempotency, transactional outbox helpers, encrypted webhook inbox, leased background jobs, migration drift checks, and PostgreSQL integration tests
- Owner-scoped Dashboard projections with bounded source queries, explicit freshness, partial degradation, and replay-safe invalidation
- A Bangla-first responsive Dashboard with one primary Focus action, widget personalization, offline current-tab fallback, and accessible mobile/tablet/desktop navigation
- A psychologically safe Habit System with immutable schedule versions, local-date occurrences, corrections, pauses, archive/restore, owner privacy, and transactional domain events
- Responsive native Bangla/English habit workflows with strict forms, accessible states, bounded history, and a privacy-minimized Offline check-in queue
- Versioned private Goals with bounded hierarchy, weighted Milestones/Key Results, auditable check-ins, explicit transitions, and optimistic concurrency
- Server-authoritative Deep Work and Pomodoro sessions with pause-aware timing, private presets, interruption capture, offline terminal replay, and transactional events
- Append-only Life Vision revisions and a capacity-aware Weekly Plan that warns without blocking user agency
- Responsive native Bangla/English goal and planning workflows with private offline-read fallback and WCAG-oriented states

Timer, AI, notifications, analytics, and later FocusOS modules remain forward contracts until their approved milestones.

## Architecture

Focused starts as a Clean Architecture modular monolith deployed on Vercel. The web UI and REST adapters share one TypeScript runtime, while dependency rules preserve future extraction seams.

```text
apps/web/src/
├── app/              Next.js routes, layouts, metadata, and Route Handlers
├── components/       Reusable UI, brand, providers, and application shells
├── features/         Feature-owned domain, application, adapters, transport, and UI
├── i18n/             Locale configuration, dictionaries, and formatting
└── lib/              Configuration, errors, HTTP, observability, and utilities
```

Dependency direction:

```text
UI/API → Application → Domain
Infrastructure ───────────┘ (implements Application ports)
```

Domain code cannot import React, Next.js, Prisma, or provider SDKs. ESLint enforces the initial boundary rules.

## Requirements

- Node.js `24.12.0` or compatible Node 24 release
- pnpm `11.18.0` through Corepack
- Git
- Docker Desktop only when using the container workflow

## Local setup

```bash
corepack enable
corepack prepare pnpm@11.18.0 --activate
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

On Windows PowerShell, copy the environment file with:

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
```

Open `http://localhost:3000`; the root redirects to `/bn-BD`. English is available at `/en`. The public health route is `http://localhost:3000/api/v1/health`.

## Environment variables

The complete Authentication variable catalog and key-generation instructions are in [docs/authentication.md](docs/authentication.md). `DATABASE_URL` uses Neon's pooled runtime endpoint; `DIRECT_URL` uses its direct migration endpoint. Never expose a secret with a `NEXT_PUBLIC_` prefix.

## Commands

| Command                  | Purpose                                         |
| ------------------------ | ----------------------------------------------- |
| `pnpm dev`               | Start the web development server                |
| `pnpm build`             | Create the production standalone build          |
| `pnpm start`             | Start a completed production build              |
| `pnpm lint`              | Run zero-warning ESLint checks                  |
| `pnpm typecheck`         | Run strict TypeScript without emitting files    |
| `pnpm test`              | Run unit and component tests                    |
| `pnpm test:coverage`     | Run enforced coverage thresholds                |
| `pnpm test:e2e`          | Run Playwright browser/accessibility tests      |
| `pnpm api:lint`          | Validate the OpenAPI 3.1 contract               |
| `pnpm db:validate`       | Validate the Prisma data model                  |
| `pnpm db:migrate:deploy` | Apply committed migrations safely               |
| `pnpm db:migrate:status` | Verify applied migration state                  |
| `pnpm db:drift:check`    | Detect non-allow-listed schema drift            |
| `pnpm format`            | Verify Prettier formatting                      |
| `pnpm quality`           | Run the complete non-browser local quality gate |

Install Playwright's local Chromium once before the first browser run:

```bash
pnpm --filter @focused/web exec playwright install chromium
```

## Internationalization

- Default locale: `bn-BD`
- Secondary locale: `en`
- Bangla is original product copy, not a machine translation.
- Approved technical terms such as API, Dashboard, Timer, AI, GitHub, LeetCode, Focus Session, Backend, Frontend, Database, Authentication, and Deployment remain English.
- Locale routes set the document language, canonical URL, and alternate language metadata.
- New copy must be added to both typed dictionaries and reviewed for narrow/mobile layouts.

## API documentation

- Human guide: [`api/README.md`](api/README.md)
- OpenAPI contract: [`api/openapi.yaml`](api/openapi.yaml)

The OpenAPI contract describes Focused endpoints. It is unrelated to OpenAI. AI inference will use policy-controlled Groq and Gemini adapters in Milestone 8.

## Testing strategy

- Unit/property tests: Domain policies, validation, errors, locale behavior, and pure utilities
- Component tests: semantics, keyboard activation, states, and reusable UI contracts
- Integration tests: Route Handlers, repositories, providers, and event behavior as milestones add them
- End-to-end tests: Bangla/English, responsive workflows, keyboard, theme, accessibility, and API smoke
- Static quality: strict TypeScript, ESLint architecture rules, Prettier, OpenAPI lint, SonarQube

Tests live under `apps/web/tests` and `apps/web/e2e`. CI uses one Playwright worker for reproducibility.

## GitHub Actions and SonarQube

`.github/workflows/ci.yml` runs formatting, lint, type-check, coverage, API validation, build, browser tests, accessibility tests, and SonarQube scanning.

Configure these repository settings to enable SonarQube:

- Secret: `SONAR_TOKEN`
- Variable: `SONAR_HOST_URL` for self-hosted SonarQube; omit it for SonarQube Cloud
- Project key defaults to `Mostafijur-1_Focused` in `sonar-project.properties`

Branch protection should require the quality and browser jobs. The scan step explains when it is skipped because no token is configured.

## Docker

Build and run the standalone production image:

```bash
docker compose up --build
```

The container runs as a non-root user, exposes port 3000, includes a health check, and contains only traced production output. Docker is an alternative runtime and a reproducibility check; Vercel remains the primary deployment target.

## Vercel deployment

1. Import the GitHub repository into Vercel.
2. Set the Vercel project Root Directory to `apps/web`; the repository `vercel.json` paths are relative to that root.
3. Set `NEXT_PUBLIC_APP_URL` to the production HTTPS URL.
4. Deploy a preview and verify both locales, security headers, metadata, manifest, health, and Playwright smoke tests.
5. Protect production promotion with the GitHub quality gate.

The application uses standalone output for Docker while remaining fully compatible with Vercel's native Next.js deployment.

## Security baseline

- Server-only typed environment parsing
- Stable safe API errors and request correlation
- Report-only CSP during foundation development, plus frame, MIME, referrer, and permissions headers
- No client persistence for future access tokens
- No private content in logs, analytics, errors, notifications, or AI traces
- Dependabot for npm and GitHub Actions

Authentication controls, provider setup, incident actions, and the threat model are documented in [docs/authentication.md](docs/authentication.md) and [docs/security/authentication-threat-model.md](docs/security/authentication-threat-model.md).

The CSP remains report-only until production telemetry proves all required sources and a nonce strategy is integrated. It must not be promoted to enforcement by copying unsafe assumptions.

## Documentation

- [Software Requirements Specification](docs/Focused_Software_Requirements_Specification.md)
- [Production Architecture](docs/Focused_Production_Architecture.md)
- [UI/UX Design System](docs/Focused_UI_UX_Design_System.md)
- [Implementation Roadmap](docs/Focused_Implementation_Roadmap.md)
- [Database Foundation](docs/database.md)
- [Dashboard Architecture and Operations](docs/dashboard.md)
- [Habit System Architecture and Operations](docs/habits.md)
- [Goals, Life Vision, and Weekly Planning](docs/goals.md)
- [Focus Timer and Pomodoro](docs/focus-timer.md)

## Contribution workflow

1. Work in one feature-owned vertical slice.
2. Update UI, API contract, validation, authorization, persistence, telemetry, tests, and documentation together where relevant.
3. Run `pnpm quality` and the relevant Playwright tests.
4. Never commit secrets, production data, local `.env` files, generated coverage, or QA render caches.
5. Require review for architecture boundaries, privacy-sensitive flows, migrations, provider changes, and privileged operations.

## License

Proprietary. All rights reserved.
