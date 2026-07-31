SOFTWARE REQUIREMENTS SPECIFICATION

# Focused

_A complete Focus Operating System (FocusOS)_

**Document ID.** FOCUSED-SRS-001

**Version.** 1.0 Baseline Candidate

**Status.** Proposed - requires product, engineering, security, privacy, accessibility, and domain review

**Date.** 31 July 2026

**Standard alignment.** IEEE-style structure adapted to ISO/IEC/IEEE 29148:2018; uniquely identified, verifiable 'shall' requirements

**Intended audience.** Product, design, engineering, QA, AI safety, security, privacy, accessibility, operations, and executive stakeholders

Focused is not a habit tracker with extra modules. It is a personal operating system for choosing what matters, protecting attention, executing deliberately, learning from evidence, and improving sustainably with an AI coach that remains under the user's control.

---

# Document Control

| Version | Date         | Status            | Summary                                                                                           |
| ------- | ------------ | ----------------- | ------------------------------------------------------------------------------------------------- |
| 0.1     | 31 July 2026 | Draft             | Initial complete SRS covering product, functional, quality, safety, and operational requirements. |
| 1.0     | TBD          | Approved baseline | Requires sign-off and resolution of open product/legal decisions.                                 |

**Approval rule.** A requirement becomes Baseline only after named product and engineering approvers accept it; security/privacy/accessibility requirements also require their accountable reviewers.

**Change control.** After baseline, material requirement changes use a traceable proposal stating rationale, affected IDs, migration/compatibility impact, risk, acceptance-test changes, and approval.

**Requirement states.** Proposed, Baseline, Implemented, Verified, Deferred, Deprecated, Rejected. 'Deferred' never means silently omitted.

## Contents

- 1. Introduction and Conventions
- 2. Vision and Product Goals
- 3. Stakeholders and User Personas
- 4. Product Scope and Overall Description
- 5. System Context, Interfaces, Data, and Architecture Constraints
- 6. Functional Requirements and Feature Acceptance Criteria
- 7. User Stories
- 8. Use Cases
- 9. Business Rules
- 10. Non-functional Requirements
- 11. Permission Matrix
- 12. Feature Priorities and Release Strategy
- 13. Success Metrics
- 14. Risks and Mitigations
- 15. Future Scope
- Appendix A. Traceability
- Appendix B. Glossary and Open Decisions

# 1. Introduction and Conventions

## 1.1 Purpose

This Software Requirements Specification defines the externally observable behavior, quality attributes, constraints, safety boundaries, and acceptance basis for Focused. It is intentionally technology-aware but implementation-neutral: architecture choices may evolve if they continue to satisfy every applicable requirement and business rule.

## 1.2 Normative Language

- Shall denotes a mandatory, testable requirement for the stated scope.
- Should denotes a recommended decision that may be changed through an explicit trade-off record.
- May denotes a permitted option. Must not denotes a prohibited behavior.
- Given/When/Then criteria are acceptance examples, not substitutes for negative, boundary, accessibility, security, and performance testing.

## 1.3 Reference Model

The organization follows the requirements-engineering intent of ISO/IEC/IEEE 29148:2018, which is currently an active IEEE standard; a successor project is in progress. This SRS does not reproduce the standard. It applies its principles of necessary, implementation-feasible, unambiguous, singular, verifiable, traceable, and maintainable requirements.

- IEEE/ISO/IEC 29148-2018: https://standards.ieee.org/ieee/802.1Q/6937/
- ISO record for ISO/IEC/IEEE 29148:2018: https://www.iso.org/standard/72089.html
- IETF RFC 9457, Problem Details for HTTP APIs: https://www.rfc-editor.org/rfc/rfc9457
- W3C Web Content Accessibility Guidelines (WCAG) 2.2: https://www.w3.org/TR/WCAG22/

## 1.4 Scope of this Baseline

The baseline specifies 57 named capabilities, including every feature requested by the sponsor plus the foundational authentication, onboarding, unified-search, privacy, and operating requirements required to make them production-ready.

## 1.5 Assumptions

- The initial product is a personal workspace: one member owns each personal object. Team collaboration requires a separate sharing/tenancy requirements phase.
- Core planning and tracking work without AI. AI is optional, provider-neutral, consent-based, and can propose but not silently perform material mutations.
- No paid/free subscription entitlements are assumed. Priority and access are product/release concerns, not hidden monetization rules.
- The web application is the first client and is deployable on Vercel; durable queues/workers or data services may run on compatible managed infrastructure where serverless execution limits require it.
- Future mobile applications consume the same versioned REST domain APIs and standards-based authentication; business rules are not embedded only in the web client.
- Third-party integrations use authorized APIs, licensed feeds, or user-supplied files. Protected-page scraping and third-party password collection are prohibited.
- Prayer calculation and Quran reference behavior are configurable and source-disclosed. The product is a tracking aid, not a religious authority.
- Mood, sleep, workout, and related insights are self-improvement aids and not medical devices, diagnosis, treatment, or emergency services.

## 1.6 Explicit Exclusions for Initial Releases

- Public social network, public leaderboards, competitive prayer/Quran/mood/sleep ranking, wagering, or monetary gamification.
- Autonomous AI writes without review, unrestricted agents, purchases, external communication, or agents that can expand their own permissions.
- Employer/school surveillance, covert app/keystroke/browser/microphone/camera monitoring, or productivity scoring for eligibility decisions.
- Clinical diagnosis, treatment, emergency response, religious rulings, legal advice, or financial advice.
- Team/enterprise tenancy, billing plans, marketplace commerce, and human-coach access until separately specified.

---

# 2. Vision and Product Goals

## 2.1 Vision

Focused gives each person a calm, private, and adaptive FocusOS: a place to define a meaningful direction, convert it into realistic commitments, protect attention, execute deep work, observe friction without judgment, and continuously improve with evidence. AI behaves like a trustworthy coach available at any time—not an authority, surveillance system, or engagement engine.

## 2.2 Product Principles

- Focus before features: the next meaningful action is visually dominant; secondary modules remain progressively disclosed.
- Agency before automation: the member understands and confirms material changes.
- Psychological safety before streak preservation: recovery, rest, and changed capacity are legitimate states.
- Evidence before claims: analytics and AI disclose source, freshness, definition, uncertainty, and missing data.
- Privacy before personalization: optional sensitive context stays excluded until purpose-specific consent is granted.
- Accessible by construction: keyboard, assistive technology, reflow, contrast, reduced motion, localization, and theme behavior are acceptance requirements.
- Simple domain contracts: clear ownership, REST resources, idempotency, versioning, and explicit state machines enable scale and future clients.

## 2.3 Product Goals

| ID    | Goal                            | Measurable intent                                                                                                      |
| ----- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| PG-01 | Reduce activation energy        | A member can identify and start the next meaningful action in under two minutes from opening the product.              |
| PG-02 | Strengthen intentional focus    | Planning, timers, environment cues, and reflection form one low-friction execution loop.                               |
| PG-03 | Build sustainable discipline    | Consistency mechanisms support recovery and autonomy rather than shame, compulsion, or surveillance.                   |
| PG-04 | Connect horizons                | Life vision, yearly/monthly/weekly planning, goals, and daily focus remain traceably connected.                        |
| PG-05 | Make progress legible           | Members can understand outcomes, time, interruptions, learning, and selected wellbeing signals using defined metrics.  |
| PG-06 | Provide trustworthy AI guidance | AI is contextual, explainable, consent-based, provider-neutral, and unable to mutate user state without approval.      |
| PG-07 | Protect the private self        | Journal, mood, faith, sleep, health-adjacent, and coaching data receive strict purpose limitation and least privilege. |
| PG-08 | Be calm and inclusive           | The experience is responsive, accessible, localized, theme-aware, and intentionally low-noise.                         |
| PG-09 | Enable durable portability      | REST contracts, data export, modular domains, and event semantics support future mobile clients and provider changes.  |
| PG-10 | Operate at global scale         | The platform is observable, secure, horizontally scalable, deployment-ready, and governed by automated quality gates.  |

---

# 3. Stakeholders and User Personas

## 3.1 Stakeholders

- Primary: members using Focused to plan, focus, learn, reflect, and track selected domains.
- Operational: support administrators, platform administrators, content curators, auditors, incident responders, and SRE/DevOps.
- Delivery: product, design, web/mobile/backend/data/AI engineering, quality, security, privacy, accessibility, localization, and technical writing.
- External: identity, AI, notification, calendar, news/content, storage, analytics, and hosting providers governed by contracts and adapters.

## 3.2 Personas

| ID   | Persona                                | Goals and context                                                                                                                 | Primary risks                                                                                 |
| ---- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| P-01 | Intentional knowledge worker           | Balances meetings and project work; needs a clear daily commitment, protected focus blocks, and low-noise reminders.              | Dashboard overload, notification fatigue, and calendar conflict.                              |
| P-02 | University learner                     | Plans classes and self-study; tracks reading, practice, learning paths, habits, and reflection across irregular weeks.            | Punitive streaks, unrealistic schedules, and mobile/offline gaps.                             |
| P-03 | Software engineer preparing for growth | Combines deep work, programming projects, LeetCode practice, technology resources, and an AI mentor.                              | Metric gaming, private repository exposure, and generic recommendations.                      |
| P-04 | Founder or independent professional    | Needs goals, yearly-to-daily alignment, smart scheduling, progress reports, and fast reprioritization.                            | Overplanning, AI overreach, and confidential calendar or note leakage.                        |
| P-05 | Faith-integrated planner               | Optionally coordinates prayer and Quran routines with work and wellbeing while expecting respectful configurability.              | Religious judgment, location exposure, incorrect assumptions, and gamification of worship.    |
| P-06 | Member rebuilding routines             | Uses sleep, mood, workout, habits, and journal features to notice patterns and recover gradually.                                 | Medical claims, shame, obsessive tracking, and sensitive-data misuse.                         |
| P-07 | Accessibility-first member             | Uses keyboard, screen reader, zoom, high contrast, reduced motion, or alternative notification modalities.                        | Timer inaccessibility, focus loss, motion, color-only status, and cramped responsive layouts. |
| P-08 | Support or platform operator           | Resolves account/operational issues, manages safe configuration, and investigates audit evidence without reading private content. | Excess privilege, unaudited actions, accidental disclosure, and unsafe bulk operations.       |

---

# 4. Product Scope and Overall Description

## 4.1 Product Perspective

Focused is a modular personal productivity platform whose core loop is Direction -> Plan -> Focus -> Observe -> Reflect -> Adapt. Feature domains share identity, authorization, time, notification, search, analytics, AI orchestration, audit, and export platform capabilities without sharing private data implicitly.

## 4.2 Core Product Loop

1. Direction: articulate life vision, values, goals, annual themes, and desired evidence.
1. Plan: select realistic monthly, weekly, and daily outcomes around calendar constraints and capacity.
1. Focus: execute with deep-work or Pomodoro timers, a visible intent, and optional distraction controls.
1. Observe: record outcomes, interruptions, habits, learning, and selected wellbeing/faith signals.
1. Reflect: conduct human-authored or AI-assisted reviews that link observations to evidence.
1. Adapt: confirm a small experiment, schedule change, goal revision, or reminder—and begin again.

## 4.3 Domain Boundaries

| Domain                      | Responsibilities                                                                         | Owns                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Identity and Preferences    | Authentication, sessions, profile, locale, consent, accessibility, notification settings | User, Session, Consent, Preference                          |
| Planning                    | Vision, goals, yearly/monthly/weekly/daily plans, calendar, scheduling                   | Plan, Goal, Milestone, TimeBlock                            |
| Focus                       | Deep work, Pomodoro, intent, interruption capture                                        | FocusSession, Cycle, Interruption                           |
| Tracking                    | Habits, learning, programming, reading, faith, workout, sleep, mood                      | Typed tracker definitions and entries                       |
| Reflection and Knowledge    | Journal, reflection, notes, bookmarks, resources, search                                 | Private documents, links, indexes                           |
| AI Guidance                 | Context grants, conversations, reviews, suggestions, proposals                           | AI run/review artifacts; never source-of-truth domain state |
| Analytics and Reports       | Definitions, aggregates, snapshots, exports                                              | Metric definitions, snapshots, export jobs                  |
| Engagement and Gamification | Reminders, notifications, achievements, XP, levels, streaks, challenges                  | Occurrence/delivery/reward ledgers                          |
| Administration              | Operational roles, configuration, audit, safe support workflows                          | Admin policy/configuration and audit events                 |

## 4.4 Operating Environment

- Responsive standards-based web application with installable PWA behavior on supported evergreen browsers.
- REST API under a versioned base path such as /api/v1, independently consumable by future native clients.
- Managed relational transactional storage; object storage for attachments/exports; cache and durable job/queue infrastructure; search/index capability; analytics store when scale requires separation.
- Vercel-compatible web deployment with environment-separated managed backend dependencies and asynchronous workers where execution duration/durability demands them.

---

# 5. System Context, Interfaces, Data, and Architecture Constraints

## 5.1 Logical Architecture

The recommended starting architecture is a modular monolith with explicit feature/domain modules, a separate durable worker process, and event-driven integration at domain boundaries. This minimizes premature distributed complexity while preserving extraction seams. A module owns its domain model, application use cases, REST contract, persistence adapter, authorization policy, events, UI feature slice, and tests. Dependencies point inward toward domain/application contracts; infrastructure adapters implement those contracts.

- Presentation: responsive web/PWA, route metadata, accessible design system, local cache, sync coordinator, generated API client.
- Application: use cases, commands/queries, validation, authorization orchestration, idempotency, transactions, domain-event publication.
- Domain: entities, value objects, invariants, policies, state machines, calculation definitions; no framework or transport dependency.
- Infrastructure: relational repositories, object storage, cache, queue, search, calendar/news/AI/notification adapters, observability.
- Extraction rule: create a service only when independent scaling, data isolation, reliability, ownership, or deployment evidence outweighs distributed-system cost.

## 5.2 REST API Conventions

- Resource-oriented nouns; standard HTTP methods/status codes; JSON over TLS; UTC instants plus IANA time-zone context.
- Cursor pagination for unbounded collections; explicit sort/filter fields; bounded limits; sparse/expansion semantics only when documented.
- RFC 9457-compatible problem details with stable error code, status, human message, field errors, correlation ID, and safe remediation hints.
- Idempotency-Key or client mutation ID for retryable creates/commands; optimistic concurrency through ETag/If-Match or explicit version.
- OpenAPI contract generated and validated in CI, with security schemes, schemas, examples, errors, deprecations, and changelog.
- No business rule relies exclusively on hidden client behavior. Authorization and validation are repeated at the trusted server boundary.

## 5.3 External Interfaces

| Interface               | Minimum contract                                                                                | Failure/degradation                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Identity provider       | OIDC/OAuth where federated; verified subjects; secure callback/state/nonce; revocation          | Local session controls and safe retry; no account enumeration          |
| AI provider(s)          | Streaming/chat/structured output/embeddings behind provider-neutral adapters; data-use controls | Cancel, retry, alternate model, deterministic non-AI workflow          |
| Calendar provider       | OAuth scopes, incremental sync, free/busy, event write, webhook verification                    | Read-only/stale disclosure, manual planning, retry queue               |
| Push/email              | Consent, locale template, endpoint lifecycle, acknowledgement, bounce/expiry feedback           | In-app center and retry policy; no unapproved fallback                 |
| News/resources          | Licensed/publicly permitted feed or API, canonical URL, source/freshness/licensing metadata     | Empty/source-unavailable state; cached provenance                      |
| Learning/coding imports | User file or authorized integration with preview, schema, provenance, reversal                  | Partial result and retry; no scraping or password capture              |
| Observability/security  | Metrics, traces, logs, alerting, error tracking, audit sink, vulnerability/secret scanning      | Privacy-safe buffering and fail-closed policy for critical admin audit |

## 5.4 Data Classification

| Class                    | Examples                                                                               | Controls                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Restricted               | Credentials, tokens, recovery secrets, encryption keys                                 | Dedicated secret/token controls; never logs/analytics/AI                               |
| Highly sensitive private | Journal, mood notes, life vision, prayer/Quran logs, sleep/body data, AI conversations | Private default, strict scopes, no routine admin content, explicit AI/report inclusion |
| Private productivity     | Goals, plans, tasks, focus sessions, habits, learning, notes, bookmarks                | Owner isolation, purpose limitation, controlled export/search/AI scopes                |
| Operational personal     | Email, profile, sessions, locale, notification endpoint                                | Minimization, encryption, role-limited support metadata                                |
| Platform operational     | Audit events, system metrics, feature flags, curated source config                     | Role separation, tamper resistance, retention, redaction                               |
| Public                   | Marketing/help content and explicitly public catalog metadata                          | Integrity, provenance, SEO, accessibility, content safety                              |

## 5.5 Common UI State Contract

Every feature is subject to the following acceptance contract in addition to its feature-specific criteria.

| ID          | State/concern     | Acceptance contract                                                                                                                                                     |
| ----------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-CROSS-01 | Loading           | Show a non-blocking skeleton or progress indicator that preserves layout and exposes an accessible status; prevent duplicate submission while a mutation is unresolved. |
| AC-CROSS-02 | Empty             | Explain why no data exists, what value the feature provides, and one safe primary action; absence is never rendered as zero success or failure.                         |
| AC-CROSS-03 | Error             | Preserve valid input, show an actionable non-sensitive error with correlation ID where useful, and offer retry/cancel/support as appropriate.                           |
| AC-CROSS-04 | Partial/stale     | Label stale or partially unavailable data, its as-of time, and excluded sources; never silently substitute zero or fabricated content.                                  |
| AC-CROSS-05 | Offline           | Expose offline state and last sync. Queue only documented low-risk idempotent writes; otherwise offer read-only or local draft behavior.                                |
| AC-CROSS-06 | Authorization     | Forbidden and not-found behavior does not reveal existence. Ownership/role/consent is enforced by the API, not only hidden in UI.                                       |
| AC-CROSS-07 | Accessibility     | Keyboard, screen reader, zoom/reflow, contrast, focus, reduced motion, and non-color/non-audio alternatives pass the defined critical workflow tests.                   |
| AC-CROSS-08 | Responsive/theme  | The workflow remains complete on supported small/large viewports in light, dark, and system themes with no hidden essential action.                                     |
| AC-CROSS-09 | Telemetry/privacy | Product and technical events use documented schemas, avoid private content, honor consent, and carry correlation without uncontrolled high-cardinality fields.          |
| AC-CROSS-10 | Testing           | Unit, API/contract, authorization, persistence, UI, accessibility, edge, and relevant end-to-end tests pass before the feature is considered verified.                  |

---

# 6. Functional Requirements and Feature Acceptance Criteria

Feature IDs and requirement IDs are stable traceability keys. Each feature definition covers purpose, actors, architecture/data ownership, REST surface, functional requirements, validation/edge/privacy constraints, and detailed acceptance criteria. Shared platform behavior in Section 5.5 applies to every feature.

## 6.1 Foundation

### 6.1.1 Authentication and Account Security [AUTH]

**Purpose.** Establish a secure, portable identity and session boundary for web and future mobile clients.

**Actors.** Visitor, Member, Administrator

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns User, Identity, Session, Credential, RecoveryToken, Consent. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /auth/*; /users/me/sessions; /users/me/consents

**Validation.** Normalized unique email or provider subject; password policy where passwords are enabled; expiring single-use tokens; CSRF and replay protection.

**Edge cases.** Duplicate identities, expired links, locked accounts, provider outage, stolen refresh token, clock skew, and deletion-pending accounts must fail safely.

**Security and privacy.** Credentials are never logged; tokens are hashed or encrypted as appropriate; security events are auditable; MFA is required for privileged roles.

Functional requirements

- FR-AUTH-001 - The system shall enable an authorized actor to register and verify an account using an approved identity flow.
- FR-AUTH-002 - The system shall enable an authorized actor to sign in, refresh, revoke, and enumerate active sessions without exposing credentials.
- FR-AUTH-003 - The system shall enable an authorized actor to recover account access and enforce step-up authentication for sensitive operations.
  Acceptance criteria

- AC-AUTH-01 - Given an authorized actor and valid input, when the actor requests to register and verify an account using an approved identity flow, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-AUTH-02 - Given the feature's prerequisite state, when the actor requests to sign in, refresh, revoke, and enumerate active sessions without exposing credentials, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-AUTH-03 - Given any required supporting data or integration is available, when the actor requests to recover account access and enforce step-up authentication for sensitive operations, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-AUTH-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Normalized unique email or provider subject; password policy where passwords are enabled; expiring single-use tokens; CSRF and replay protection. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-AUTH-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Duplicate identities, expired links, locked accounts, provider outage, stolen refresh token, clock skew, and deletion-pending accounts must fail safely.
- AC-AUTH-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Credentials are never logged; tokens are hashed or encrypted as appropriate; security events are auditable; MFA is required for privileged roles.

### 6.1.2 Onboarding [ONB]

**Purpose.** Reach first value quickly while collecting only the preferences necessary to personalize Focused.

**Actors.** Member

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns OnboardingState, Preference, GoalSeed, SchedulePreference, Consent. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /onboarding; /users/me/preferences; /users/me/consents

**Validation.** Required fields are limited to account, time zone, and locale; optional sensitive questions are clearly labeled and separately consented.

**Edge cases.** Refresh, cross-device continuation, revoked AI consent, unsupported locale, and abandoned flows preserve confirmed answers and never block core access.

**Security and privacy.** Sensitive answers are optional, purpose-limited, and excluded from marketing profiles.

Functional requirements

- FR-ONB-001 - The system shall enable an authorized actor to complete, skip, resume, and revise an accessible step-based onboarding flow.
- FR-ONB-002 - The system shall enable an authorized actor to select initial focus outcomes, preferred work pattern, time zone, locale, and optional tracker modules.
- FR-ONB-003 - The system shall enable an authorized actor to receive a generated first daily plan only after reviewing and confirming it.
  Acceptance criteria

- AC-ONB-01 - Given an authorized actor and valid input, when the actor requests to complete, skip, resume, and revise an accessible step-based onboarding flow, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-ONB-02 - Given the feature's prerequisite state, when the actor requests to select initial focus outcomes, preferred work pattern, time zone, locale, and optional tracker modules, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-ONB-03 - Given any required supporting data or integration is available, when the actor requests to receive a generated first daily plan only after reviewing and confirming it, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-ONB-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Required fields are limited to account, time zone, and locale; optional sensitive questions are clearly labeled and separately consented. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-ONB-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Refresh, cross-device continuation, revoked AI consent, unsupported locale, and abandoned flows preserve confirmed answers and never block core access.
- AC-ONB-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Sensitive answers are optional, purpose-limited, and excluded from marketing profiles.

### 6.1.3 Dashboard [DASH]

**Purpose.** Present the smallest actionable view of today, progress, and risks without becoming a distracting command center.

**Actors.** Member

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns DashboardSnapshot, WidgetPreference, DailyPlanSummary, AlertSummary. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /dashboard; /dashboard/widgets

**Validation.** Only supported widgets may be configured; stale aggregates disclose their as-of time; no widget may imply completion from missing data.

**Edge cases.** New users, partial service failure, offline cached snapshot, time-zone rollover, and zero configured modules show purposeful states.

**Security and privacy.** The dashboard aggregates only data the member may access; private journal text is never surfaced by default.

Functional requirements

- FR-DASH-001 - The system shall enable an authorized actor to view today's top priorities, next focus block, key habits, and relevant reminders in one summary.
- FR-DASH-002 - The system shall enable an authorized actor to reorder, hide, and restore permitted dashboard widgets with preferences synchronized across devices.
- FR-DASH-003 - The system shall enable an authorized actor to take a primary action from a widget and see the affected summary update without a full-page reload.
  Acceptance criteria

- AC-DASH-01 - Given an authorized actor and valid input, when the actor requests to view today's top priorities, next focus block, key habits, and relevant reminders in one summary, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-DASH-02 - Given the feature's prerequisite state, when the actor requests to reorder, hide, and restore permitted dashboard widgets with preferences synchronized across devices, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-DASH-03 - Given any required supporting data or integration is available, when the actor requests to take a primary action from a widget and see the affected summary update without a full-page reload, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-DASH-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Only supported widgets may be configured; stale aggregates disclose their as-of time; no widget may imply completion from missing data. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-DASH-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: New users, partial service failure, offline cached snapshot, time-zone rollover, and zero configured modules show purposeful states.
- AC-DASH-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: The dashboard aggregates only data the member may access; private journal text is never surfaced by default.

### 6.1.4 Profile [PROF]

**Purpose.** Manage identity-facing information independently from behavioral preferences and private productivity data.

**Actors.** Member, Administrator (limited support fields)

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns UserProfile, Avatar, PublicName, TimeZone. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /users/me/profile; /admin/users/{id}/status

**Validation.** Names and images must meet length, type, size, and safety constraints; canonical time-zone identifiers are required.

**Edge cases.** Avatar processing failure, time-zone changes near midnight, pending deletion, and federated identity field restrictions are explained without data loss.

**Security and privacy.** Profiles are private by default; administrators cannot read private activity through profile permissions.

Functional requirements

- FR-PROF-001 - The system shall enable an authorized actor to view and update display name, avatar, time zone, week start, and permitted contact information.
- FR-PROF-002 - The system shall enable an authorized actor to preview how profile and time-zone changes affect date boundaries before confirmation.
- FR-PROF-003 - The system shall enable an authorized actor to request account download or deletion from the profile privacy controls.
  Acceptance criteria

- AC-PROF-01 - Given an authorized actor and valid input, when the actor requests to view and update display name, avatar, time zone, week start, and permitted contact information, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-PROF-02 - Given the feature's prerequisite state, when the actor requests to preview how profile and time-zone changes affect date boundaries before confirmation, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-PROF-03 - Given any required supporting data or integration is available, when the actor requests to request account download or deletion from the profile privacy controls, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-PROF-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Names and images must meet length, type, size, and safety constraints; canonical time-zone identifiers are required. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-PROF-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Avatar processing failure, time-zone changes near midnight, pending deletion, and federated identity field restrictions are explained without data loss.
- AC-PROF-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Profiles are private by default; administrators cannot read private activity through profile permissions.

### 6.1.5 Settings [SET]

**Purpose.** Provide one discoverable control surface for behavior, privacy, appearance, integrations, and data lifecycle.

**Actors.** Member

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns Preference, PrivacySetting, IntegrationConnection, FeatureToggle. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /users/me/settings; /users/me/integrations; /users/me/consents

**Validation.** Settings use typed schemas, server validation, versioning, and optimistic concurrency to prevent silent overwrite.

**Edge cases.** Conflicting edits, unsupported combinations, offline changes, policy-forced values, and retired settings return actionable explanations.

**Security and privacy.** Privacy-reducing changes require explicit confirmation; security-critical changes trigger re-authentication and audit events.

Functional requirements

- FR-SET-001 - The system shall enable an authorized actor to search and modify categorized settings with immediate or explicitly deferred effect.
- FR-SET-002 - The system shall enable an authorized actor to review and revoke integrations, AI data scopes, notification channels, and connected sessions.
- FR-SET-003 - The system shall enable an authorized actor to restore documented defaults by category without resetting unrelated settings.
  Acceptance criteria

- AC-SET-01 - Given an authorized actor and valid input, when the actor requests to search and modify categorized settings with immediate or explicitly deferred effect, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-SET-02 - Given the feature's prerequisite state, when the actor requests to review and revoke integrations, AI data scopes, notification channels, and connected sessions, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-SET-03 - Given any required supporting data or integration is available, when the actor requests to restore documented defaults by category without resetting unrelated settings, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-SET-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Settings use typed schemas, server validation, versioning, and optimistic concurrency to prevent silent overwrite. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-SET-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Conflicting edits, unsupported combinations, offline changes, policy-forced values, and retired settings return actionable explanations.
- AC-SET-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Privacy-reducing changes require explicit confirmation; security-critical changes trigger re-authentication and audit events.

### 6.1.6 Language and Localization [LANG]

**Purpose.** Make core workflows usable across supported languages, locales, calendars, number formats, and text directions.

**Actors.** Member, Content Curator

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns LocalePreference, TranslationKey, TranslationBundle. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /locales; /users/me/locale; /admin/translations

**Validation.** Locale identifiers must be allow-listed BCP 47 tags; interpolation variables must be escaped and translation keys versioned.

**Edge cases.** Mixed-script content, right-to-left layout, missing plural rules, stale bundles, and offline locale changes remain readable and reversible.

**Security and privacy.** Language choice is not used to infer religion, ethnicity, or location.

Functional requirements

- FR-LANG-001 - The system shall enable an authorized actor to select a supported interface language independently from content and AI response language.
- FR-LANG-002 - The system shall enable an authorized actor to format dates, times, numbers, durations, and week boundaries using locale and user preferences.
- FR-LANG-003 - The system shall enable an authorized actor to fall back at the message-key level while reporting missing translations to maintainers.
  Acceptance criteria

- AC-LANG-01 - Given an authorized actor and valid input, when the actor requests to select a supported interface language independently from content and AI response language, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-LANG-02 - Given the feature's prerequisite state, when the actor requests to format dates, times, numbers, durations, and week boundaries using locale and user preferences, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-LANG-03 - Given any required supporting data or integration is available, when the actor requests to fall back at the message-key level while reporting missing translations to maintainers, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-LANG-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Locale identifiers must be allow-listed BCP 47 tags; interpolation variables must be escaped and translation keys versioned. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-LANG-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Mixed-script content, right-to-left layout, missing plural rules, stale bundles, and offline locale changes remain readable and reversible.
- AC-LANG-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Language choice is not used to infer religion, ethnicity, or location.

### 6.1.7 Accessibility Preferences [A11Y]

**Purpose.** Enable equitable use through standards-based defaults and user-controlled presentation and motion preferences.

**Actors.** Member

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns AccessibilityPreference. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /users/me/accessibility

**Validation.** Preferences must remain within layouts tested at 200% text zoom and cannot suppress essential safety or security messages.

**Edge cases.** OS preference changes, no-JavaScript fallbacks, zoom reflow, live-region conflicts, and unsupported browser features degrade gracefully.

**Security and privacy.** Accessibility preferences are private and must not be used for targeting or eligibility decisions.

Functional requirements

- FR-A11Y-001 - The system shall enable an authorized actor to control reduced motion, contrast, text scaling, focus assistance, timer announcements, and notification modality.
- FR-A11Y-002 - The system shall enable an authorized actor to apply preferences before interactive content is displayed to minimize flashes and layout shifts.
- FR-A11Y-003 - The system shall enable an authorized actor to use all critical workflows with keyboard, screen reader, zoom, and non-color cues.
  Acceptance criteria

- AC-A11Y-01 - Given an authorized actor and valid input, when the actor requests to control reduced motion, contrast, text scaling, focus assistance, timer announcements, and notification modality, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-A11Y-02 - Given the feature's prerequisite state, when the actor requests to apply preferences before interactive content is displayed to minimize flashes and layout shifts, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-A11Y-03 - Given any required supporting data or integration is available, when the actor requests to use all critical workflows with keyboard, screen reader, zoom, and non-color cues, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-A11Y-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Preferences must remain within layouts tested at 200% text zoom and cannot suppress essential safety or security messages. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-A11Y-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: OS preference changes, no-JavaScript fallbacks, zoom reflow, live-region conflicts, and unsupported browser features degrade gracefully.
- AC-A11Y-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Accessibility preferences are private and must not be used for targeting or eligibility decisions.

## 6.2 Focus Execution

### 6.2.1 Daily Focus [DAILY]

**Purpose.** Convert long-term intent into a realistic daily commitment and a clear next action.

**Actors.** Member, AI Coach with consent

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns DailyPlan, DailyPriority, CarryForwardDecision, CapacityEstimate. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /daily-plans/{date}; /daily-plans/{date}/priorities; /daily-plans/{date}/complete

**Validation.** A single canonical plan exists per user and local date; durations are positive and bounded; carried items require an explicit decision.

**Edge cases.** Travel across time zones, midnight rollover, duplicate submission, missed days, recurring tasks, and offline edits resolve deterministically.

**Security and privacy.** AI may propose but never silently add or complete commitments; private plan data stays user-scoped.

Functional requirements

- FR-DAILY-001 - The system shall enable an authorized actor to create a local-date plan with up to three primary priorities, supporting tasks, and an intentional-not-doing list.
- FR-DAILY-002 - The system shall enable an authorized actor to estimate capacity, schedule focus blocks, and warn without blocking when planned effort exceeds available time.
- FR-DAILY-003 - The system shall enable an authorized actor to complete, defer, cancel, or carry forward items while preserving the history and reason.
  Acceptance criteria

- AC-DAILY-01 - Given an authorized actor and valid input, when the actor requests to create a local-date plan with up to three primary priorities, supporting tasks, and an intentional-not-doing list, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-DAILY-02 - Given the feature's prerequisite state, when the actor requests to estimate capacity, schedule focus blocks, and warn without blocking when planned effort exceeds available time, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-DAILY-03 - Given any required supporting data or integration is available, when the actor requests to complete, defer, cancel, or carry forward items while preserving the history and reason, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-DAILY-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: A single canonical plan exists per user and local date; durations are positive and bounded; carried items require an explicit decision. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-DAILY-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Travel across time zones, midnight rollover, duplicate submission, missed days, recurring tasks, and offline edits resolve deterministically.
- AC-DAILY-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: AI may propose but never silently add or complete commitments; private plan data stays user-scoped.

### 6.2.2 Deep Work Timer [DEEP]

**Purpose.** Support interruption-resistant focus sessions with explicit intent, recovery, and trustworthy time accounting.

**Actors.** Member

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns FocusSession, SessionPause, Interruption, SessionIntent, SessionOutcome. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /focus-sessions; /focus-sessions/{id}/pause; /resume; /complete; /interruptions

**Validation.** Only one active focus-mode session is allowed per user; transitions follow a finite-state model; elapsed time cannot be negative or exceed policy bounds.

**Edge cases.** Closed tabs, device sleep, notification denial, concurrent devices, offline completion, clock drift, and app upgrades must not double-count time.

**Security and privacy.** Session intent is private; background controls require explicit OS/browser permission and cannot claim to block apps the platform cannot control.

Functional requirements

- FR-DEEP-001 - The system shall enable an authorized actor to start one active deep-work session with intent, planned duration, optional linked goal, and distraction controls.
- FR-DEEP-002 - The system shall enable an authorized actor to pause, resume, extend, abandon, and complete the session through idempotent state transitions.
- FR-DEEP-003 - The system shall enable an authorized actor to capture interruption category and outcome, then reconcile elapsed time from server timestamps after reconnect.
  Acceptance criteria

- AC-DEEP-01 - Given an authorized actor and valid input, when the actor requests to start one active deep-work session with intent, planned duration, optional linked goal, and distraction controls, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-DEEP-02 - Given the feature's prerequisite state, when the actor requests to pause, resume, extend, abandon, and complete the session through idempotent state transitions, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-DEEP-03 - Given any required supporting data or integration is available, when the actor requests to capture interruption category and outcome, then reconcile elapsed time from server timestamps after reconnect, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-DEEP-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Only one active focus-mode session is allowed per user; transitions follow a finite-state model; elapsed time cannot be negative or exceed policy bounds. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-DEEP-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Closed tabs, device sleep, notification denial, concurrent devices, offline completion, clock drift, and app upgrades must not double-count time.
- AC-DEEP-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Session intent is private; background controls require explicit OS/browser permission and cannot claim to block apps the platform cannot control.

### 6.2.3 Pomodoro [POMO]

**Purpose.** Offer configurable focus/break cycles without forcing one productivity method on every user.

**Actors.** Member

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns PomodoroPreset, PomodoroCycle, FocusSession. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /pomodoro/presets; /pomodoro/cycles; /focus-sessions

**Validation.** Focus and break durations must fall within configurable safe bounds; auto-start defaults off; cycle transitions are idempotent.

**Edge cases.** Background throttling, device sleep, muted audio, cross-device concurrency, early finish, and skipped breaks preserve correct cycle state.

**Security and privacy.** No punitive language or XP loss is applied for taking, extending, or skipping a break.

Functional requirements

- FR-POMO-001 - The system shall enable an authorized actor to configure validated focus, short-break, long-break, and cycle-count presets with sensible defaults.
- FR-POMO-002 - The system shall enable an authorized actor to run, pause, skip, and complete cycles while clearly distinguishing focus time from breaks.
- FR-POMO-003 - The system shall enable an authorized actor to optionally auto-start the next interval and notify only through consented channels.
  Acceptance criteria

- AC-POMO-01 - Given an authorized actor and valid input, when the actor requests to configure validated focus, short-break, long-break, and cycle-count presets with sensible defaults, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-POMO-02 - Given the feature's prerequisite state, when the actor requests to run, pause, skip, and complete cycles while clearly distinguishing focus time from breaks, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-POMO-03 - Given any required supporting data or integration is available, when the actor requests to optionally auto-start the next interval and notify only through consented channels, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-POMO-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Focus and break durations must fall within configurable safe bounds; auto-start defaults off; cycle transitions are idempotent. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-POMO-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Background throttling, device sleep, muted audio, cross-device concurrency, early finish, and skipped breaks preserve correct cycle state.
- AC-POMO-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: No punitive language or XP loss is applied for taking, extending, or skipping a break.

## 6.3 Planning

### 6.3.1 Smart Scheduling [SMARTSCHED]

**Purpose.** Propose achievable time blocks using priorities, energy, constraints, and calendar availability while keeping the user in control.

**Actors.** Member, AI Scheduling Service with consent

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns ScheduleProposal, TimeBlock, Constraint, EnergyPreference. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /schedule/proposals; /schedule/time-blocks; /calendar/free-busy

**Validation.** Time blocks must not overlap locked events or excluded hours; proposal inputs and time zone are versioned; calendar writes use idempotency keys.

**Edge cases.** Daylight-saving changes, all-day events, external calendar changes, insufficient free time, provider outage, and travel produce conflict-aware alternatives.

**Security and privacy.** Calendar details are minimized before AI processing; proposals never imply the system has booked time until the user confirms and the provider acknowledges.

Functional requirements

- FR-SMARTSCHED-001 - The system shall enable an authorized actor to generate an explainable schedule proposal from selected tasks, constraints, working hours, and available calendar windows.
- FR-SMARTSCHED-002 - The system shall enable an authorized actor to review, edit, partially accept, or reject proposed blocks before any calendar write occurs.
- FR-SMARTSCHED-003 - The system shall enable an authorized actor to replan after a conflict or missed block while preserving locked events and user-defined buffers.
  Acceptance criteria

- AC-SMARTSCHED-01 - Given an authorized actor and valid input, when the actor requests to generate an explainable schedule proposal from selected tasks, constraints, working hours, and available calendar windows, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-SMARTSCHED-02 - Given the feature's prerequisite state, when the actor requests to review, edit, partially accept, or reject proposed blocks before any calendar write occurs, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-SMARTSCHED-03 - Given any required supporting data or integration is available, when the actor requests to replan after a conflict or missed block while preserving locked events and user-defined buffers, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-SMARTSCHED-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Time blocks must not overlap locked events or excluded hours; proposal inputs and time zone are versioned; calendar writes use idempotency keys. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-SMARTSCHED-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Daylight-saving changes, all-day events, external calendar changes, insufficient free time, provider outage, and travel produce conflict-aware alternatives.
- AC-SMARTSCHED-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Calendar details are minimized before AI processing; proposals never imply the system has booked time until the user confirms and the provider acknowledges.

### 6.3.2 Goal Management [GOAL]

**Purpose.** Turn outcomes into measurable, reviewable goals connected to plans and daily execution.

**Actors.** Member, AI Coach with consent

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns Goal, Milestone, KeyResult, GoalCheckIn, GoalLink. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /goals; /goals/{id}/milestones; /goals/{id}/check-ins

**Validation.** Dates and measures must be coherent; progress is derived from declared measurement rules; completion requires explicit confirmation.

**Edge cases.** Overdue milestones, changed targets, deleted links, duplicate goals, backdated check-ins, and archived dependencies preserve history and explain calculations.

**Security and privacy.** Goals are private by default; AI suggestions cannot change status or targets without approval.

Functional requirements

- FR-GOAL-001 - The system shall enable an authorized actor to create outcome-oriented goals with owner, horizon, success measure, status, and optional milestones.
- FR-GOAL-002 - The system shall enable an authorized actor to link goals to vision areas, plans, tasks, habits, learning items, and focus sessions without duplicating source records.
- FR-GOAL-003 - The system shall enable an authorized actor to check in, revise, pause, complete, abandon, and archive goals while retaining an auditable progress history.
  Acceptance criteria

- AC-GOAL-01 - Given an authorized actor and valid input, when the actor requests to create outcome-oriented goals with owner, horizon, success measure, status, and optional milestones, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-GOAL-02 - Given the feature's prerequisite state, when the actor requests to link goals to vision areas, plans, tasks, habits, learning items, and focus sessions without duplicating source records, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-GOAL-03 - Given any required supporting data or integration is available, when the actor requests to check in, revise, pause, complete, abandon, and archive goals while retaining an auditable progress history, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-GOAL-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Dates and measures must be coherent; progress is derived from declared measurement rules; completion requires explicit confirmation. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-GOAL-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Overdue milestones, changed targets, deleted links, duplicate goals, backdated check-ins, and archived dependencies preserve history and explain calculations.
- AC-GOAL-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Goals are private by default; AI suggestions cannot change status or targets without approval.

### 6.3.3 Life Vision [VISION]

**Purpose.** Help users articulate values, roles, desired futures, and boundaries that guide—not overwhelm—goal selection.

**Actors.** Member, AI Coach with consent

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns LifeVision, VisionArea, Value, VisionRevision. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /life-vision; /life-vision/revisions; /life-vision/areas

**Validation.** Free text is length-bounded and autosaved as drafts; publishing a revision is explicit; blank or skipped areas are valid.

**Edge cases.** Sensitive disclosures, abandoned drafts, AI refusal, version restore, and account export/deletion are handled without accidental exposure.

**Security and privacy.** Life-vision content receives the same protection as journal content and is excluded from model training and admin access by default.

Functional requirements

- FR-VISION-001 - The system shall enable an authorized actor to create and revise private statements for values, roles, life areas, future narrative, and anti-goals.
- FR-VISION-002 - The system shall enable an authorized actor to review prior versions and intentionally connect selected vision areas to goals.
- FR-VISION-003 - The system shall enable an authorized actor to use optional guided prompts or AI reflection while retaining authorship and the ability to exclude any field.
  Acceptance criteria

- AC-VISION-01 - Given an authorized actor and valid input, when the actor requests to create and revise private statements for values, roles, life areas, future narrative, and anti-goals, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-VISION-02 - Given the feature's prerequisite state, when the actor requests to review prior versions and intentionally connect selected vision areas to goals, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-VISION-03 - Given any required supporting data or integration is available, when the actor requests to use optional guided prompts or AI reflection while retaining authorship and the ability to exclude any field, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-VISION-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Free text is length-bounded and autosaved as drafts; publishing a revision is explicit; blank or skipped areas are valid. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-VISION-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Sensitive disclosures, abandoned drafts, AI refusal, version restore, and account export/deletion are handled without accidental exposure.
- AC-VISION-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Life-vision content receives the same protection as journal content and is excluded from model training and admin access by default.

### 6.3.4 Weekly Planning [WEEKPLAN]

**Purpose.** Coordinate goals, commitments, capacity, and recovery across a user-defined week.

**Actors.** Member, AI Coach with consent

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns WeeklyPlan, WeeklyOutcome, CapacityBudget, WeeklyTheme. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /weekly-plans/{week}; /weekly-plans/{week}/outcomes; /weekly-plans/{week}/close

**Validation.** A user has one canonical weekly plan per configured week; capacity and planned duration are non-negative; carry-forward is explicit.

**Edge cases.** Week-start changes, partial weeks, travel, holidays, overlapping monthly plans, duplicate close, and missed planning show deterministic outcomes.

**Security and privacy.** Suggestions respect consent and never penalize reduced capacity or rest.

Functional requirements

- FR-WEEKPLAN-001 - The system shall enable an authorized actor to create a plan for the user's week boundary with outcomes, capacity, constraints, and protected recovery time.
- FR-WEEKPLAN-002 - The system shall enable an authorized actor to pull candidate items from active goals, backlog, habits, and calendar without auto-committing them.
- FR-WEEKPLAN-003 - The system shall enable an authorized actor to close the week with completion, carry-forward, cancellation, and reflection decisions.
  Acceptance criteria

- AC-WEEKPLAN-01 - Given an authorized actor and valid input, when the actor requests to create a plan for the user's week boundary with outcomes, capacity, constraints, and protected recovery time, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-WEEKPLAN-02 - Given the feature's prerequisite state, when the actor requests to pull candidate items from active goals, backlog, habits, and calendar without auto-committing them, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-WEEKPLAN-03 - Given any required supporting data or integration is available, when the actor requests to close the week with completion, carry-forward, cancellation, and reflection decisions, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-WEEKPLAN-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: A user has one canonical weekly plan per configured week; capacity and planned duration are non-negative; carry-forward is explicit. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-WEEKPLAN-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Week-start changes, partial weeks, travel, holidays, overlapping monthly plans, duplicate close, and missed planning show deterministic outcomes.
- AC-WEEKPLAN-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Suggestions respect consent and never penalize reduced capacity or rest.

### 6.3.5 Monthly Planning [MONTHPLAN]

**Purpose.** Set a limited monthly direction and measurable outcomes while surfacing capacity and seasonal constraints.

**Actors.** Member, AI Coach with consent

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns MonthlyPlan, MonthlyOutcome, MonthlyTheme, CapacityBudget. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /monthly-plans/{month}; /monthly-plans/{month}/outcomes; /monthly-plans/{month}/close

**Validation.** The plan is unique by user, calendar month, and time zone; outcome measures and capacity units must be declared.

**Edge cases.** Time-zone changes, partial first month, reopened plans, deleted goals, and late check-ins recompute summaries transparently.

**Security and privacy.** Private reflections are not included in shared/exported summaries unless the member selects them.

Functional requirements

- FR-MONTHPLAN-001 - The system shall enable an authorized actor to create a calendar-month plan with theme, outcomes, milestones, capacity budget, and explicit depriorities.
- FR-MONTHPLAN-002 - The system shall enable an authorized actor to roll up relevant weekly plans and goal milestones without double-counting progress.
- FR-MONTHPLAN-003 - The system shall enable an authorized actor to close and reflect on the month with evidence, lessons, and deliberate carry-forward decisions.
  Acceptance criteria

- AC-MONTHPLAN-01 - Given an authorized actor and valid input, when the actor requests to create a calendar-month plan with theme, outcomes, milestones, capacity budget, and explicit depriorities, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-MONTHPLAN-02 - Given the feature's prerequisite state, when the actor requests to roll up relevant weekly plans and goal milestones without double-counting progress, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-MONTHPLAN-03 - Given any required supporting data or integration is available, when the actor requests to close and reflect on the month with evidence, lessons, and deliberate carry-forward decisions, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-MONTHPLAN-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: The plan is unique by user, calendar month, and time zone; outcome measures and capacity units must be declared. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-MONTHPLAN-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Time-zone changes, partial first month, reopened plans, deleted goals, and late check-ins recompute summaries transparently.
- AC-MONTHPLAN-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Private reflections are not included in shared/exported summaries unless the member selects them.

### 6.3.6 Yearly Planning [YEARPLAN]

**Purpose.** Translate life direction into a sustainable annual portfolio of themes and outcomes.

**Actors.** Member, AI Coach with consent

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns YearlyPlan, AnnualTheme, AnnualOutcome, QuarterMarker. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /yearly-plans/{year}; /yearly-plans/{year}/outcomes; /yearly-plans/{year}/review

**Validation.** One canonical plan exists per user and calendar year; revisions are versioned; archived outcomes remain reportable.

**Edge cases.** Fiscal-year preference, leap year, mid-year adoption, changed vision, paused goals, and incomplete quarters remain coherent.

**Security and privacy.** The product avoids normative judgments about life-area balance and treats AI output as optional guidance.

Functional requirements

- FR-YEARPLAN-001 - The system shall enable an authorized actor to create an annual plan with themes, life-area balance, outcomes, quarter markers, and non-goals.
- FR-YEARPLAN-002 - The system shall enable an authorized actor to identify overcommitment across outcome count, estimated effort, and conflicting life areas.
- FR-YEARPLAN-003 - The system shall enable an authorized actor to review, revise, and close the year without rewriting historical snapshots.
  Acceptance criteria

- AC-YEARPLAN-01 - Given an authorized actor and valid input, when the actor requests to create an annual plan with themes, life-area balance, outcomes, quarter markers, and non-goals, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-YEARPLAN-02 - Given the feature's prerequisite state, when the actor requests to identify overcommitment across outcome count, estimated effort, and conflicting life areas, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-YEARPLAN-03 - Given any required supporting data or integration is available, when the actor requests to review, revise, and close the year without rewriting historical snapshots, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-YEARPLAN-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: One canonical plan exists per user and calendar year; revisions are versioned; archived outcomes remain reportable. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-YEARPLAN-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Fiscal-year preference, leap year, mid-year adoption, changed vision, paused goals, and incomplete quarters remain coherent.
- AC-YEARPLAN-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: The product avoids normative judgments about life-area balance and treats AI output as optional guidance.

### 6.3.7 Calendar [CAL]

**Purpose.** Provide a unified, time-zone-correct view of Focused commitments and user-authorized external events.

**Actors.** Member

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns Calendar, CalendarConnection, Event, TimeBlock, SyncCursor. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /calendars; /calendar/events; /calendar/connections; /calendar/sync

**Validation.** Events require valid start/end semantics, canonical time zone, recurrence limits, source ownership, and version tokens for updates.

**Edge cases.** Daylight-saving transitions, recurring exceptions, all-day events, provider deletions, duplicate webhooks, sync lag, and revoked access are reconciled safely.

**Security and privacy.** External event titles/details are not exposed to AI or notifications beyond the member's selected scope.

Functional requirements

- FR-CAL-001 - The system shall enable an authorized actor to view day, week, and month representations with keyboard-accessible navigation and clear source labeling.
- FR-CAL-002 - The system shall enable an authorized actor to create, edit, move, and delete Focused-owned events and time blocks with recurrence support.
- FR-CAL-003 - The system shall enable an authorized actor to connect supported providers and synchronize only consented calendars using incremental, observable sync.
  Acceptance criteria

- AC-CAL-01 - Given an authorized actor and valid input, when the actor requests to view day, week, and month representations with keyboard-accessible navigation and clear source labeling, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-CAL-02 - Given the feature's prerequisite state, when the actor requests to create, edit, move, and delete Focused-owned events and time blocks with recurrence support, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-CAL-03 - Given any required supporting data or integration is available, when the actor requests to connect supported providers and synchronize only consented calendars using incremental, observable sync, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-CAL-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Events require valid start/end semantics, canonical time zone, recurrence limits, source ownership, and version tokens for updates. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-CAL-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Daylight-saving transitions, recurring exceptions, all-day events, provider deletions, duplicate webhooks, sync lag, and revoked access are reconciled safely.
- AC-CAL-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: External event titles/details are not exposed to AI or notifications beyond the member's selected scope.

## 6.4 Tracking

### 6.4.1 Habit Tracker [HABIT]

**Purpose.** Support flexible behaviors with honest completion rules, recovery, and non-punitive trends.

**Actors.** Member

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns Habit, HabitSchedule, HabitEntry, HabitPause. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /habits; /habits/{id}/entries; /habits/{id}/pause

**Validation.** Targets match the habit type; schedules are non-empty; entries are idempotent per habit and occurrence unless multiple entries are explicitly allowed.

**Edge cases.** Schedule edits, vacations, illness pauses, daylight-saving changes, missed days, backfills, and deleted habits preserve historical interpretation.

**Security and privacy.** Health- or faith-related habits remain private; skipped days do not use shame-based language.

Functional requirements

- FR-HABIT-001 - The system shall enable an authorized actor to create boolean, count, duration, or avoidance habits with schedule, target, unit, and start date.
- FR-HABIT-002 - The system shall enable an authorized actor to record, edit, skip with reason, pause, resume, and backfill entries within policy.
- FR-HABIT-003 - The system shall enable an authorized actor to show adherence trends and streaks based on the habit's own schedule and time zone.
  Acceptance criteria

- AC-HABIT-01 - Given an authorized actor and valid input, when the actor requests to create boolean, count, duration, or avoidance habits with schedule, target, unit, and start date, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-HABIT-02 - Given the feature's prerequisite state, when the actor requests to record, edit, skip with reason, pause, resume, and backfill entries within policy, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-HABIT-03 - Given any required supporting data or integration is available, when the actor requests to show adherence trends and streaks based on the habit's own schedule and time zone, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-HABIT-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Targets match the habit type; schedules are non-empty; entries are idempotent per habit and occurrence unless multiple entries are explicitly allowed. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-HABIT-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Schedule edits, vacations, illness pauses, daylight-saving changes, missed days, backfills, and deleted habits preserve historical interpretation.
- AC-HABIT-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Health- or faith-related habits remain private; skipped days do not use shame-based language.

### 6.4.2 Learning Tracker [LEARN]

**Purpose.** Track deliberate learning across courses, skills, projects, practice, and evidence of mastery.

**Actors.** Member, AI Mentor with consent

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns LearningPath, LearningItem, StudySession, SkillEvidence. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /learning/paths; /learning/items; /learning/sessions; /learning/evidence

**Validation.** Levels and confidence use declared scales; session duration is bounded; resource URLs are validated and normalized.

**Edge cases.** Course abandonment, duplicate resources, changed target skill, offline sessions, imported history, and deleted evidence retain consistent totals.

**Security and privacy.** Learning data is not used to infer employment eligibility; AI mentor access is scope-based and revocable.

Functional requirements

- FR-LEARN-001 - The system shall enable an authorized actor to create learning paths with desired skill, current level, resources, milestones, and success evidence.
- FR-LEARN-002 - The system shall enable an authorized actor to log study time, practice type, notes, confidence, and completed learning items.
- FR-LEARN-003 - The system shall enable an authorized actor to review progress by evidence and spaced check-ins rather than time spent alone.
  Acceptance criteria

- AC-LEARN-01 - Given an authorized actor and valid input, when the actor requests to create learning paths with desired skill, current level, resources, milestones, and success evidence, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-LEARN-02 - Given the feature's prerequisite state, when the actor requests to log study time, practice type, notes, confidence, and completed learning items, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-LEARN-03 - Given any required supporting data or integration is available, when the actor requests to review progress by evidence and spaced check-ins rather than time spent alone, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-LEARN-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Levels and confidence use declared scales; session duration is bounded; resource URLs are validated and normalized. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-LEARN-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Course abandonment, duplicate resources, changed target skill, offline sessions, imported history, and deleted evidence retain consistent totals.
- AC-LEARN-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Learning data is not used to infer employment eligibility; AI mentor access is scope-based and revocable.

### 6.4.3 Programming Progress [PROG]

**Purpose.** Represent software-development growth through topics, projects, practice, and demonstrated outcomes.

**Actors.** Member, AI Mentor with consent

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns ProgrammingSkill, ProjectEvidence, PracticeLog, TechnologyTag. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /programming/skills; /programming/projects; /programming/logs

**Validation.** External links use allow-listed schemes; proficiency scales are explicit; duplicate evidence links are detected but may be retained with confirmation.

**Edge cases.** Private repositories, renamed technologies, deleted links, imported duplicates, zero-commit work, and long breaks remain representable.

**Security and privacy.** Repository access is opt-in and least-privilege; source code is never sent to AI unless separately selected and consented.

Functional requirements

- FR-PROG-001 - The system shall enable an authorized actor to track languages, technologies, concepts, proficiency self-assessments, and desired outcomes.
- FR-PROG-002 - The system shall enable an authorized actor to attach project milestones, repositories or artifacts, retrospectives, and evidence to skills.
- FR-PROG-003 - The system shall enable an authorized actor to view practice consistency and breadth without equating commit volume with competence.
  Acceptance criteria

- AC-PROG-01 - Given an authorized actor and valid input, when the actor requests to track languages, technologies, concepts, proficiency self-assessments, and desired outcomes, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-PROG-02 - Given the feature's prerequisite state, when the actor requests to attach project milestones, repositories or artifacts, retrospectives, and evidence to skills, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-PROG-03 - Given any required supporting data or integration is available, when the actor requests to view practice consistency and breadth without equating commit volume with competence, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-PROG-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: External links use allow-listed schemes; proficiency scales are explicit; duplicate evidence links are detected but may be retained with confirmation. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-PROG-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Private repositories, renamed technologies, deleted links, imported duplicates, zero-commit work, and long breaks remain representable.
- AC-PROG-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Repository access is opt-in and least-privilege; source code is never sent to AI unless separately selected and consented.

### 6.4.4 LeetCode Tracker [LC]

**Purpose.** Track interview-practice problems, patterns, attempts, and review needs without unsafe scraping.

**Actors.** Member

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns ProblemReference, ProblemAttempt, PatternTag, ReviewSchedule, ImportRecord. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /coding-practice/problems; /coding-practice/attempts; /coding-practice/imports

**Validation.** Problem identity is canonical per source; attempt durations and dates are validated; imports are schema-checked and idempotent.

**Edge cases.** Renamed or removed problems, duplicate imports, partial import failure, private notes, source outage, and missing difficulty remain usable.

**Security and privacy.** The system does not scrape protected pages, store third-party credentials, or claim affiliation with LeetCode.

Functional requirements

- FR-LC-001 - The system shall enable an authorized actor to record problem metadata, difficulty, pattern, attempt outcome, time, notes, and next-review date.
- FR-LC-002 - The system shall enable an authorized actor to import data only through user-supplied files or a supported authorized integration and show a preview before commit.
- FR-LC-003 - The system shall enable an authorized actor to identify weak patterns and overdue reviews from the member's own attempt history.
  Acceptance criteria

- AC-LC-01 - Given an authorized actor and valid input, when the actor requests to record problem metadata, difficulty, pattern, attempt outcome, time, notes, and next-review date, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-LC-02 - Given the feature's prerequisite state, when the actor requests to import data only through user-supplied files or a supported authorized integration and show a preview before commit, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-LC-03 - Given any required supporting data or integration is available, when the actor requests to identify weak patterns and overdue reviews from the member's own attempt history, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-LC-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Problem identity is canonical per source; attempt durations and dates are validated; imports are schema-checked and idempotent. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-LC-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Renamed or removed problems, duplicate imports, partial import failure, private notes, source outage, and missing difficulty remain usable.
- AC-LC-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: The system does not scrape protected pages, store third-party credentials, or claim affiliation with LeetCode.

### 6.4.5 Reading Tracker [READ]

**Purpose.** Support intentional reading through a queue, progress, notes, and completion reflection.

**Actors.** Member

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns ReadingItem, ReadingProgress, ReadingSession, ReadingNote. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /reading/items; /reading/items/{id}/progress; /reading/sessions

**Validation.** Progress is monotonic by default but may be corrected with confirmation; totals and positions must share a declared unit.

**Edge cases.** Unknown length, rereads, multiple editions, abandoned items, article URLs, offline updates, and corrected progress preserve history.

**Security and privacy.** Reading notes are private by default; copyrighted full text is not copied or redistributed without rights.

Functional requirements

- FR-READ-001 - The system shall enable an authorized actor to add books, articles, papers, or custom material with status, format, optional edition, and goal.
- FR-READ-002 - The system shall enable an authorized actor to record page, percentage, location, or time progress without mixing incompatible units.
- FR-READ-003 - The system shall enable an authorized actor to capture notes and a completion reflection, then expose non-private summaries to the knowledge hub when selected.
  Acceptance criteria

- AC-READ-01 - Given an authorized actor and valid input, when the actor requests to add books, articles, papers, or custom material with status, format, optional edition, and goal, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-READ-02 - Given the feature's prerequisite state, when the actor requests to record page, percentage, location, or time progress without mixing incompatible units, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-READ-03 - Given any required supporting data or integration is available, when the actor requests to capture notes and a completion reflection, then expose non-private summaries to the knowledge hub when selected, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-READ-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Progress is monotonic by default but may be corrected with confirmation; totals and positions must share a declared unit. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-READ-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Unknown length, rereads, multiple editions, abandoned items, article URLs, offline updates, and corrected progress preserve history.
- AC-READ-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Reading notes are private by default; copyrighted full text is not copied or redistributed without rights.

## 6.5 Faith and Wellbeing

### 6.5.1 Quran Tracker [QURAN]

**Purpose.** Help users record Quran reading or memorization progress respectfully and privately.

**Actors.** Member

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns QuranPlan, QuranProgress, SurahReference, AyahRange, MemorizationReview. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /quran/plans; /quran/progress; /quran/reviews

**Validation.** Ranges must match the canonical reference dataset; start is not after end; overlapping entries are normalized or confirmed.

**Edge cases.** Different mushaf page numbering, partial ayah ranges, Ramadan plans, travel, missed days, offline entries, and dataset version changes are disclosed.

**Security and privacy.** Faith activity is sensitive private data; translations/recitations require licensing; AI does not issue religious rulings.

Functional requirements

- FR-QURAN-001 - The system shall enable an authorized actor to create reading or memorization plans using canonical surah and ayah references and a chosen pace.
- FR-QURAN-002 - The system shall enable an authorized actor to record completed ranges, revisions, and memorization review confidence without double-counting overlaps.
- FR-QURAN-003 - The system shall enable an authorized actor to show progress and missed-plan recovery options without religious judgment or fabricated guidance.
  Acceptance criteria

- AC-QURAN-01 - Given an authorized actor and valid input, when the actor requests to create reading or memorization plans using canonical surah and ayah references and a chosen pace, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-QURAN-02 - Given the feature's prerequisite state, when the actor requests to record completed ranges, revisions, and memorization review confidence without double-counting overlaps, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-QURAN-03 - Given any required supporting data or integration is available, when the actor requests to show progress and missed-plan recovery options without religious judgment or fabricated guidance, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-QURAN-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Ranges must match the canonical reference dataset; start is not after end; overlapping entries are normalized or confirmed. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-QURAN-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Different mushaf page numbering, partial ayah ranges, Ramadan plans, travel, missed days, offline entries, and dataset version changes are disclosed.
- AC-QURAN-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Faith activity is sensitive private data; translations/recitations require licensing; AI does not issue religious rulings.

### 6.5.2 Prayer Tracker [PRAYER]

**Purpose.** Offer optional, respectful prayer planning and logging with configurable calculation and privacy.

**Actors.** Member

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns PrayerPreference, PrayerOccurrence, PrayerLog, CalculationMethod. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /prayer/preferences; /prayer/times; /prayer/logs

**Validation.** Prayer calculations require valid method and time zone; location use is explicit; manual times may override calculated values with clear labeling.

**Edge cases.** High latitudes, daylight-saving changes, travel, location denial, method disagreement, offline cache, and missed sync show transparent fallbacks.

**Security and privacy.** Religious belief, location, and prayer logs are sensitive; no public leaderboard, negative XP, or claim of religious authority is permitted.

Functional requirements

- FR-PRAYER-001 - The system shall enable an authorized actor to configure location precision, calculation method, madhhab option where applicable, and notification preferences.
- FR-PRAYER-002 - The system shall enable an authorized actor to display calculated times with method, location basis, time zone, and last-updated disclosure.
- FR-PRAYER-003 - The system shall enable an authorized actor to record optional completion state or private notes and correct entries without punitive gamification.
  Acceptance criteria

- AC-PRAYER-01 - Given an authorized actor and valid input, when the actor requests to configure location precision, calculation method, madhhab option where applicable, and notification preferences, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-PRAYER-02 - Given the feature's prerequisite state, when the actor requests to display calculated times with method, location basis, time zone, and last-updated disclosure, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-PRAYER-03 - Given any required supporting data or integration is available, when the actor requests to record optional completion state or private notes and correct entries without punitive gamification, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-PRAYER-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Prayer calculations require valid method and time zone; location use is explicit; manual times may override calculated values with clear labeling. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-PRAYER-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: High latitudes, daylight-saving changes, travel, location denial, method disagreement, offline cache, and missed sync show transparent fallbacks.
- AC-PRAYER-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Religious belief, location, and prayer logs are sensitive; no public leaderboard, negative XP, or claim of religious authority is permitted.

### 6.5.3 Workout Tracker [WORKOUT]

**Purpose.** Record training plans, sessions, and trends without pretending to provide medical supervision.

**Actors.** Member

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns WorkoutPlan, Exercise, WorkoutSession, ExerciseSet, BodyMetric. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /workouts/plans; /workouts/sessions; /workouts/exercises

**Validation.** Units and exercise measurement types must be compatible; negative values are rejected; personal records are derived from declared formulas.

**Edge cases.** Supersets, partial workouts, unit conversion, corrected sets, offline logging, injury pauses, and duplicate submissions preserve trustworthy totals.

**Security and privacy.** Workout and body metrics are sensitive; the product provides general tracking, not diagnosis or emergency guidance.

Functional requirements

- FR-WORKOUT-001 - The system shall enable an authorized actor to create reusable workouts with exercises, sets, repetitions, duration, distance, intensity, and rest as applicable.
- FR-WORKOUT-002 - The system shall enable an authorized actor to log, pause, resume, edit, and complete sessions with unit-aware totals and personal records.
- FR-WORKOUT-003 - The system shall enable an authorized actor to review volume, consistency, recovery notes, and trends with configurable goals.
  Acceptance criteria

- AC-WORKOUT-01 - Given an authorized actor and valid input, when the actor requests to create reusable workouts with exercises, sets, repetitions, duration, distance, intensity, and rest as applicable, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-WORKOUT-02 - Given the feature's prerequisite state, when the actor requests to log, pause, resume, edit, and complete sessions with unit-aware totals and personal records, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-WORKOUT-03 - Given any required supporting data or integration is available, when the actor requests to review volume, consistency, recovery notes, and trends with configurable goals, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-WORKOUT-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Units and exercise measurement types must be compatible; negative values are rejected; personal records are derived from declared formulas. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-WORKOUT-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Supersets, partial workouts, unit conversion, corrected sets, offline logging, injury pauses, and duplicate submissions preserve trustworthy totals.
- AC-WORKOUT-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Workout and body metrics are sensitive; the product provides general tracking, not diagnosis or emergency guidance.

### 6.5.4 Sleep Tracker [SLEEP]

**Purpose.** Help users understand routines and self-reported sleep patterns without medical claims.

**Actors.** Member

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns SleepEntry, SleepWindow, SleepQuality, SleepFactor, ImportRecord. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /sleep/entries; /sleep/imports; /sleep/trends

**Validation.** End must follow start after time-zone normalization; overlapping entries and implausible durations require correction or explicit override.

**Edge cases.** Naps, shift work, daylight-saving changes, travel, duplicate device records, missing stages, and deleted sources retain provenance.

**Security and privacy.** Sleep data is sensitive health-related data; insights include non-medical disclaimers and emergency symptoms are not interpreted by AI.

Functional requirements

- FR-SLEEP-001 - The system shall enable an authorized actor to record sleep start/end, awakenings, quality, optional factors, and notes across midnight and time zones.
- FR-SLEEP-002 - The system shall enable an authorized actor to import user-authorized device data with source labels and allow reconciliation with manual entries.
- FR-SLEEP-003 - The system shall enable an authorized actor to show duration and trend summaries while distinguishing measured, imported, and self-reported values.
  Acceptance criteria

- AC-SLEEP-01 - Given an authorized actor and valid input, when the actor requests to record sleep start/end, awakenings, quality, optional factors, and notes across midnight and time zones, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-SLEEP-02 - Given the feature's prerequisite state, when the actor requests to import user-authorized device data with source labels and allow reconciliation with manual entries, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-SLEEP-03 - Given any required supporting data or integration is available, when the actor requests to show duration and trend summaries while distinguishing measured, imported, and self-reported values, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-SLEEP-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: End must follow start after time-zone normalization; overlapping entries and implausible durations require correction or explicit override. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-SLEEP-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Naps, shift work, daylight-saving changes, travel, duplicate device records, missing stages, and deleted sources retain provenance.
- AC-SLEEP-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Sleep data is sensitive health-related data; insights include non-medical disclaimers and emergency symptoms are not interpreted by AI.

## 6.6 Reflection

### 6.6.1 Journal [JOURNAL]

**Purpose.** Provide a private, low-friction space for dated writing, prompts, and attachments.

**Actors.** Member, AI only for explicitly selected entries

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns JournalEntry, JournalRevision, Prompt, Attachment. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /journal/entries; /journal/entries/{id}/revisions; /journal/prompts

**Validation.** Draft versions use optimistic concurrency and recovery snapshots; attachments are type/size scanned; destructive deletion has a recovery window where policy allows.

**Edge cases.** Offline edits, conflicting devices, empty drafts, large entries, failed attachments, search indexing lag, and deletion during AI processing fail privately.

**Security and privacy.** Journal content is encrypted in transit and at rest, excluded from admin/support views and model training by default, and never used for ads.

Functional requirements

- FR-JOURNAL-001 - The system shall enable an authorized actor to create, autosave, edit, search, archive, and delete dated rich-text or plain-text entries.
- FR-JOURNAL-002 - The system shall enable an authorized actor to use optional prompts, tags, mood links, and attachments without making any field mandatory.
- FR-JOURNAL-003 - The system shall enable an authorized actor to select specific entries or excerpts for AI reflection and preview the exact scope before sending.
  Acceptance criteria

- AC-JOURNAL-01 - Given an authorized actor and valid input, when the actor requests to create, autosave, edit, search, archive, and delete dated rich-text or plain-text entries, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-JOURNAL-02 - Given the feature's prerequisite state, when the actor requests to use optional prompts, tags, mood links, and attachments without making any field mandatory, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-JOURNAL-03 - Given any required supporting data or integration is available, when the actor requests to select specific entries or excerpts for AI reflection and preview the exact scope before sending, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-JOURNAL-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Draft versions use optimistic concurrency and recovery snapshots; attachments are type/size scanned; destructive deletion has a recovery window where policy allows. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-JOURNAL-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Offline edits, conflicting devices, empty drafts, large entries, failed attachments, search indexing lag, and deletion during AI processing fail privately.
- AC-JOURNAL-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Journal content is encrypted in transit and at rest, excluded from admin/support views and model training by default, and never used for ads.

### 6.6.2 Reflection [REFLECT]

**Purpose.** Turn events and outcomes into lessons, decisions, and next experiments at a chosen cadence.

**Actors.** Member, AI Coach with consent

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns Reflection, ReflectionPrompt, Lesson, Experiment. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /reflections; /reflections/{id}/lessons; /reflections/{id}/experiments

**Validation.** Cadence and covered period are explicit; linked evidence is read-only; AI-extracted lessons remain drafts until confirmed.

**Edge cases.** Missed periods, duplicate prompts, changed templates, private evidence, offline drafting, and deleted sources preserve reflection text and provenance.

**Security and privacy.** Reflection text shares journal-grade protections; AI must avoid diagnosis and clearly label inference.

Functional requirements

- FR-REFLECT-001 - The system shall enable an authorized actor to complete daily, weekly, monthly, goal, or custom reflections using configurable prompts.
- FR-REFLECT-002 - The system shall enable an authorized actor to link evidence from plans, sessions, trackers, and goals while keeping source records independent.
- FR-REFLECT-003 - The system shall enable an authorized actor to extract user-confirmed lessons and experiments and revisit them in later reviews.
  Acceptance criteria

- AC-REFLECT-01 - Given an authorized actor and valid input, when the actor requests to complete daily, weekly, monthly, goal, or custom reflections using configurable prompts, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-REFLECT-02 - Given the feature's prerequisite state, when the actor requests to link evidence from plans, sessions, trackers, and goals while keeping source records independent, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-REFLECT-03 - Given any required supporting data or integration is available, when the actor requests to extract user-confirmed lessons and experiments and revisit them in later reviews, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-REFLECT-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Cadence and covered period are explicit; linked evidence is read-only; AI-extracted lessons remain drafts until confirmed. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-REFLECT-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Missed periods, duplicate prompts, changed templates, private evidence, offline drafting, and deleted sources preserve reflection text and provenance.
- AC-REFLECT-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Reflection text shares journal-grade protections; AI must avoid diagnosis and clearly label inference.

### 6.6.3 Mood Tracker [MOOD]

**Purpose.** Enable lightweight, optional mood check-ins and personal pattern exploration without diagnosis.

**Actors.** Member

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns MoodEntry, MoodScale, MoodFactor, SafetyResourceEvent. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /moods; /mood-scales; /moods/trends

**Validation.** Scale values must map to stable labels; timestamps and time zones are required; notes are optional and length-bounded.

**Edge cases.** Multiple daily entries, custom scales, false-positive safety triggers, offline check-ins, deleted correlations, and time-zone changes remain transparent.

**Security and privacy.** Mood data is highly sensitive; no public comparison, advertising use, diagnosis, or silent sharing with AI is allowed.

Functional requirements

- FR-MOOD-001 - The system shall enable an authorized actor to record mood using a configurable labeled scale with optional emotions, energy, factors, and note.
- FR-MOOD-002 - The system shall enable an authorized actor to edit or delete check-ins and view patterns alongside user-selected activities.
- FR-MOOD-003 - The system shall enable an authorized actor to display region-appropriate crisis or emergency resources when explicit high-risk language is detected, without claiming assessment.
  Acceptance criteria

- AC-MOOD-01 - Given an authorized actor and valid input, when the actor requests to record mood using a configurable labeled scale with optional emotions, energy, factors, and note, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-MOOD-02 - Given the feature's prerequisite state, when the actor requests to edit or delete check-ins and view patterns alongside user-selected activities, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-MOOD-03 - Given any required supporting data or integration is available, when the actor requests to display region-appropriate crisis or emergency resources when explicit high-risk language is detected, without claiming assessment, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-MOOD-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Scale values must map to stable labels; timestamps and time zones are required; notes are optional and length-bounded. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-MOOD-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Multiple daily entries, custom scales, false-positive safety triggers, offline check-ins, deleted correlations, and time-zone changes remain transparent.
- AC-MOOD-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Mood data is highly sensitive; no public comparison, advertising use, diagnosis, or silent sharing with AI is allowed.

## 6.7 AI Guidance

### 6.7.1 AI Coach [AICOACH]

**Purpose.** Provide contextual, action-oriented productivity coaching while preserving agency, privacy, and uncertainty.

**Actors.** Member, AI Orchestration Service

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns Conversation, CoachMessage, ContextGrant, ActionProposal, SafetyEvent. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /ai/coach/conversations; /ai/coach/messages; /ai/action-proposals

**Validation.** Requests enforce context budgets, model policy, rate limits, prompt-injection defenses, and structured output validation.

**Edge cases.** Provider timeout, partial stream, unsafe request, stale context, contradictory data, user correction, and cost limit produce recoverable labeled responses.

**Security and privacy.** Conversations and context grants are user-controlled; sensitive data is minimized; no medical, legal, financial, or religious authority is claimed.

Functional requirements

- FR-AICOACH-001 - The system shall enable an authorized actor to conduct streaming coaching conversations using only the context scopes the member selects.
- FR-AICOACH-002 - The system shall enable an authorized actor to explain material recommendations, cite internal evidence by date/source, and distinguish facts from inference.
- FR-AICOACH-003 - The system shall enable an authorized actor to create reviewable action proposals for plans, goals, reminders, or schedules and execute none without confirmation.
  Acceptance criteria

- AC-AICOACH-01 - Given an authorized actor and valid input, when the actor requests to conduct streaming coaching conversations using only the context scopes the member selects, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-AICOACH-02 - Given the feature's prerequisite state, when the actor requests to explain material recommendations, cite internal evidence by date/source, and distinguish facts from inference, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-AICOACH-03 - Given any required supporting data or integration is available, when the actor requests to create reviewable action proposals for plans, goals, reminders, or schedules and execute none without confirmation, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-AICOACH-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Requests enforce context budgets, model policy, rate limits, prompt-injection defenses, and structured output validation. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-AICOACH-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Provider timeout, partial stream, unsafe request, stale context, contradictory data, user correction, and cost limit produce recoverable labeled responses.
- AC-AICOACH-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Conversations and context grants are user-controlled; sensitive data is minimized; no medical, legal, financial, or religious authority is claimed.

### 6.7.2 AI Mentor [AIMENTOR]

**Purpose.** Support longer-term skill development with curricula, practice, feedback, and evidence-based adaptation.

**Actors.** Member, AI Orchestration Service

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns MentorRelationship, LearningPlan, MentorSession, FeedbackArtifact. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /ai/mentor/plans; /ai/mentor/sessions; /ai/mentor/feedback

**Validation.** Plans require an explicit objective and review date; uploaded artifacts are scanned; generated steps must match supported structured schemas.

**Edge cases.** Insufficient evidence, changing objectives, skill mismatch, unavailable model, unsafe content, large artifact, and deleted context produce bounded alternatives.

**Security and privacy.** Artifacts are processed only for the requested session unless retained by choice; evaluation is advisory and not a credential.

Functional requirements

- FR-AIMENTOR-001 - The system shall enable an authorized actor to define a mentoring objective, current level, constraints, preferred style, and evidence of success.
- FR-AIMENTOR-002 - The system shall enable an authorized actor to generate a reviewable learning plan and adaptive practice suggestions grounded in confirmed progress.
- FR-AIMENTOR-003 - The system shall enable an authorized actor to provide feedback on user-selected artifacts while identifying uncertainty and avoiding fabricated assessment.
  Acceptance criteria

- AC-AIMENTOR-01 - Given an authorized actor and valid input, when the actor requests to define a mentoring objective, current level, constraints, preferred style, and evidence of success, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-AIMENTOR-02 - Given the feature's prerequisite state, when the actor requests to generate a reviewable learning plan and adaptive practice suggestions grounded in confirmed progress, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-AIMENTOR-03 - Given any required supporting data or integration is available, when the actor requests to provide feedback on user-selected artifacts while identifying uncertainty and avoiding fabricated assessment, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-AIMENTOR-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Plans require an explicit objective and review date; uploaded artifacts are scanned; generated steps must match supported structured schemas. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-AIMENTOR-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Insufficient evidence, changing objectives, skill mismatch, unavailable model, unsafe content, large artifact, and deleted context produce bounded alternatives.
- AC-AIMENTOR-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Artifacts are processed only for the requested session unless retained by choice; evaluation is advisory and not a credential.

### 6.7.3 AI Daily Review [AIDAILY]

**Purpose.** Summarize the day and propose a small next adjustment from confirmed activity.

**Actors.** Member, AI Review Service

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns AIReview, ReviewEvidence, Suggestion, ReviewFeedback. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /ai/reviews/daily/{date}; /ai/reviews/{id}/feedback

**Validation.** One active generated version per review request is identified by evidence snapshot; stale reviews are labeled; generation requires consent.

**Edge cases.** No activity, partial sync, late entries, repeated generation, model refusal, midnight rollover, and deleted evidence preserve provenance.

**Security and privacy.** Sensitive sources are opt-in by category; review text is not a diagnosis or moral judgment.

Functional requirements

- FR-AIDAILY-001 - The system shall enable an authorized actor to generate an on-demand or scheduled daily review from selected plan, focus, habit, mood, and reflection data.
- FR-AIDAILY-002 - The system shall enable an authorized actor to show evidence coverage, missing-data notices, wins, friction, and at most a small configured number of next actions.
- FR-AIDAILY-003 - The system shall enable an authorized actor to accept, edit, dismiss, or rate suggestions without altering source records.
  Acceptance criteria

- AC-AIDAILY-01 - Given an authorized actor and valid input, when the actor requests to generate an on-demand or scheduled daily review from selected plan, focus, habit, mood, and reflection data, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-AIDAILY-02 - Given the feature's prerequisite state, when the actor requests to show evidence coverage, missing-data notices, wins, friction, and at most a small configured number of next actions, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-AIDAILY-03 - Given any required supporting data or integration is available, when the actor requests to accept, edit, dismiss, or rate suggestions without altering source records, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-AIDAILY-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: One active generated version per review request is identified by evidence snapshot; stale reviews are labeled; generation requires consent. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-AIDAILY-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: No activity, partial sync, late entries, repeated generation, model refusal, midnight rollover, and deleted evidence preserve provenance.
- AC-AIDAILY-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Sensitive sources are opt-in by category; review text is not a diagnosis or moral judgment.

### 6.7.4 AI Weekly Review [AIWEEK]

**Purpose.** Identify weekly patterns and planning adjustments from evidence rather than generic encouragement.

**Actors.** Member, AI Review Service

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns AIReview, WeeklyEvidenceSnapshot, Suggestion, ReviewFeedback. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /ai/reviews/weekly/{week}; /ai/reviews/{id}/feedback

**Validation.** Week boundary, snapshot version, source scopes, and comparison baseline are explicit; unsupported correlations are phrased as hypotheses.

**Edge cases.** Changed week start, missing days, vacation, outlier sessions, recomputed analytics, and repeated review versions remain explainable.

**Security and privacy.** Review data remains private and cannot be used to rank users or make employment/education decisions.

Functional requirements

- FR-AIWEEK-001 - The system shall enable an authorized actor to generate a weekly review over the member's configured week and selected data scopes.
- FR-AIWEEK-002 - The system shall enable an authorized actor to compare intended outcomes, actual focus, interruptions, habits, energy, and carry-forward decisions with transparent gaps.
- FR-AIWEEK-003 - The system shall enable an authorized actor to propose a bounded experiment for the next week and require confirmation before adding it to planning.
  Acceptance criteria

- AC-AIWEEK-01 - Given an authorized actor and valid input, when the actor requests to generate a weekly review over the member's configured week and selected data scopes, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-AIWEEK-02 - Given the feature's prerequisite state, when the actor requests to compare intended outcomes, actual focus, interruptions, habits, energy, and carry-forward decisions with transparent gaps, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-AIWEEK-03 - Given any required supporting data or integration is available, when the actor requests to propose a bounded experiment for the next week and require confirmation before adding it to planning, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-AIWEEK-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Week boundary, snapshot version, source scopes, and comparison baseline are explicit; unsupported correlations are phrased as hypotheses. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-AIWEEK-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Changed week start, missing days, vacation, outlier sessions, recomputed analytics, and repeated review versions remain explainable.
- AC-AIWEEK-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Review data remains private and cannot be used to rank users or make employment/education decisions.

### 6.7.5 AI Monthly Review [AIMONTH]

**Purpose.** Synthesize monthly progress, trade-offs, and strategic course corrections without overfitting short-term data.

**Actors.** Member, AI Review Service

**Priority and release.** P2; Release 3 - Expansion

**Architecture and data ownership.** Feature module owns AIReview, MonthlyEvidenceSnapshot, Theme, Suggestion. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /ai/reviews/monthly/{month}; /ai/reviews/{id}/feedback

**Validation.** The covered month and evidence snapshot are immutable per version; comparisons use equivalent periods or disclose differences.

**Edge cases.** Partial adoption month, vacations, changed goals, sparse data, deleted records, model change, and regenerated reviews preserve version history.

**Security and privacy.** The review avoids health, religious, or psychological conclusions and uses only consented aggregate or selected detail.

Functional requirements

- FR-AIMONTH-001 - The system shall enable an authorized actor to generate a monthly review from confirmed monthly plan, weekly reviews, goals, and selected tracker summaries.
- FR-AIMONTH-002 - The system shall enable an authorized actor to separate observable trends from hypotheses and disclose low sample sizes or missing periods.
- FR-AIMONTH-003 - The system shall enable an authorized actor to propose continue, stop, start, or change options for user selection rather than a single prescriptive answer.
  Acceptance criteria

- AC-AIMONTH-01 - Given an authorized actor and valid input, when the actor requests to generate a monthly review from confirmed monthly plan, weekly reviews, goals, and selected tracker summaries, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-AIMONTH-02 - Given the feature's prerequisite state, when the actor requests to separate observable trends from hypotheses and disclose low sample sizes or missing periods, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-AIMONTH-03 - Given any required supporting data or integration is available, when the actor requests to propose continue, stop, start, or change options for user selection rather than a single prescriptive answer, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-AIMONTH-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: The covered month and evidence snapshot are immutable per version; comparisons use equivalent periods or disclose differences. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-AIMONTH-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Partial adoption month, vacations, changed goals, sparse data, deleted records, model change, and regenerated reviews preserve version history.
- AC-AIMONTH-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: The review avoids health, religious, or psychological conclusions and uses only consented aggregate or selected detail.

### 6.7.6 AI Suggestions [AISUGG]

**Purpose.** Deliver timely, explainable suggestions with strict relevance, frequency, and user-control boundaries.

**Actors.** Member, AI Suggestion Service

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns Suggestion, SuggestionReason, SuggestionFeedback, SuppressionRule. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /ai/suggestions; /ai/suggestions/{id}/feedback; /ai/suggestion-settings

**Validation.** Every suggestion requires source provenance, category, expiry, action schema, and deduplication key; expired suggestions cannot execute.

**Edge cases.** Contradictory suggestions, stale context, repeated dismissal, no active goal, provider outage, and policy suppression result in silence or safe fallback.

**Security and privacy.** No dark patterns, covert persuasion, sensitive-trait targeting, or unconfirmed writes are permitted.

Functional requirements

- FR-AISUGG-001 - The system shall enable an authorized actor to produce suggestions tied to a current user objective, evidence, confidence, and expiry time.
- FR-AISUGG-002 - The system shall enable an authorized actor to let the member accept, edit, snooze, dismiss, mute a category, or explain irrelevance.
- FR-AISUGG-003 - The system shall enable an authorized actor to learn only from permitted feedback signals and enforce frequency caps and quiet contexts.
  Acceptance criteria

- AC-AISUGG-01 - Given an authorized actor and valid input, when the actor requests to produce suggestions tied to a current user objective, evidence, confidence, and expiry time, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-AISUGG-02 - Given the feature's prerequisite state, when the actor requests to let the member accept, edit, snooze, dismiss, mute a category, or explain irrelevance, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-AISUGG-03 - Given any required supporting data or integration is available, when the actor requests to learn only from permitted feedback signals and enforce frequency caps and quiet contexts, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-AISUGG-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Every suggestion requires source provenance, category, expiry, action schema, and deduplication key; expired suggestions cannot execute. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-AISUGG-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Contradictory suggestions, stale context, repeated dismissal, no active goal, provider outage, and policy suppression result in silence or safe fallback.
- AC-AISUGG-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: No dark patterns, covert persuasion, sensitive-trait targeting, or unconfirmed writes are permitted.

## 6.8 Knowledge

### 6.8.1 Knowledge Hub [KHUB]

**Purpose.** Unify notes, bookmarks, resources, reading insights, and selected learning evidence into a searchable personal knowledge space.

**Actors.** Member

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns KnowledgeItem, Collection, Tag, Link, SearchDocument. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /knowledge/items; /knowledge/collections; /knowledge/search

**Validation.** Links cannot create inaccessible cross-user references; canonical source identifiers and index versions are retained.

**Edge cases.** Deleted source, stale index, duplicate item, cyclic links, offline cache, inaccessible attachment, and empty hub show recoverable states.

**Security and privacy.** Semantic indexing is opt-in for private text and observes the same deletion and export lifecycle as source content.

Functional requirements

- FR-KHUB-001 - The system shall enable an authorized actor to browse and filter permitted knowledge items by type, tag, collection, source, and date.
- FR-KHUB-002 - The system shall enable an authorized actor to create collections and typed links between items while preserving the source of truth.
- FR-KHUB-003 - The system shall enable an authorized actor to surface related items using explainable metadata and optional semantic retrieval.
  Acceptance criteria

- AC-KHUB-01 - Given an authorized actor and valid input, when the actor requests to browse and filter permitted knowledge items by type, tag, collection, source, and date, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-KHUB-02 - Given the feature's prerequisite state, when the actor requests to create collections and typed links between items while preserving the source of truth, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-KHUB-03 - Given any required supporting data or integration is available, when the actor requests to surface related items using explainable metadata and optional semantic retrieval, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-KHUB-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Links cannot create inaccessible cross-user references; canonical source identifiers and index versions are retained. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-KHUB-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Deleted source, stale index, duplicate item, cyclic links, offline cache, inaccessible attachment, and empty hub show recoverable states.
- AC-KHUB-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Semantic indexing is opt-in for private text and observes the same deletion and export lifecycle as source content.

### 6.8.2 Technology News [NEWS]

**Purpose.** Provide a low-noise, source-transparent technology briefing aligned to selected interests.

**Actors.** Member, Content Curator

**Priority and release.** P2; Release 3 - Expansion

**Architecture and data ownership.** Feature module owns NewsSource, NewsItem, TopicPreference, ReadState. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /news; /news/sources; /news/preferences; /admin/news-sources

**Validation.** Sources require rights-compatible feeds or APIs; timestamps and canonical URLs are validated; duplicates are clustered.

**Edge cases.** Paywalls, retractions, conflicting timestamps, feed outage, duplicate syndication, unsafe links, and empty topics are disclosed.

**Security and privacy.** Summaries distinguish publisher claims from Focused-generated text; browsing behavior is not sold or used for political profiling.

Functional requirements

- FR-NEWS-001 - The system shall enable an authorized actor to select topics, sources, cadence, and exclusion preferences for a finite news briefing.
- FR-NEWS-002 - The system shall enable an authorized actor to view headline, source, publication time, summary, and external link with clear provenance.
- FR-NEWS-003 - The system shall enable an authorized actor to save, dismiss, report, or convert an item into a reading or learning resource.
  Acceptance criteria

- AC-NEWS-01 - Given an authorized actor and valid input, when the actor requests to select topics, sources, cadence, and exclusion preferences for a finite news briefing, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-NEWS-02 - Given the feature's prerequisite state, when the actor requests to view headline, source, publication time, summary, and external link with clear provenance, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-NEWS-03 - Given any required supporting data or integration is available, when the actor requests to save, dismiss, report, or convert an item into a reading or learning resource, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-NEWS-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Sources require rights-compatible feeds or APIs; timestamps and canonical URLs are validated; duplicates are clustered. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-NEWS-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Paywalls, retractions, conflicting timestamps, feed outage, duplicate syndication, unsafe links, and empty topics are disclosed.
- AC-NEWS-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Summaries distinguish publisher claims from Focused-generated text; browsing behavior is not sold or used for political profiling.

### 6.8.3 Learning Recommendations [LRECO]

**Purpose.** Recommend a small set of relevant learning resources based on explicit goals and gaps.

**Actors.** Member, AI Recommendation Service, Content Curator

**Priority and release.** P2; Release 3 - Expansion

**Architecture and data ownership.** Feature module owns Recommendation, ResourceCandidate, RecommendationReason, Feedback. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /learning/recommendations; /learning/recommendations/{id}/feedback

**Validation.** Candidates require a valid source and freshness timestamp; sponsored or affiliate relationships must be labeled; duplicate resources are collapsed.

**Edge cases.** No suitable result, inaccessible region, changed price, dead link, conflicting level, provider outage, and low confidence yield transparent alternatives.

**Security and privacy.** Recommendations do not infer sensitive traits and do not enroll, purchase, or share contact data without explicit action.

Functional requirements

- FR-LRECO-001 - The system shall enable an authorized actor to request recommendations for a declared topic, level, format, budget, language, and time constraint.
- FR-LRECO-002 - The system shall enable an authorized actor to show provenance, prerequisites, estimated effort, cost disclosure, and recommendation reasons.
- FR-LRECO-003 - The system shall enable an authorized actor to save, dismiss, report, or add a recommendation to a learning path after confirmation.
  Acceptance criteria

- AC-LRECO-01 - Given an authorized actor and valid input, when the actor requests to request recommendations for a declared topic, level, format, budget, language, and time constraint, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-LRECO-02 - Given the feature's prerequisite state, when the actor requests to show provenance, prerequisites, estimated effort, cost disclosure, and recommendation reasons, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-LRECO-03 - Given any required supporting data or integration is available, when the actor requests to save, dismiss, report, or add a recommendation to a learning path after confirmation, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-LRECO-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Candidates require a valid source and freshness timestamp; sponsored or affiliate relationships must be labeled; duplicate resources are collapsed. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-LRECO-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: No suitable result, inaccessible region, changed price, dead link, conflicting level, provider outage, and low confidence yield transparent alternatives.
- AC-LRECO-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Recommendations do not infer sensitive traits and do not enroll, purchase, or share contact data without explicit action.

### 6.8.4 Personal Notes [NOTES]

**Purpose.** Capture and retrieve lightweight knowledge without forcing journal or task semantics.

**Actors.** Member, AI only for selected notes

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns Note, NoteRevision, Tag, Attachment. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /notes; /notes/{id}/revisions; /notes/search

**Validation.** Title and body limits, optimistic concurrency, attachment scanning, and safe rich-text sanitization are enforced.

**Edge cases.** Untitled drafts, offline conflicts, large paste, failed attachment, delayed indexing, deleted link target, and restore preserve user text.

**Security and privacy.** Notes are private by default; AI processing and sharing require item-level selection.

Functional requirements

- FR-NOTES-001 - The system shall enable an authorized actor to create, autosave, edit, pin, tag, archive, search, and delete notes.
- FR-NOTES-002 - The system shall enable an authorized actor to link notes to goals, resources, calendar events, and learning items without changing linked records.
- FR-NOTES-003 - The system shall enable an authorized actor to select notes for AI summary or transformation and preview generated content before saving.
  Acceptance criteria

- AC-NOTES-01 - Given an authorized actor and valid input, when the actor requests to create, autosave, edit, pin, tag, archive, search, and delete notes, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-NOTES-02 - Given the feature's prerequisite state, when the actor requests to link notes to goals, resources, calendar events, and learning items without changing linked records, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-NOTES-03 - Given any required supporting data or integration is available, when the actor requests to select notes for AI summary or transformation and preview generated content before saving, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-NOTES-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Title and body limits, optimistic concurrency, attachment scanning, and safe rich-text sanitization are enforced. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-NOTES-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Untitled drafts, offline conflicts, large paste, failed attachment, delayed indexing, deleted link target, and restore preserve user text.
- AC-NOTES-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Notes are private by default; AI processing and sharing require item-level selection.

### 6.8.5 Bookmarks [BOOK]

**Purpose.** Save, organize, and revisit external links with durable metadata and user-owned notes.

**Actors.** Member

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns Bookmark, BookmarkMetadata, Tag, Collection. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /bookmarks; /bookmarks/{id}/metadata; /bookmarks/imports

**Validation.** Only approved URL schemes are accepted; credentials and tracking parameters are stripped where safe; metadata is sanitized.

**Edge cases.** Redirect chains, dead links, duplicate canonical URLs, intranet URLs, metadata timeout, malicious pages, and offline saves remain controlled.

**Security and privacy.** The server prevents SSRF and does not send private bookmark content to AI without consent.

Functional requirements

- FR-BOOK-001 - The system shall enable an authorized actor to save a normalized URL with optional title, notes, tags, collection, and reminder.
- FR-BOOK-002 - The system shall enable an authorized actor to fetch safe metadata asynchronously and show source/failure state without blocking save.
- FR-BOOK-003 - The system shall enable an authorized actor to deduplicate or intentionally retain variants and import/export common bookmark formats.
  Acceptance criteria

- AC-BOOK-01 - Given an authorized actor and valid input, when the actor requests to save a normalized URL with optional title, notes, tags, collection, and reminder, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-BOOK-02 - Given the feature's prerequisite state, when the actor requests to fetch safe metadata asynchronously and show source/failure state without blocking save, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-BOOK-03 - Given any required supporting data or integration is available, when the actor requests to deduplicate or intentionally retain variants and import/export common bookmark formats, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-BOOK-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Only approved URL schemes are accepted; credentials and tracking parameters are stripped where safe; metadata is sanitized. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-BOOK-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Redirect chains, dead links, duplicate canonical URLs, intranet URLs, metadata timeout, malicious pages, and offline saves remain controlled.
- AC-BOOK-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: The server prevents SSRF and does not send private bookmark content to AI without consent.

### 6.8.6 Resources [RES]

**Purpose.** Maintain a curated, typed inventory of files, links, courses, tools, and references used by plans and learning.

**Actors.** Member, Content Curator

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns Resource, ResourceType, ResourceVersion, Attachment. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /resources; /resources/{id}/versions; /admin/resource-catalog

**Validation.** Files are scanned and size/type limited; URLs are normalized; catalog resources require attribution and licensing metadata.

**Edge cases.** Version changes, dead links, duplicate files, storage quota, offline access, revoked license, and deleted attachments show provenance and recovery.

**Security and privacy.** Private resources remain user-scoped; catalog curation cannot expose member uploads.

Functional requirements

- FR-RES-001 - The system shall enable an authorized actor to create and organize personal resources with type, source, tags, status, and optional attachment.
- FR-RES-002 - The system shall enable an authorized actor to link a resource to goals, learning paths, notes, and reading items with usage context.
- FR-RES-003 - The system shall enable an authorized actor to review stale, unavailable, or duplicate resources and replace links without losing references.
  Acceptance criteria

- AC-RES-01 - Given an authorized actor and valid input, when the actor requests to create and organize personal resources with type, source, tags, status, and optional attachment, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-RES-02 - Given the feature's prerequisite state, when the actor requests to link a resource to goals, learning paths, notes, and reading items with usage context, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-RES-03 - Given any required supporting data or integration is available, when the actor requests to review stale, unavailable, or duplicate resources and replace links without losing references, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-RES-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Files are scanned and size/type limited; URLs are normalized; catalog resources require attribution and licensing metadata. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-RES-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Version changes, dead links, duplicate files, storage quota, offline access, revoked license, and deleted attachments show provenance and recovery.
- AC-RES-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Private resources remain user-scoped; catalog curation cannot expose member uploads.

### 6.8.7 Unified Search [SEARCH]

**Purpose.** Find authorized content across Focused quickly without leaking existence or snippets from private objects.

**Actors.** Member, Administrator within administrative scope

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns SearchDocument, SearchQuery, SearchIndexCursor. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /search; /search/suggestions

**Validation.** Queries are length/rate limited and sanitized; index records carry owner, visibility, source version, and deletion tombstone.

**Edge cases.** Index lag, zero results, misspelling, deleted item, offline state, disabled semantic search, and partial service failure do not leak data.

**Security and privacy.** Search logs minimize sensitive query text and use short retention; administrators cannot search user-private content.

Functional requirements

- FR-SEARCH-001 - The system shall enable an authorized actor to search across enabled object types with filters, keyboard navigation, and highlighted matching context.
- FR-SEARCH-002 - The system shall enable an authorized actor to respect per-object authorization before ranking, counting, suggesting, or returning snippets.
- FR-SEARCH-003 - The system shall enable an authorized actor to support exact, prefix, and optional semantic retrieval with clear result-type and source labels.
  Acceptance criteria

- AC-SEARCH-01 - Given an authorized actor and valid input, when the actor requests to search across enabled object types with filters, keyboard navigation, and highlighted matching context, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-SEARCH-02 - Given the feature's prerequisite state, when the actor requests to respect per-object authorization before ranking, counting, suggesting, or returning snippets, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-SEARCH-03 - Given any required supporting data or integration is available, when the actor requests to support exact, prefix, and optional semantic retrieval with clear result-type and source labels, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-SEARCH-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Queries are length/rate limited and sanitized; index records carry owner, visibility, source version, and deletion tombstone. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-SEARCH-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Index lag, zero results, misspelling, deleted item, offline state, disabled semantic search, and partial service failure do not leak data.
- AC-SEARCH-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Search logs minimize sensitive query text and use short retention; administrators cannot search user-private content.

## 6.9 Analytics

### 6.9.1 Focus Analytics [FANL]

**Purpose.** Convert trustworthy focus-session and plan data into understandable trends and decisions.

**Actors.** Member

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns FocusMetric, AggregateSnapshot, AnalyticsFilter. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /analytics/focus; /analytics/focus/exports

**Validation.** Every metric has a versioned definition; running and invalidated sessions are excluded or labeled; aggregation uses the user's historical time zone per event.

**Edge cases.** Sparse data, corrected sessions, time-zone travel, long-running timer, deleted goal, cached aggregate, and comparison periods remain explainable.

**Security and privacy.** Analytics are private and avoid ranking or moral labels; private text is not required for calculation.

Functional requirements

- FR-FANL-001 - The system shall enable an authorized actor to view focused minutes, completed sessions, planned-versus-actual time, consistency, and outcome rates by selectable period.
- FR-FANL-002 - The system shall enable an authorized actor to filter by goal, project, tag, session type, and local-time grouping with metric definitions available in context.
- FR-FANL-003 - The system shall enable an authorized actor to drill from an aggregate to authorized source records and see data freshness and excluded records.
  Acceptance criteria

- AC-FANL-01 - Given an authorized actor and valid input, when the actor requests to view focused minutes, completed sessions, planned-versus-actual time, consistency, and outcome rates by selectable period, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-FANL-02 - Given the feature's prerequisite state, when the actor requests to filter by goal, project, tag, session type, and local-time grouping with metric definitions available in context, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-FANL-03 - Given any required supporting data or integration is available, when the actor requests to drill from an aggregate to authorized source records and see data freshness and excluded records, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-FANL-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Every metric has a versioned definition; running and invalidated sessions are excluded or labeled; aggregation uses the user's historical time zone per event. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-FANL-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Sparse data, corrected sessions, time-zone travel, long-running timer, deleted goal, cached aggregate, and comparison periods remain explainable.
- AC-FANL-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Analytics are private and avoid ranking or moral labels; private text is not required for calculation.

### 6.9.2 Distraction Analytics [DANL]

**Purpose.** Help users recognize interruption patterns without surveillance or shame.

**Actors.** Member

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns Interruption, DistractionCategory, DistractionMetric, TriggerContext. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /distractions; /analytics/distractions; /distraction-categories

**Validation.** Categories may be custom; durations are optional and bounded; correlations disclose sample size and never imply causation.

**Edge cases.** Uncategorized interruptions, multiple causes, forgotten timer, outliers, deleted sessions, sparse weeks, and offline entries remain valid.

**Security and privacy.** No covert app, browser, microphone, camera, or keystroke surveillance; any device-level telemetry requires separate explicit opt-in.

Functional requirements

- FR-DANL-001 - The system shall enable an authorized actor to record user-defined interruption categories, trigger context, duration estimate, and recovery action.
- FR-DANL-002 - The system shall enable an authorized actor to view frequency, timing, self-reported trigger, and recovery trends using clear sample sizes.
- FR-DANL-003 - The system shall enable an authorized actor to convert an observed pattern into an optional experiment, reminder, or environment change.
  Acceptance criteria

- AC-DANL-01 - Given an authorized actor and valid input, when the actor requests to record user-defined interruption categories, trigger context, duration estimate, and recovery action, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-DANL-02 - Given the feature's prerequisite state, when the actor requests to view frequency, timing, self-reported trigger, and recovery trends using clear sample sizes, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-DANL-03 - Given any required supporting data or integration is available, when the actor requests to convert an observed pattern into an optional experiment, reminder, or environment change, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-DANL-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Categories may be custom; durations are optional and bounded; correlations disclose sample size and never imply causation. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-DANL-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Uncategorized interruptions, multiple causes, forgotten timer, outliers, deleted sessions, sparse weeks, and offline entries remain valid.
- AC-DANL-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: No covert app, browser, microphone, camera, or keystroke surveillance; any device-level telemetry requires separate explicit opt-in.

### 6.9.3 Progress Reports [REPORT]

**Purpose.** Create understandable periodic summaries of selected goals, focus, habits, learning, and wellbeing signals.

**Actors.** Member

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns ReportDefinition, ReportSnapshot, ReportSection, ShareGrant. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /reports; /reports/{id}/generate; /reports/{id}/snapshots

**Validation.** Periods and comparisons must be valid; every included field has a source and authorization check; generated snapshots are versioned.

**Edge cases.** Partial data, stale aggregates, deleted source, large period, failed section, revoked share, and time-zone boundary produce accurate disclosures.

**Security and privacy.** Private journal, mood, faith, sleep, and prayer data are excluded by default and require explicit per-report inclusion.

Functional requirements

- FR-REPORT-001 - The system shall enable an authorized actor to configure report period, sections, comparison baseline, and inclusion of private narrative fields.
- FR-REPORT-002 - The system shall enable an authorized actor to generate an immutable snapshot with metric definitions, source freshness, and missing-data disclosures.
- FR-REPORT-003 - The system shall enable an authorized actor to view, regenerate as a new version, or create a time-limited share artifact after preview.
  Acceptance criteria

- AC-REPORT-01 - Given an authorized actor and valid input, when the actor requests to configure report period, sections, comparison baseline, and inclusion of private narrative fields, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-REPORT-02 - Given the feature's prerequisite state, when the actor requests to generate an immutable snapshot with metric definitions, source freshness, and missing-data disclosures, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-REPORT-03 - Given any required supporting data or integration is available, when the actor requests to view, regenerate as a new version, or create a time-limited share artifact after preview, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-REPORT-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Periods and comparisons must be valid; every included field has a source and authorization check; generated snapshots are versioned. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-REPORT-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Partial data, stale aggregates, deleted source, large period, failed section, revoked share, and time-zone boundary produce accurate disclosures.
- AC-REPORT-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Private journal, mood, faith, sleep, and prayer data are excluded by default and require explicit per-report inclusion.

### 6.9.4 Export Reports and Data [EXPORT]

**Purpose.** Give members portable, secure exports for reports and account data.

**Actors.** Member, Auditor for platform audit exports

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns ExportJob, ExportArtifact, ExportManifest. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /exports; /exports/{id}; /reports/{id}/exports

**Validation.** Formats have versioned schemas; exports use snapshot isolation; filenames are safe; artifacts expire and cannot be guessed.

**Edge cases.** Large datasets, partial module failure, cancellation, expired link, regeneration, deletion in progress, and locale-specific formatting remain unambiguous.

**Security and privacy.** Exports include only authorized data, omit secrets, disclose redactions, and are encrypted at rest and in transit.

Functional requirements

- FR-EXPORT-001 - The system shall enable an authorized actor to request CSV, JSON, and human-readable PDF or equivalent exports for supported scopes and date ranges.
- FR-EXPORT-002 - The system shall enable an authorized actor to process large exports asynchronously and expose queued, running, completed, failed, expired, and cancelled states.
- FR-EXPORT-003 - The system shall enable an authorized actor to download a checksum-labeled, time-limited artifact after re-authentication when sensitivity warrants.
  Acceptance criteria

- AC-EXPORT-01 - Given an authorized actor and valid input, when the actor requests to request CSV, JSON, and human-readable PDF or equivalent exports for supported scopes and date ranges, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-EXPORT-02 - Given the feature's prerequisite state, when the actor requests to process large exports asynchronously and expose queued, running, completed, failed, expired, and cancelled states, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-EXPORT-03 - Given any required supporting data or integration is available, when the actor requests to download a checksum-labeled, time-limited artifact after re-authentication when sensitivity warrants, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-EXPORT-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Formats have versioned schemas; exports use snapshot isolation; filenames are safe; artifacts expire and cannot be guessed. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-EXPORT-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Large datasets, partial module failure, cancellation, expired link, regeneration, deletion in progress, and locale-specific formatting remain unambiguous.
- AC-EXPORT-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Exports include only authorized data, omit secrets, disclose redactions, and are encrypted at rest and in transit.

## 6.10 Gamification

### 6.10.1 Achievements [ACH]

**Purpose.** Recognize meaningful milestones without encouraging unhealthy use or manipulative comparison.

**Actors.** Member, Administrator (definition management)

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns AchievementDefinition, AchievementAward, AwardProgress. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /achievements; /achievements/awards; /admin/achievement-definitions

**Validation.** Definitions are versioned, criteria are machine-testable, and retroactive evaluation is explicit; awards cannot be duplicated.

**Edge cases.** Corrected events, retired definitions, backfill, time-zone changes, hidden gamification, and event replay preserve award integrity.

**Security and privacy.** Achievements never disclose sensitive activity or punish users; no pay-to-win criteria.

Functional requirements

- FR-ACH-001 - The system shall enable an authorized actor to view locked, in-progress, and earned achievements with transparent criteria and earned time.
- FR-ACH-002 - The system shall enable an authorized actor to award an achievement once from verified domain events using idempotent evaluation.
- FR-ACH-003 - The system shall enable an authorized actor to allow members to hide achievement surfaces while retaining underlying productivity data.
  Acceptance criteria

- AC-ACH-01 - Given an authorized actor and valid input, when the actor requests to view locked, in-progress, and earned achievements with transparent criteria and earned time, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-ACH-02 - Given the feature's prerequisite state, when the actor requests to award an achievement once from verified domain events using idempotent evaluation, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-ACH-03 - Given any required supporting data or integration is available, when the actor requests to allow members to hide achievement surfaces while retaining underlying productivity data, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-ACH-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Definitions are versioned, criteria are machine-testable, and retroactive evaluation is explicit; awards cannot be duplicated. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-ACH-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Corrected events, retired definitions, backfill, time-zone changes, hidden gamification, and event replay preserve award integrity.
- AC-ACH-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Achievements never disclose sensitive activity or punish users; no pay-to-win criteria.

### 6.10.2 XP System [XP]

**Purpose.** Provide optional progress feedback tied to intentional actions rather than raw screen time.

**Actors.** Member, Administrator (rules)

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns XpRule, XpLedgerEntry, XpBalance. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /gamification/xp; /gamification/xp/ledger; /admin/xp-rules

**Validation.** Every ledger entry has a unique source event and rule version; daily caps and anti-abuse limits are enforced; balances derive from the ledger.

**Edge cases.** Event replay, deleted activity, rule change, offline sync, negative adjustment, cap crossing, and migration cannot corrupt balance.

**Security and privacy.** No XP loss for rest, missed habits, prayer, mood, sleep, or disability-related behavior; XP cannot buy access or status.

Functional requirements

- FR-XP-001 - The system shall enable an authorized actor to earn XP from allow-listed verified events with visible rule, amount, source, and timestamp.
- FR-XP-002 - The system shall enable an authorized actor to reverse or adjust XP through compensating immutable ledger entries when source data changes.
- FR-XP-003 - The system shall enable an authorized actor to view an understandable balance and recent ledger while opting out of XP presentation.
  Acceptance criteria

- AC-XP-01 - Given an authorized actor and valid input, when the actor requests to earn XP from allow-listed verified events with visible rule, amount, source, and timestamp, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-XP-02 - Given the feature's prerequisite state, when the actor requests to reverse or adjust XP through compensating immutable ledger entries when source data changes, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-XP-03 - Given any required supporting data or integration is available, when the actor requests to view an understandable balance and recent ledger while opting out of XP presentation, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-XP-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Every ledger entry has a unique source event and rule version; daily caps and anti-abuse limits are enforced; balances derive from the ledger. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-XP-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Event replay, deleted activity, rule change, offline sync, negative adjustment, cap crossing, and migration cannot corrupt balance.
- AC-XP-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: No XP loss for rest, missed habits, prayer, mood, sleep, or disability-related behavior; XP cannot buy access or status.

### 6.10.3 Levels [LEVEL]

**Purpose.** Translate optional XP into stable, understandable milestones with no functional disadvantage.

**Actors.** Member, Administrator (definitions)

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns LevelDefinition, UserLevel, LevelTransition. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /gamification/levels; /users/me/level; /admin/level-definitions

**Validation.** Thresholds are strictly increasing, non-overlapping, versioned, and derived from non-negative qualifying XP.

**Edge cases.** XP reversal, threshold migration, event replay, opt-out, retired levels, and maximum level have explicit behavior.

**Security and privacy.** Levels are cosmetic and private by default; they do not gate core productivity features.

Functional requirements

- FR-LEVEL-001 - The system shall enable an authorized actor to view current level, threshold range, and next-level progress based on the XP ledger.
- FR-LEVEL-002 - The system shall enable an authorized actor to advance levels deterministically and record transition events without duplicate rewards.
- FR-LEVEL-003 - The system shall enable an authorized actor to preserve historical level labels when definitions are revised or retired.
  Acceptance criteria

- AC-LEVEL-01 - Given an authorized actor and valid input, when the actor requests to view current level, threshold range, and next-level progress based on the XP ledger, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-LEVEL-02 - Given the feature's prerequisite state, when the actor requests to advance levels deterministically and record transition events without duplicate rewards, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-LEVEL-03 - Given any required supporting data or integration is available, when the actor requests to preserve historical level labels when definitions are revised or retired, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-LEVEL-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Thresholds are strictly increasing, non-overlapping, versioned, and derived from non-negative qualifying XP. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-LEVEL-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: XP reversal, threshold migration, event replay, opt-out, retired levels, and maximum level have explicit behavior.
- AC-LEVEL-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Levels are cosmetic and private by default; they do not gate core productivity features.

### 6.10.4 Streaks [STREAK]

**Purpose.** Visualize consistency using schedule-aware, pause-aware rules and compassionate recovery.

**Actors.** Member

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns StreakDefinition, StreakState, StreakOccurrence, StreakPause. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /streaks; /streaks/{id}/history

**Validation.** Each streak has a versioned definition and one result per eligible occurrence; backfill limits and pause rules are explicit.

**Edge cases.** Travel, daylight-saving change, illness pause, schedule edit, corrected event, offline sync, and grace-period boundary recalculate deterministically.

**Security and privacy.** No streaks for sensitive faith, mood, sleep, or health behavior by default; no shame, threat, or monetary pressure.

Functional requirements

- FR-STREAK-001 - The system shall enable an authorized actor to show current, best, and recent consistency for eligible habits, planning, and focus definitions.
- FR-STREAK-002 - The system shall enable an authorized actor to calculate occurrences from the source schedule, local date, grace rules, and approved pauses.
- FR-STREAK-003 - The system shall enable an authorized actor to explain exactly why a streak continued, paused, reset, or was recalculated.
  Acceptance criteria

- AC-STREAK-01 - Given an authorized actor and valid input, when the actor requests to show current, best, and recent consistency for eligible habits, planning, and focus definitions, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-STREAK-02 - Given the feature's prerequisite state, when the actor requests to calculate occurrences from the source schedule, local date, grace rules, and approved pauses, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-STREAK-03 - Given any required supporting data or integration is available, when the actor requests to explain exactly why a streak continued, paused, reset, or was recalculated, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-STREAK-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Each streak has a versioned definition and one result per eligible occurrence; backfill limits and pause rules are explicit. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-STREAK-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Travel, daylight-saving change, illness pause, schedule edit, corrected event, offline sync, and grace-period boundary recalculate deterministically.
- AC-STREAK-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: No streaks for sensitive faith, mood, sleep, or health behavior by default; no shame, threat, or monetary pressure.

### 6.10.5 Gamification Controls [GAME]

**Purpose.** Make motivation systems coherent, optional, transparent, and subordinate to healthy focus.

**Actors.** Member, Administrator

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns GamificationPreference, RewardRule, RewardEvent. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /gamification/preferences; /admin/gamification-rules

**Validation.** Opt-out must not delete source data or remove core function; reward rules require approval, effective dates, and rollback metadata.

**Edge cases.** Preference changes mid-event, rule rollback, duplicate events, reduced-motion mode, minors policy if introduced, and experiments remain safe.

**Security and privacy.** No dark patterns, loot boxes, variable-ratio monetary rewards, public shaming, or productivity access tied to engagement.

Functional requirements

- FR-GAME-001 - The system shall enable an authorized actor to enable or disable XP, levels, achievements, celebrations, streak emphasis, and challenge visibility independently.
- FR-GAME-002 - The system shall enable an authorized actor to apply rule versions consistently across event-driven rewards and expose plain-language criteria.
- FR-GAME-003 - The system shall enable an authorized actor to enforce quiet celebrations, reduced motion, frequency caps, and wellbeing guardrails.
  Acceptance criteria

- AC-GAME-01 - Given an authorized actor and valid input, when the actor requests to enable or disable XP, levels, achievements, celebrations, streak emphasis, and challenge visibility independently, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-GAME-02 - Given the feature's prerequisite state, when the actor requests to apply rule versions consistently across event-driven rewards and expose plain-language criteria, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-GAME-03 - Given any required supporting data or integration is available, when the actor requests to enforce quiet celebrations, reduced motion, frequency caps, and wellbeing guardrails, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-GAME-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Opt-out must not delete source data or remove core function; reward rules require approval, effective dates, and rollback metadata. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-GAME-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Preference changes mid-event, rule rollback, duplicate events, reduced-motion mode, minors policy if introduced, and experiments remain safe.
- AC-GAME-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: No dark patterns, loot boxes, variable-ratio monetary rewards, public shaming, or productivity access tied to engagement.

### 6.10.6 Challenges [CHALL]

**Purpose.** Offer time-bounded personal challenges that reinforce deliberate behaviors without coercion.

**Actors.** Member, Administrator/Content Curator

**Priority and release.** P2; Release 3 - Expansion

**Architecture and data ownership.** Feature module owns ChallengeDefinition, ChallengeEnrollment, ChallengeProgress. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /challenges; /challenges/{id}/enrollments; /admin/challenges

**Validation.** Definitions have start/end, eligibility, metric, cap, and rule version; enrollment is explicit; progress cannot use retroactive events unless disclosed.

**Edge cases.** Late enrollment, time-zone boundary, corrected events, withdrawal, expired challenge, rule cancellation, and duplicate completion are deterministic.

**Security and privacy.** Initial scope is private/personal; social competition, wagering, and public leaderboards are excluded.

Functional requirements

- FR-CHALL-001 - The system shall enable an authorized actor to browse eligibility, criteria, duration, privacy, and reward terms before voluntarily enrolling.
- FR-CHALL-002 - The system shall enable an authorized actor to track progress from verified events and withdraw at any time without penalty.
- FR-CHALL-003 - The system shall enable an authorized actor to complete a personal challenge and receive idempotent recognition under the enrolled rule version.
  Acceptance criteria

- AC-CHALL-01 - Given an authorized actor and valid input, when the actor requests to browse eligibility, criteria, duration, privacy, and reward terms before voluntarily enrolling, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-CHALL-02 - Given the feature's prerequisite state, when the actor requests to track progress from verified events and withdraw at any time without penalty, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-CHALL-03 - Given any required supporting data or integration is available, when the actor requests to complete a personal challenge and receive idempotent recognition under the enrolled rule version, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-CHALL-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Definitions have start/end, eligibility, metric, cap, and rule version; enrollment is explicit; progress cannot use retroactive events unless disclosed. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-CHALL-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Late enrollment, time-zone boundary, corrected events, withdrawal, expired challenge, rule cancellation, and duplicate completion are deterministic.
- AC-CHALL-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Initial scope is private/personal; social competition, wagering, and public leaderboards are excluded.

## 6.11 Engagement

### 6.11.1 Notifications [NOTIF]

**Purpose.** Deliver relevant, consented information through in-app, push, and future channels with a unified preference model.

**Actors.** Member, System

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns Notification, NotificationPreference, DeliveryAttempt, DeviceSubscription. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /notifications; /notification-preferences; /push-subscriptions

**Validation.** Every delivery has category, recipient, deduplication key, expiry, locale, and preference snapshot; revoked endpoints are removed.

**Edge cases.** Permission denial, expired subscription, provider outage, duplicate worker, quiet-hours crossing, time-zone change, and stale deep link fail gracefully.

**Security and privacy.** Notification previews minimize sensitive text; security alerts may override batching but not unsafe lock-screen disclosure.

Functional requirements

- FR-NOTIF-001 - The system shall enable an authorized actor to view, mark read/unread, archive, and deep-link from an in-app notification center.
- FR-NOTIF-002 - The system shall enable an authorized actor to grant or revoke channel permission and configure category, cadence, quiet hours, batching, and accessibility modality.
- FR-NOTIF-003 - The system shall enable an authorized actor to deliver push notifications with deduplication, expiry, retry policy, and safe lock-screen content.
  Acceptance criteria

- AC-NOTIF-01 - Given an authorized actor and valid input, when the actor requests to view, mark read/unread, archive, and deep-link from an in-app notification center, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-NOTIF-02 - Given the feature's prerequisite state, when the actor requests to grant or revoke channel permission and configure category, cadence, quiet hours, batching, and accessibility modality, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-NOTIF-03 - Given any required supporting data or integration is available, when the actor requests to deliver push notifications with deduplication, expiry, retry policy, and safe lock-screen content, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-NOTIF-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Every delivery has category, recipient, deduplication key, expiry, locale, and preference snapshot; revoked endpoints are removed. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-NOTIF-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Permission denial, expired subscription, provider outage, duplicate worker, quiet-hours crossing, time-zone change, and stale deep link fail gracefully.
- AC-NOTIF-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Notification previews minimize sensitive text; security alerts may override batching but not unsafe lock-screen disclosure.

### 6.11.2 Reminder Engine [REM]

**Purpose.** Schedule reliable one-time and recurring reminders with explainable timing and delivery state.

**Actors.** Member, System

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns Reminder, ReminderSchedule, ReminderOccurrence, DeliveryPolicy. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /reminders; /reminders/{id}/occurrences; /reminders/{id}/snooze

**Validation.** Recurrence is bounded and RFC-compatible where exposed; every occurrence has a unique key; past dates and invalid local times require resolution.

**Edge cases.** Daylight-saving gaps/folds, travel, device offline, worker replay, edited recurrence, missed occurrence, and revoked channel are deterministic.

**Security and privacy.** Reminders are private and frequency-capped; deleting a source object cancels or detaches reminders according to explicit user choice.

Functional requirements

- FR-REM-001 - The system shall enable an authorized actor to create, edit, pause, resume, snooze, complete, and delete one-time or recurring reminders.
- FR-REM-002 - The system shall enable an authorized actor to resolve occurrences from canonical time zone, recurrence, quiet hours, channel availability, and missed-delivery policy.
- FR-REM-003 - The system shall enable an authorized actor to show next occurrence, last outcome, and delivery failures without duplicating notifications.
  Acceptance criteria

- AC-REM-01 - Given an authorized actor and valid input, when the actor requests to create, edit, pause, resume, snooze, complete, and delete one-time or recurring reminders, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-REM-02 - Given the feature's prerequisite state, when the actor requests to resolve occurrences from canonical time zone, recurrence, quiet hours, channel availability, and missed-delivery policy, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-REM-03 - Given any required supporting data or integration is available, when the actor requests to show next occurrence, last outcome, and delivery failures without duplicating notifications, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-REM-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Recurrence is bounded and RFC-compatible where exposed; every occurrence has a unique key; past dates and invalid local times require resolution. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-REM-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Daylight-saving gaps/folds, travel, device offline, worker replay, edited recurrence, missed occurrence, and revoked channel are deterministic.
- AC-REM-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Reminders are private and frequency-capped; deleting a source object cancels or detaches reminders according to explicit user choice.

### 6.11.3 AI Smart Reminder [AIREM]

**Purpose.** Suggest context-sensitive reminder timing while preserving a predictable user-approved schedule.

**Actors.** Member, AI Suggestion Service

**Priority and release.** P1; Release 2 - Integrated Growth

**Architecture and data ownership.** Feature module owns SmartReminderProposal, Reminder, TimingReason, Feedback. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /ai/reminder-proposals; /ai/reminder-proposals/{id}/decision

**Validation.** Proposals expire, are deduplicated, use structured timing constraints, and never become reminders without explicit or preconfigured scoped approval.

**Edge cases.** No useful context, calendar outage, time-zone change, repeated dismissal, low confidence, conflicting reminders, and AI outage fall back to manual scheduling.

**Security and privacy.** Smart reminders cannot infer sensitive contexts or reveal private content on shared devices.

Functional requirements

- FR-AIREM-001 - The system shall enable an authorized actor to propose reminder time, channel, and wording from selected task urgency, schedule, habits, and prior feedback.
- FR-AIREM-002 - The system shall enable an authorized actor to show the reason, confidence, source scopes, quiet-hours impact, and alternative times before creation.
- FR-AIREM-003 - The system shall enable an authorized actor to learn from snooze, dismiss, and completion feedback within consent and frequency limits.
  Acceptance criteria

- AC-AIREM-01 - Given an authorized actor and valid input, when the actor requests to propose reminder time, channel, and wording from selected task urgency, schedule, habits, and prior feedback, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-AIREM-02 - Given the feature's prerequisite state, when the actor requests to show the reason, confidence, source scopes, quiet-hours impact, and alternative times before creation, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-AIREM-03 - Given any required supporting data or integration is available, when the actor requests to learn from snooze, dismiss, and completion feedback within consent and frequency limits, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-AIREM-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Proposals expire, are deduplicated, use structured timing constraints, and never become reminders without explicit or preconfigured scoped approval. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-AIREM-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: No useful context, calendar outage, time-zone change, repeated dismissal, low confidence, conflicting reminders, and AI outage fall back to manual scheduling.
- AC-AIREM-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Smart reminders cannot infer sensitive contexts or reveal private content on shared devices.

## 6.12 Administration

### 6.12.1 Admin Panel [ADMIN]

**Purpose.** Enable safe platform operation without granting routine access to members' private content.

**Actors.** Support Administrator, Platform Administrator, Content Curator, Auditor

**Priority and release.** P0; Release 1 - Core FocusOS

**Architecture and data ownership.** Feature module owns AdminUserView, RoleAssignment, ModerationCase, FeatureFlag, AuditEvent, SystemHealth. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /admin/users; /admin/roles; /admin/content; /admin/feature-flags; /admin/audit; /admin/health

**Validation.** Every privileged action requires server-side authorization, reason, actor, target, correlation ID, and audit event; dangerous actions require step-up or dual control.

**Edge cases.** Concurrent admins, self-role escalation, last-admin removal, locked account, partial failure, stale flag, audit outage, and mistaken action use fail-safe or compensating workflows.

**Security and privacy.** Private journal, notes, mood, faith, health, and AI conversations are unavailable to routine admins; break-glass access is out of initial scope and would require formal governance.

Functional requirements

- FR-ADMIN-001 - The system shall enable an authorized actor to search minimal account metadata, change allowed status fields, and execute documented support workflows with reason codes.
- FR-ADMIN-002 - The system shall enable an authorized actor to manage roles, curated sources, configuration, feature flags, and policy-backed moderation through least privilege.
- FR-ADMIN-003 - The system shall enable an authorized actor to review immutable audit events and operational health while exporting only authorized administrative evidence.
  Acceptance criteria

- AC-ADMIN-01 - Given an authorized actor and valid input, when the actor requests to search minimal account metadata, change allowed status fields, and execute documented support workflows with reason codes, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-ADMIN-02 - Given the feature's prerequisite state, when the actor requests to manage roles, curated sources, configuration, feature flags, and policy-backed moderation through least privilege, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-ADMIN-03 - Given any required supporting data or integration is available, when the actor requests to review immutable audit events and operational health while exporting only authorized administrative evidence, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-ADMIN-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Every privileged action requires server-side authorization, reason, actor, target, correlation ID, and audit event; dangerous actions require step-up or dual control. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-ADMIN-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Concurrent admins, self-role escalation, last-admin removal, locked account, partial failure, stale flag, audit outage, and mistaken action use fail-safe or compensating workflows.
- AC-ADMIN-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: Private journal, notes, mood, faith, health, and AI conversations are unavailable to routine admins; break-glass access is out of initial scope and would require formal governance.

## 6.13 Future Platform

### 6.13.1 Future AI Agent Support [AGENT]

**Purpose.** Prepare bounded, observable, reversible task automation without granting open-ended autonomous authority.

**Actors.** Member, Approved Agent Runtime, Platform Administrator

**Priority and release.** P3; Research / post-validation

**Architecture and data ownership.** Feature module owns AgentDefinition, CapabilityGrant, AgentRun, ToolCall, Approval, RunEvent. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.

**REST API surface.** /agents; /agents/{id}/runs; /agent-runs/{id}/approvals; /agent-tools

**Validation.** Capability grants are deny-by-default, short-lived, least-privilege, and bound to a user and run; external writes require idempotency and approval policy.

**Edge cases.** Prompt injection, tool outage, partial side effect, duplicate callback, runaway loop, revoked consent, cost exhaustion, and user interruption terminate or pause safely.

**Security and privacy.** No unrestricted shell/browser/email/calendar authority; agents cannot expand their own permissions or conceal actions.

Functional requirements

- FR-AGENT-001 - The system shall enable an authorized actor to define an agent objective, allowed tools, data scopes, budget, time limit, and approval policy.
- FR-AGENT-002 - The system shall enable an authorized actor to execute a durable run with plan, step events, tool-call validation, human approval gates, cancellation, and resumability.
- FR-AGENT-003 - The system shall enable an authorized actor to present a complete audit trail, outputs, side effects, costs, failures, and compensating actions.
  Acceptance criteria

- AC-AGENT-01 - Given an authorized actor and valid input, when the actor requests to define an agent objective, allowed tools, data scopes, budget, time limit, and approval policy, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.
- AC-AGENT-02 - Given the feature's prerequisite state, when the actor requests to execute a durable run with plan, step events, tool-call validation, human approval gates, cancellation, and resumability, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.
- AC-AGENT-03 - Given any required supporting data or integration is available, when the actor requests to present a complete audit trail, outputs, side effects, costs, failures, and compensating actions, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.
- AC-AGENT-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: Capability grants are deny-by-default, short-lived, least-privilege, and bound to a user and run; external writes require idempotency and approval policy. It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.
- AC-AGENT-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: Prompt injection, tool outage, partial side effect, duplicate callback, runaway loop, revoked consent, cost exhaustion, and user interruption terminate or pause safely.
- AC-AGENT-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: No unrestricted shell/browser/email/calendar authority; agents cannot expand their own permissions or conceal actions.

---

# 7. User Stories

Stories express user value and are traceability aids. Acceptance is governed by the linked functional, business, and quality requirements, not by the story sentence alone.

| ID     | Persona | Story                                                                                                                                        | Feature links                              |
| ------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| US-001 | P-01    | As a member, I want a calm dashboard with today's next action so that I can begin without surveying every module.                            | DASH, DAILY                                |
| US-002 | P-01    | As a member, I want to commit to no more than three primary daily outcomes so that planning forces meaningful trade-offs.                    | DAILY                                      |
| US-003 | P-01    | As a member, I want a timer to recover correctly after sleep or reconnect so that my focus history is trustworthy.                           | DEEP, POMO                                 |
| US-004 | P-04    | As a member, I want goals linked across yearly, monthly, weekly, and daily horizons so that today's work serves long-term outcomes.          | GOAL, YEARPLAN, MONTHPLAN, WEEKPLAN, DAILY |
| US-005 | P-04    | As a member, I want scheduling proposals to respect locked events and buffers so that accepting a plan does not create conflicts.            | SMARTSCHED, CAL                            |
| US-006 | P-02    | As a learner, I want to organize skills, resources, practice, and evidence so that progress means more than time spent.                      | LEARN, KHUB, RES                           |
| US-007 | P-03    | As a developer, I want to track problem patterns and review dates so that practice targets weak areas.                                       | LC, PROG                                   |
| US-008 | P-03    | As a developer, I want private repositories excluded unless I select them so that mentoring does not expose source code.                     | PROG, AIMENTOR                             |
| US-009 | P-05    | As a member, I want prayer times to disclose method and location basis so that I can judge whether they fit my practice.                     | PRAYER                                     |
| US-010 | P-05    | As a member, I want Quran progress to use valid references without competitive ranking so that tracking remains respectful.                  | QURAN                                      |
| US-011 | P-06    | As a member, I want to pause a habit during illness without losing historical meaning so that recovery is not treated as failure.            | HABIT, STREAK                              |
| US-012 | P-06    | As a member, I want mood and sleep trends clearly labeled as observations so that the product does not diagnose me.                          | MOOD, SLEEP                                |
| US-013 | P-06    | As a member, I want my journal private from routine administrators and AI by default so that I can write honestly.                           | JOURNAL                                    |
| US-014 | P-07    | As a keyboard and screen-reader user, I want every timer and planning workflow operable without a pointer so that I have equivalent control. | A11Y, DEEP, DAILY                          |
| US-015 | P-07    | As a member, I want reduced motion and non-audio timer cues so that celebrations and alerts remain usable.                                   | A11Y, GAME, NOTIF                          |
| US-016 | P-01    | As a member, I want interruption patterns without covert surveillance so that analytics improve my environment without invading it.          | DANL                                       |
| US-017 | P-04    | As a member, I want progress reports to disclose missing data and metric definitions so that comparisons are credible.                       | REPORT, FANL                               |
| US-018 | P-01    | As a member, I want reminders to honor quiet hours across travel and daylight-saving changes so that the system remains predictable.         | REM, NOTIF                                 |
| US-019 | P-04    | As a member, I want AI advice grounded in evidence I selected so that I can understand and correct it.                                       | AICOACH, AISUGG                            |
| US-020 | P-04    | As a member, I want AI-proposed changes presented for review so that the coach cannot silently alter my schedule or goals.                   | AICOACH, SMARTSCHED                        |
| US-021 | P-02    | As a member, I want daily and weekly reviews to offer one bounded experiment so that improvement stays actionable.                           | AIDAILY, AIWEEK, REFLECT                   |
| US-022 | P-02    | As a member, I want bookmarks, notes, reading, and resources searchable together so that knowledge is retrievable.                           | KHUB, SEARCH, BOOK, NOTES, READ, RES       |
| US-023 | P-01    | As a member, I want gamification controls and no penalty for rest so that motivation does not become coercion.                               | GAME, XP, LEVEL, STREAK, ACH               |
| US-024 | P-08    | As a support operator, I want minimal account metadata and reason-coded actions so that I can help without reading private content.          | ADMIN                                      |
| US-025 | P-08    | As an auditor, I want immutable privileged-action evidence so that access and changes are accountable.                                       | ADMIN, AUTH                                |
| US-026 | P-01    | As a member, I want my settings and active sessions synchronized across web and future mobile clients so that controls are consistent.       | SET, AUTH                                  |
| US-027 | P-07    | As a multilingual member, I want dates, weeks, numbers, and right-to-left layouts localized so that meaning is not lost.                     | LANG                                       |
| US-028 | P-04    | As a member, I want versioned machine-readable exports so that my data remains portable.                                                     | EXPORT                                     |
| US-029 | P-01    | As a member, I want useful cached read access and safe queued writes offline so that short network loss does not erase work.                 | DAILY, JOURNAL, NOTES, DEEP                |
| US-030 | P-04    | As a future agent user, I want bounded capabilities, budgets, approvals, and an audit trail so that automation remains reversible.           | AGENT                                      |

---

# 8. Use Cases

## UC-01 - Create and execute a daily focus plan

**Primary actor.** Member

**Preconditions.** The member is authenticated; local date, time zone, and planning preferences are available.

**Trigger.** The member opens Daily Focus for the current local date.

Main success scenario

1. The system retrieves or creates the canonical daily plan.
1. The member selects up to three primary priorities and optional supporting tasks.
1. The system estimates planned load against available capacity and explains conflicts.
1. The member schedules or starts a focus block.
1. The member completes, defers, cancels, or carries forward each commitment with an optional reason.
1. The system updates derived summaries and emits idempotent domain events.
   Alternative and exception flows

- Offline edits are stored with client mutation identifiers and synchronized later.
- A concurrent edit produces a merge/review state instead of last-write-wins data loss.
- AI suggestions are absent or read-only when consent is missing.
  **Postconditions.** The plan and decision history are persisted; no unconfirmed AI mutation exists.

**Traceability.** FR-DAILY-001..003; FR-DEEP-001; BR-07; NFR-REL-04

## UC-02 - Run a deep-work session

**Primary actor.** Member

**Preconditions.** No other focus-mode session is active for the member.

**Trigger.** The member starts a configured deep-work or Pomodoro session.

Main success scenario

1. The member defines intent, duration, and optional goal link.
1. The server creates an active session from an idempotent request.
1. The client renders elapsed/remaining time from authoritative timestamps.
1. The member records interruptions or pauses and resumes.
1. The member completes or abandons the session and records an outcome.
1. Analytics update asynchronously from the final event.
   Alternative and exception flows

- After sleep or reconnect, elapsed time is reconciled without double counting.
- A second device is shown the active session and may request a controlled takeover.
- Notification or distraction-control permission denial does not prevent the timer.
  **Postconditions.** One terminal session record exists with consistent duration and provenance.

**Traceability.** FR-DEEP-001..003; FR-POMO-001..003; BR-10; NFR-PERF-03

## UC-03 - Plan a week from goals and calendar

**Primary actor.** Member

**Preconditions.** The member has a week definition; goals/calendar connections are optional.

**Trigger.** The member starts weekly planning.

Main success scenario

1. The system shows candidate outcomes and known calendar constraints without auto-committing them.
1. The member sets capacity, outcomes, constraints, and recovery time.
1. The system detects overcommitment and explains the basis.
1. The member accepts or edits suggested time blocks.
1. External calendar writes occur only after confirmation and provider acknowledgement.
1. The plan becomes the canonical version for the week.
   Alternative and exception flows

- If free/busy is unavailable, the system labels availability unknown.
- If insufficient time exists, unscheduled work remains visible with alternatives.
- Conflicting provider updates enter a review state.
  **Postconditions.** The weekly plan and any confirmed calendar operations are traceable.

**Traceability.** FR-WEEKPLAN-001..003; FR-SMARTSCHED-001..003; FR-CAL-001..003

## UC-04 - Track a scheduled habit with a pause

**Primary actor.** Member

**Preconditions.** A valid habit and schedule exist.

**Trigger.** A habit occurrence becomes due or the member opens the tracker.

Main success scenario

1. The member records the typed value or completion state.
1. The system validates the value against the habit type and occurrence.
1. Adherence and eligible streaks update from the versioned schedule.
1. The member pauses the habit for an illness, vacation, or custom period.
1. Paused occurrences are excluded according to the disclosed rule.
1. Resumption uses the confirmed schedule.
   Alternative and exception flows

- Backfill beyond policy requests confirmation or is rejected.
- Schedule changes create a new version for future occurrences.
- Offline duplicate mutations resolve using occurrence and client mutation identifiers.
  **Postconditions.** History remains interpretable under the schedule and pause version active at each occurrence.

**Traceability.** FR-HABIT-001..003; FR-STREAK-001..003; BR-14..17

## UC-05 - Generate and act on an AI daily review

**Primary actor.** Member

**Preconditions.** AI review consent exists for at least one data scope.

**Trigger.** The member requests a review or a consented schedule becomes due.

Main success scenario

1. The system displays included scopes and captures an evidence snapshot.
1. The AI service generates structured observations, gaps, and bounded next actions.
1. The system validates output, labels inference, and links evidence.
1. The member accepts, edits, dismisses, or rates each suggestion.
1. Accepted actions become reviewable domain commands.
1. Only confirmed commands mutate plans, reminders, or schedules.
   Alternative and exception flows

- With sparse data, the review states limitations and avoids trend claims.
- Unsafe or unsupported requests return a bounded refusal and helpful alternative.
- Provider failure preserves the snapshot for retry without duplicate actions.
  **Postconditions.** The versioned review, feedback, and any separately confirmed actions are auditable.

**Traceability.** FR-AIDAILY-001..003; FR-AICOACH-001..003; BR-27..33

## UC-06 - Write a private journal entry and selectively reflect with AI

**Primary actor.** Member

**Preconditions.** The member is authenticated; AI access is optional.

**Trigger.** The member creates a journal entry.

Main success scenario

1. The client creates a recoverable draft and autosaves versioned changes.
1. The member adds text, tags, mood link, or permitted attachment.
1. The system sanitizes content and scans attachments.
1. The member selects an exact entry or excerpt for AI reflection.
1. A scope preview is confirmed before transmission.
1. Generated reflection is saved only when the member chooses.
   Alternative and exception flows

- Concurrent offline edits create a merge copy with neither version lost.
- Attachment failure leaves the text draft intact.
- Revoked AI consent prevents transmission but not local writing.
  **Postconditions.** The journal remains private; any AI use has an item-level consent record.

**Traceability.** FR-JOURNAL-001..003; FR-REFLECT-001..003; BR-23..26

## UC-07 - Import LeetCode practice history

**Primary actor.** Member

**Preconditions.** The member supplies a supported file or authorizes an approved integration.

**Trigger.** The member starts an import.

Main success scenario

1. The system validates source, schema, size, and encoding.
1. A preview classifies new, duplicate, changed, and invalid records.
1. The member selects the records to commit.
1. The server processes an idempotent import job.
1. Attempts and pattern summaries are recomputed.
1. The result reports committed, skipped, and rejected rows.
   Alternative and exception flows

- Partial invalidity does not silently discard valid rows.
- Source outage leaves the import retryable.
- No protected-page scraping or third-party credential capture is attempted.
  **Postconditions.** Imported attempts retain source and import provenance and can be reversed by import batch.

**Traceability.** FR-LC-001..003; BR-35; NFR-SEC-10

## UC-08 - Configure and receive a reminder

**Primary actor.** Member

**Preconditions.** At least one delivery channel is available, or in-app delivery is enabled.

**Trigger.** The member creates a one-time or recurring reminder.

Main success scenario

1. The system validates local time, time zone, recurrence, quiet hours, and channel.
1. The next occurrence is displayed for confirmation.
1. A durable scheduler claims each due occurrence once.
1. Notification content is localized and privacy-minimized.
1. The provider acknowledgement or failure is recorded.
1. The member completes, snoozes, or dismisses the occurrence.
   Alternative and exception flows

- A daylight-saving gap requests a defined shift/skip policy.
- A revoked push endpoint falls back only to an already-consented channel.
- Duplicate workers observe the same occurrence key and do not redeliver.
  **Postconditions.** The occurrence has one auditable outcome and the next occurrence is correctly computed.

**Traceability.** FR-REM-001..003; FR-NOTIF-001..003; BR-18..22

## UC-09 - Generate and download a progress report

**Primary actor.** Member

**Preconditions.** The member owns data in at least one selected report section.

**Trigger.** The member configures a report and requests generation.

Main success scenario

1. The member selects period, sections, comparison, and sensitive-data inclusions.
1. The system previews the inclusion scope and metric definitions.
1. A versioned snapshot is generated from authorized sources.
1. Missing/stale data is disclosed per section.
1. The member requests an export job in a supported format.
1. After appropriate re-authentication, a time-limited artifact is downloaded.
   Alternative and exception flows

- A failed section is labeled rather than replaced by zero.
- An expired artifact can be regenerated from the same snapshot.
- Revoked or deleted data is treated according to the snapshot and retention policy.
  **Postconditions.** The report and export have immutable manifests, schema version, and audit metadata.

**Traceability.** FR-REPORT-001..003; FR-EXPORT-001..003; NFR-PRIV-06

## UC-10 - Localize and access a timer

**Primary actor.** Accessibility-first member

**Preconditions.** The member has language and accessibility preferences or OS defaults.

**Trigger.** The member opens a timer workflow.

Main success scenario

1. Preferences are applied before the interactive timer is announced.
1. All controls are reached and activated using the keyboard.
1. Visible focus, name, role, and state are conveyed to assistive technology.
1. Elapsed/remaining updates use a non-disruptive announcement cadence.
1. Status uses text/icon cues in addition to color.
1. Reduced motion and alternate alert modality are honored.
   Alternative and exception flows

- At 200% text zoom, controls reflow without two-dimensional scrolling.
- When audio is unavailable, visual/haptic or in-app alternatives remain.
- Right-to-left text does not reverse timer semantics or control order incorrectly.
  **Postconditions.** The member has equivalent control and understandable state without pointer, color, motion, or sound dependence.

**Traceability.** FR-A11Y-001..003; FR-LANG-001..003; NFR-A11Y-01..08

## UC-11 - Administer an account without reading private content

**Primary actor.** Support Administrator

**Preconditions.** The operator has MFA, a valid support role, and an active support reason/ticket.

**Trigger.** The operator searches for an account using allowed metadata.

Main success scenario

1. The system authorizes the query and returns minimal account status metadata.
1. The operator selects a documented support action and reason code.
1. Step-up authentication occurs for sensitive status changes.
1. The server re-authorizes the action on the target resource.
1. The action executes or fails atomically.
1. An immutable audit event records actor, target, reason, result, and correlation ID.
   Alternative and exception flows

- Private content endpoints remain unavailable regardless of UI manipulation.
- Self-escalation and last-admin removal fail closed.
- If audit persistence is unavailable, privileged mutation fails unless a documented emergency policy permits otherwise.
  **Postconditions.** Only allowed account metadata changed; private content was neither returned nor searched.

**Traceability.** FR-ADMIN-001..003; BR-40..46; NFR-SEC-01..12

## UC-12 - Execute a future bounded AI agent run

**Primary actor.** Member

**Preconditions.** The agent runtime is enabled; objective, tools, scopes, budget, and approval policy are valid.

**Trigger.** The member starts an agent run.

Main success scenario

1. The runtime records an immutable capability grant and input snapshot.
1. The agent proposes a plan within time, token, cost, and step budgets.
1. Each tool call is authorized and schema-validated at execution time.
1. External writes pause for required human approval.
1. Results and side effects are recorded as run events.
1. The run completes, pauses, fails, or is cancelled with a full summary.
   Alternative and exception flows

- Prompt injection or permission expansion attempts terminate the affected step.
- Partial external writes are reported with safe compensating options.
- Consent revocation or budget exhaustion stops new tool calls immediately.
  **Postconditions.** The member can inspect every material input, approval, tool call, output, cost, and side effect.

**Traceability.** FR-AGENT-001..003; BR-47..50; NFR-AI-01..10

---

# 9. Business Rules

Business rules are stable policies shared by multiple features. A feature requirement may tighten a rule but may not silently contradict it.

| ID    | Rule                       | Definition                                                                                                                                                                          |
| ----- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-01 | Ownership                  | All member-created domain records have exactly one owning account in the initial product; team/shared ownership is out of initial scope.                                            |
| BR-02 | Server authorization       | Every read and mutation is authorized server-side against actor, action, resource, ownership, role, consent, and current policy.                                                    |
| BR-03 | Canonical time             | Instants are stored in UTC with the originating IANA time zone and local-date context when calendar meaning matters.                                                                |
| BR-04 | User day                   | Daily boundaries use the member's effective time zone; a time-zone change never silently moves previously finalized records.                                                        |
| BR-05 | Week definition            | Week start is user-configurable; stored weekly plans retain the week definition used when created.                                                                                  |
| BR-06 | History                    | Material target, schedule, status, and rule changes are versioned or represented by append-only events so historical reports remain interpretable.                                  |
| BR-07 | Daily priorities           | A daily plan supports at most three primary priorities; supporting items are allowed but are visually subordinate.                                                                  |
| BR-08 | Carry-forward              | Carry-forward is an explicit decision and records source date, destination date, and optional reason; it is never inferred from inactivity.                                         |
| BR-09 | Planning warnings          | Capacity excess produces an explainable warning and alternatives, not an unexplained hard block.                                                                                    |
| BR-10 | Active focus session       | A member has at most one active deep-work or Pomodoro focus interval across devices.                                                                                                |
| BR-11 | Timer authority            | Elapsed time is derived from authoritative start/pause/end instants, not accumulated browser ticks.                                                                                 |
| BR-12 | Focus completion           | Abandoned, interrupted, completed, and invalidated sessions are distinct states and are not silently converted.                                                                     |
| BR-13 | Break safety               | Breaks never reduce XP or streaks and may be extended or skipped without shame-based messaging.                                                                                     |
| BR-14 | Habit occurrence           | Habit adherence is evaluated against the versioned schedule and target applicable to each occurrence.                                                                               |
| BR-15 | Habit pause                | Approved pause periods are excluded from due occurrences; they do not count as completion or failure.                                                                               |
| BR-16 | Backfill                   | Backfill windows are configurable and disclosed; corrections outside the window require explicit confirmation and remain auditable.                                                 |
| BR-17 | Streak calculation         | Streaks use eligible occurrences rather than consecutive calendar days unless the schedule is daily.                                                                                |
| BR-18 | Reminder occurrence        | Each computed reminder occurrence has a globally unique deduplication key and one terminal delivery outcome per channel attempt.                                                    |
| BR-19 | Quiet hours                | Non-security notifications do not deliver during the member's effective quiet hours; the selected defer, batch, or suppress policy applies.                                         |
| BR-20 | DST recurrence             | For invalid or ambiguous local recurrence times, the system applies a disclosed user-selected shift/first/second/skip policy.                                                       |
| BR-21 | Channel consent            | Delivery uses only currently consented channels; it never falls back to an unapproved channel.                                                                                      |
| BR-22 | Sensitive preview          | Lock-screen and email previews omit sensitive journal, mood, faith, health-adjacent, and coaching content by default.                                                               |
| BR-23 | Private-content boundary   | Routine administrators and content curators cannot retrieve member journal, note body, mood note, life vision, prayer log, Quran note, sleep note, or AI conversation content.      |
| BR-24 | Sensitive feature defaults | Journal, mood, faith, sleep, workout/body, and AI conversation features are private and excluded from reports, search embeddings, and sharing until selected.                       |
| BR-25 | Deletion                   | Account and content deletion follows a documented lifecycle covering recovery window, legal holds if applicable, backups, indexes, AI stores, exports, and third-party processors.  |
| BR-26 | Export                     | A member can export their supported data in documented machine-readable formats; secrets, internal risk scores, and other users' data are excluded.                                 |
| BR-27 | AI consent                 | AI processing requires an active purpose-specific consent and a context grant listing the selected data categories or items.                                                        |
| BR-28 | AI provenance              | Material AI observations cite internal source type/date or are labeled as inference; unavailable evidence is disclosed.                                                             |
| BR-29 | AI mutation                | AI output is advisory; any state-changing action is a validated proposal requiring explicit approval or a narrowly scoped pre-approved policy.                                      |
| BR-30 | AI uncertainty             | AI must not fabricate completed activity, certainty, citations, credentials, diagnoses, rulings, or calendar/provider acknowledgement.                                              |
| BR-31 | AI safety                  | Requests and outputs pass policy, prompt-injection, data-loss-prevention, and structured-output validation appropriate to the action risk.                                          |
| BR-32 | AI retention               | AI request/response retention, provider use, and model-training status are disclosed and configurable within platform policy.                                                       |
| BR-33 | AI graceful degradation    | Core planning, tracking, timers, journal, reminders, and exports remain usable when AI is disabled or unavailable.                                                                  |
| BR-34 | Metric truth               | Each metric has a named owner, definition, unit, inclusion/exclusion rules, version, freshness, and test fixtures.                                                                  |
| BR-35 | Third-party data           | Focused uses documented authorized APIs, licensed feeds, user-provided files, or public data permitted by terms; it does not bypass access controls or store third-party passwords. |
| BR-36 | News provenance            | Every news item shows original publisher/source and publication time; generated summaries are labeled.                                                                              |
| BR-37 | Faith neutrality           | Prayer and Quran features are configurable aids, not religious authorities; method differences and data sources are disclosed.                                                      |
| BR-38 | Health boundary            | Mood, sleep, workout, and habit insights are general tracking and reflection, not diagnosis, treatment, or emergency response.                                                      |
| BR-39 | Crisis resources           | When configured safety detection identifies explicit high-risk language, Focused may present region-appropriate resources while stating it cannot assess or provide emergency care. |
| BR-40 | Role assignment            | Only authorized platform administrators may assign operational roles, and they may not grant privileges beyond their own delegation boundary.                                       |
| BR-41 | Privileged MFA             | All operational roles require MFA; sensitive actions require recent step-up authentication.                                                                                         |
| BR-42 | Admin reason               | Every privileged read or write requires a declared operational reason or linked case and an immutable audit event.                                                                  |
| BR-43 | Separation of duties       | Policy-defined high-risk actions require a second approver or an equivalent controlled workflow.                                                                                    |
| BR-44 | Audit integrity            | Audit records are append-only, access-controlled, time-synchronized, retention-governed, and excluded from routine deletion by subjects.                                            |
| BR-45 | Last administrator         | The last active platform administrator cannot remove or disable their own administrative access.                                                                                    |
| BR-46 | Feature flags              | Flags have owner, purpose, audience, expiry/review date, safe default, and rollback plan; authorization is never implemented only by a flag.                                        |
| BR-47 | Agent capability           | Agent tools are deny-by-default and capability grants cannot be expanded by the agent or by tool output.                                                                            |
| BR-48 | Agent budgets              | Every agent run has hard time, step, token/cost, and side-effect budgets enforced outside the model.                                                                                |
| BR-49 | Agent approval             | External communication, calendar writes, destructive changes, purchases, and other policy-designated actions require human approval at execution time.                              |
| BR-50 | Agent audit                | Agent plans, tool inputs/outputs, approvals, errors, costs, side effects, and cancellations are recorded with sensitive-data redaction.                                             |

---

# 10. Non-functional Requirements

Quality requirements apply to all relevant features and environments. Targets are release gates unless an approved exception records scope, evidence, owner, expiry, mitigation, and rollback.

| ID            | Quality area            | Requirement                                                                                                                                                                                                  |
| ------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-PERF-01   | Web experience          | At the 75th percentile on supported mobile devices and normal broadband, public and authenticated shell pages shall target LCP <= 2.5 s, INP <= 200 ms, and CLS <= 0.1.                                      |
| NFR-PERF-02   | REST latency            | Excluding AI and third-party provider time, cached/read APIs shall target p95 <= 300 ms and ordinary write APIs p95 <= 500 ms at expected load.                                                              |
| NFR-PERF-03   | Timer interaction       | Timer start/pause/resume UI acknowledgement shall occur within 100 ms locally and reconcile with the server without visible jumps greater than one second under normal conditions.                           |
| NFR-PERF-04   | Search                  | Authorized lexical search shall target p95 <= 750 ms for the supported query/index size; partial index freshness shall be disclosed.                                                                         |
| NFR-PERF-05   | AI streaming            | When the provider is healthy, AI endpoints shall target first meaningful streamed content within 3 s and expose progress, cancel, retry, and timeout states.                                                 |
| NFR-PERF-06   | Budgets                 | CI shall enforce route-level JavaScript, image, font, and API payload budgets with documented exceptions.                                                                                                    |
| NFR-SCALE-01  | Horizontal scale        | Stateless request handling, partitionable queues, caches, and data access shall support horizontal scaling without user affinity.                                                                            |
| NFR-SCALE-02  | Capacity                | The architecture shall be capacity-tested for at least 1 million registered accounts and documented peak active-user, timer, reminder, and notification workloads before those levels are marketed.          |
| NFR-SCALE-03  | Hot paths               | Dashboard, due reminders, active timers, streak evaluation, and analytics aggregation shall avoid unbounded scans and N+1 access patterns.                                                                   |
| NFR-SCALE-04  | Async work              | Exports, reports, AI reviews, imports, notifications, and aggregate rebuilds shall use durable, idempotent asynchronous jobs with backpressure and dead-letter handling.                                     |
| NFR-REL-01    | Availability            | Core non-AI APIs shall target 99.9% monthly availability; AI and third-party integrations shall have separate SLOs and graceful degradation.                                                                 |
| NFR-REL-02    | Recovery                | Production data services shall target RPO <= 15 minutes and RTO <= 4 hours, verified by scheduled restore exercises.                                                                                         |
| NFR-REL-03    | Idempotency             | Externally retried mutations, webhooks, job handlers, imports, calendar writes, rewards, and notifications shall be idempotent.                                                                              |
| NFR-REL-04    | Offline conflicts       | Offline-capable writes shall carry client mutation IDs and base versions; conflicts shall merge only where semantics are safe and otherwise require review.                                                  |
| NFR-REL-05    | Degradation             | Failure of AI, analytics, news, external calendars, or push providers shall not make authentication, journal, notes, manual planning, timers, or local reminders unusable.                                   |
| NFR-SEC-01    | Identity                | Web authentication shall use secure HttpOnly SameSite cookies or an equivalent threat-reviewed pattern; future native clients shall use standards-based authorization with PKCE and protected token storage. |
| NFR-SEC-02    | Credentials             | Passwords, if supported, shall use an approved adaptive password hash; secrets and refresh tokens shall never be stored or logged in plaintext.                                                              |
| NFR-SEC-03    | Authorization           | Deny-by-default RBAC plus ownership, consent, and resource policy checks shall be enforced at service boundaries and covered by negative tests.                                                              |
| NFR-SEC-04    | Application threats     | The implementation shall address the current OWASP application/API risks including injection, XSS, CSRF, SSRF, broken access control, unsafe file handling, and mass assignment.                             |
| NFR-SEC-05    | Encryption              | All network traffic shall use current approved TLS; production data, backups, exports, and secrets shall be encrypted at rest with managed key rotation.                                                     |
| NFR-SEC-06    | Rate limits             | Authentication, AI, search, imports, exports, reminders, and administrative endpoints shall have actor- and risk-aware quotas with non-disclosing errors.                                                    |
| NFR-SEC-07    | Session security        | Sessions shall support expiry, rotation, revocation, device listing, suspicious-use detection, and step-up authentication.                                                                                   |
| NFR-SEC-08    | Supply chain            | CI shall generate an SBOM, scan dependencies/containers/secrets, pin trusted actions, and block releases on defined critical vulnerabilities.                                                                |
| NFR-SEC-09    | Files and links         | Uploads shall be type/size validated, malware-scanned, stored outside executable paths, and served with safe content headers; URL fetches shall prevent SSRF.                                                |
| NFR-SEC-10    | Third-party credentials | Focused shall use OAuth or user-provided exports where available and shall not request or store passwords for third-party productivity or learning services.                                                 |
| NFR-SEC-11    | Audit                   | Privileged and security-relevant events shall include actor, target, action, reason, result, time, origin, and correlation identifier with tamper-evident retention.                                         |
| NFR-SEC-12    | Verification            | Threat modeling, SAST, DAST/API tests, dependency scanning, authorization tests, and periodic penetration testing shall be release controls proportional to risk.                                            |
| NFR-PRIV-01   | Minimization            | Only data required for a declared purpose shall be collected; optional sensitive fields shall default empty.                                                                                                 |
| NFR-PRIV-02   | Consent                 | Consent shall be granular by purpose and data scope, versioned, revocable, and no harder to withdraw than to grant.                                                                                          |
| NFR-PRIV-03   | Retention               | Every data class shall have a documented retention/deletion policy including processors, caches, indexes, backups, and analytics.                                                                            |
| NFR-PRIV-04   | Isolation               | Application, cache, search, analytics, object storage, and job layers shall preserve tenant/user isolation.                                                                                                  |
| NFR-PRIV-05   | Logs                    | Logs and telemetry shall exclude credentials and private bodies and shall pseudonymize identifiers where operationally sufficient.                                                                           |
| NFR-PRIV-06   | Rights                  | The platform shall provide authenticated access, correction, export, and deletion workflows and record their fulfillment state.                                                                              |
| NFR-A11Y-01   | Conformance             | User-facing web experiences shall conform to WCAG 2.2 Level AA for supported workflows, verified by automated and manual testing.                                                                            |
| NFR-A11Y-02   | Keyboard                | All functionality shall be keyboard operable with visible focus, logical order, no trap, skip navigation, and accessible shortcuts.                                                                          |
| NFR-A11Y-03   | Semantics               | Controls, headings, landmarks, dialogs, tables, status, errors, and live updates shall expose correct accessible names, roles, relationships, and states.                                                    |
| NFR-A11Y-04   | Reflow                  | Content shall reflow at 320 CSS px and 200% text zoom without loss of content or function except inherently two-dimensional data views.                                                                      |
| NFR-A11Y-05   | Perception              | Status shall not rely on color, sound, or motion alone; contrast shall meet AA and dark/light themes shall be independently tested.                                                                          |
| NFR-A11Y-06   | Motion and time         | Reduced motion shall be honored; timed interactions shall be adjustable, pausable, or exempt only for essential real-time semantics.                                                                         |
| NFR-A11Y-07   | Errors                  | Validation shall identify the field, describe the error, suggest correction, preserve valid input, and move/announce focus appropriately.                                                                    |
| NFR-A11Y-08   | Documents               | Generated human-readable reports shall use headings, reading order, language metadata, tagged tables where supported, and descriptive link text.                                                             |
| NFR-I18N-01   | Localization            | User-visible strings, notification templates, dates, times, numbers, durations, pluralization, and relative time shall be externalized and locale-aware.                                                     |
| NFR-I18N-02   | RTL                     | The design system shall support bidirectional text and right-to-left layout without mirroring semantic media or corrupting time/number meaning.                                                              |
| NFR-I18N-03   | Time zones              | Scheduling tests shall cover daylight-saving gaps/folds, travel, non-hour offsets, and configurable week starts.                                                                                             |
| NFR-UX-01     | Responsive design       | Core workflows shall support small mobile through large desktop layouts with touch targets, safe areas, and no hidden essential actions.                                                                     |
| NFR-UX-02     | States                  | Every asynchronous view shall define loading, empty, partial, success, validation, recoverable error, forbidden, offline, and stale states.                                                                  |
| NFR-UX-03     | Themes                  | Light, dark, and system themes shall be available without flashes, inaccessible contrast, or information loss.                                                                                               |
| NFR-UX-04     | Calm defaults           | Notification, dashboard, gamification, and AI surfaces shall use frequency caps, progressive disclosure, and user-controlled dismissal.                                                                      |
| NFR-PWA-01    | Installability          | The web application shall meet supported-browser PWA installability requirements with a versioned manifest and service worker.                                                                               |
| NFR-PWA-02    | Offline                 | The app shall provide an offline shell, safe cached read access, explicit freshness, and queued writes for documented low-risk workflows.                                                                    |
| NFR-PWA-03    | Updates                 | Service-worker updates shall be atomic and announce refresh/reload needs without trapping a member on an incompatible client version.                                                                        |
| NFR-PWA-04    | Push                    | Web push shall be optional, permission-aware, unsubscribe-safe, and use expiring privacy-minimized payloads.                                                                                                 |
| NFR-SEO-01    | Metadata                | Every public indexable page shall have unique title, description, canonical URL, social metadata, and appropriate structured data; authenticated pages shall be non-indexable.                               |
| NFR-SEO-02    | Rendering               | Public marketing/help content shall be server-rendered or statically generated where practical with a sitemap, robots policy, semantic headings, and stable URLs.                                            |
| NFR-API-01    | REST                    | Versioned APIs shall use resource-oriented URIs, standard methods/status codes, pagination, filtering, conditional requests, and consistent problem responses.                                               |
| NFR-API-02    | Documentation           | An OpenAPI contract and examples shall be generated and validated in CI; breaking changes require a versioning and migration policy.                                                                         |
| NFR-API-03    | Mobile readiness        | Business rules and authorization shall reside server-side; no web-only session assumption may prevent standards-based native clients.                                                                        |
| NFR-DATA-01   | Integrity               | Transactional invariants, foreign keys where appropriate, unique constraints, optimistic concurrency, and idempotency records shall protect domain state.                                                    |
| NFR-DATA-02   | Migrations              | Schema migrations shall be forward-compatible with the active application window, observable, reversible where practical, and tested on production-like volume.                                              |
| NFR-DATA-03   | Analytics separation    | Operational queries and analytical workloads shall be isolated sufficiently to protect transactional latency and privacy policy.                                                                             |
| NFR-AI-01     | Provider abstraction    | Model and embedding providers shall be behind versioned interfaces so they can be changed without altering domain contracts.                                                                                 |
| NFR-AI-02     | Structured output       | AI outputs used by product logic shall be schema-validated, size-limited, policy-checked, and treated as untrusted input.                                                                                    |
| NFR-AI-03     | Evaluation              | Prompt/model changes shall pass versioned offline evaluations for grounding, safety, instruction adherence, refusal, privacy, latency, and cost before rollout.                                              |
| NFR-AI-04     | Observability           | AI traces shall capture model/prompt version, latency, token/cost, tool calls, safety outcome, and feedback while redacting private content by default.                                                      |
| NFR-AI-05     | Fallback                | The product shall expose deterministic non-AI alternatives for core workflows and clear retry/cancel behavior for AI operations.                                                                             |
| NFR-AI-06     | Prompt injection        | Retrieved and user-provided content shall be treated as data, isolated from privileged instructions, and unable to grant tools or change policy.                                                             |
| NFR-AI-07     | Action safety           | Every AI-proposed state change shall pass normal validation/authorization and policy-defined human approval at execution time.                                                                               |
| NFR-AI-08     | Cost controls           | Per-user and system budgets, quotas, caching, model routing, and kill switches shall bound AI cost and runaway behavior.                                                                                     |
| NFR-AI-09     | Deletion                | AI conversations, embeddings, caches, evaluation samples, and provider-retained data shall participate in documented deletion and retention workflows.                                                       |
| NFR-AI-10     | Transparency            | AI surfaces shall identify AI-generated content, meaningful limitations, evidence scope, and how to report or correct harmful output.                                                                        |
| NFR-OBS-01    | Telemetry               | Services shall emit structured logs, metrics, traces, and domain/business events with correlation identifiers and documented cardinality controls.                                                           |
| NFR-OBS-02    | Alerts                  | SLOs shall have actionable alerts and runbooks for error rate, latency, queue lag, notification delivery, calendar sync, exports, and AI cost/safety.                                                        |
| NFR-QUAL-01   | Architecture            | Implementation shall use feature/domain boundaries, dependency inversion, small interfaces, and independently testable domain rules; shared code shall have an explicit owner and purpose.                   |
| NFR-QUAL-02   | Testing                 | Each feature shall include unit, API/contract, authorization, persistence, UI interaction, accessibility, and relevant end-to-end tests, including negative and boundary cases.                              |
| NFR-QUAL-03   | Coverage                | Changed domain/application code shall target >= 90% branch coverage and overall maintained code >= 80%, without treating coverage as a substitute for behavior tests.                                        |
| NFR-QUAL-04   | Static quality          | The default branch shall pass formatting, lint, type checking, tests, production build, secret/dependency scans, and the configured SonarQube quality gate with no blocker/critical issue.                   |
| NFR-DEVOPS-01 | CI                      | GitHub Actions shall run lint, types, unit/integration tests, accessibility checks, build, OpenAPI validation, dependency/secret scans, and SonarQube scan on protected changes.                             |
| NFR-DEVOPS-02 | Deployment              | The web application shall be deployable to Vercel with reproducible environment configuration, preview deployments, protected production promotion, and rollback.                                            |
| NFR-DEVOPS-03 | Environments            | Development, test, preview, staging where required, and production shall use separated secrets/data and documented configuration validation.                                                                 |
| NFR-DEVOPS-04 | Release                 | Database and worker compatibility shall be checked before promotion; release health shall be observed and rollback/roll-forward practiced.                                                                   |
| NFR-MAINT-01  | Documentation           | Architecture decisions, domain glossary, API contract, data classification, runbooks, threat models, and feature behavior shall be version-controlled and updated with changes.                              |
| NFR-MAINT-02  | Compatibility           | Supported browser/client versions, deprecation windows, API compatibility, and data migration policy shall be published and tested.                                                                          |

---

# 11. Permission Matrix

Legend: - = no capability; R = read; C = create; CRUD = create/read/update/delete; Own = member-owned only; Meta = minimum operational metadata; A = bounded action; M = manage; MC = manage curated catalog; Cfg = configuration; AU = audit; Scope = explicit context/capability grant; Agg-op = aggregate platform operations only. Suffixes qualify scope. All checks are server-side and deny by default. UI visibility is not authorization.

| Capability                           | V        | M        | S         | C         | PA       | AU       | AI         |
| ------------------------------------ | -------- | -------- | --------- | --------- | -------- | -------- | ---------- |
| Public marketing/help                | R        | R        | R         | MC        | M        | AU       | -          |
| Register/sign in/recover             | C-own    | Own      | Meta      | -         | Cfg      | AU       | -          |
| Profile/settings/sessions            | -        | Own      | Meta+A    | -         | Policy   | AU       | -          |
| Plans/goals/calendar/focus           | -        | CRUD-own | -         | -         | -        | -        | Scope      |
| Trackers/analytics/reports           | -        | CRUD-own | -         | -         | -        | Agg-op   | Scope      |
| Journal/notes/life vision/reflection | -        | CRUD-own | -         | -         | -        | -        | Item grant |
| Mood/sleep/workout/faith data        | -        | CRUD-own | -         | -         | -        | -        | Scope      |
| AI conversations/reviews             | -        | CRUD-own | -         | -         | Policy   | -        | Run scope  |
| Knowledge/news catalog               | R-public | Own+R    | -         | MC        | M-policy | AU       | Scope      |
| Notifications/reminders              | -        | CRUD-own | Meta      | -         | Cfg      | AU       | Payload    |
| Gamification                         | R-public | Own      | -         | MC-deleg. | M-rules  | AU       | Scope      |
| User status/support actions          | -        | Own req. | A-bounded | -         | A-policy | AU       | -          |
| Roles/permissions                    | -        | -        | -         | -         | M-deleg. | AU       | -          |
| Feature flags/system config          | -        | -        | R-safe    | C-subset  | M        | R        | R-safe     |
| Audit logs                           | -        | Own sec. | Own A     | Own A     | R-auth   | R/export | Append     |

## 11.1 Role Definitions

- Visitor: unauthenticated user with public content and identity-entry flows only.
- Member: authenticated owner of a personal Focused workspace.
- Support Administrator: limited operational metadata and documented reason-coded support actions; no private content.
- Content Curator: manages platform news/resource/translation/challenge catalog content; no member-private content.
- Platform Administrator: manages roles, policies, flags, and operational configuration under MFA, step-up, delegation, and audit controls.
- Auditor: read-only access to authorized audit/configuration evidence, not member-private content.
- AI Service Principal: non-human, run-scoped capability to process only the member-selected context and return proposals/output; cannot self-authorize.

---

# 12. Feature Priorities and Release Strategy

## 12.1 Priority Definitions

| Priority    | Meaning                                                                                                                                        | Release intent                                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0 Must     | Required to deliver a secure, coherent FocusOS core and operate it safely.                                                                     | Release 1 - identity, daily focus, goals/weekly planning, timers, core habits/journal/reflection, notifications/reminders, core AI review/coach, analytics, admin. |
| P1 Should   | High value after the core loop is proven; integrates planning, tracking, knowledge, accessibility/localization depth, and optional motivation. | Release 2 - integrated growth.                                                                                                                                     |
| P2 Could    | Valuable expansion whose absence does not break the core promise.                                                                              | Release 3 after product/safety/data validation.                                                                                                                    |
| P3 Research | Architecture-ready but not authorized for general release without a dedicated safety and product baseline.                                     | Post-validation agent research.                                                                                                                                    |

## 12.2 Feature Priority Register

| Code       | Feature                             | Domain              | Priority | Planned wave                  |
| ---------- | ----------------------------------- | ------------------- | -------- | ----------------------------- |
| AUTH       | Authentication and Account Security | Foundation          | P0       | Release 1 - Core FocusOS      |
| ONB        | Onboarding                          | Foundation          | P0       | Release 1 - Core FocusOS      |
| DASH       | Dashboard                           | Foundation          | P0       | Release 1 - Core FocusOS      |
| PROF       | Profile                             | Foundation          | P0       | Release 1 - Core FocusOS      |
| SET        | Settings                            | Foundation          | P0       | Release 1 - Core FocusOS      |
| LANG       | Language and Localization           | Foundation          | P1       | Release 2 - Integrated Growth |
| A11Y       | Accessibility Preferences           | Foundation          | P0       | Release 1 - Core FocusOS      |
| DAILY      | Daily Focus                         | Focus Execution     | P0       | Release 1 - Core FocusOS      |
| DEEP       | Deep Work Timer                     | Focus Execution     | P0       | Release 1 - Core FocusOS      |
| POMO       | Pomodoro                            | Focus Execution     | P0       | Release 1 - Core FocusOS      |
| SMARTSCHED | Smart Scheduling                    | Planning            | P1       | Release 2 - Integrated Growth |
| GOAL       | Goal Management                     | Planning            | P0       | Release 1 - Core FocusOS      |
| VISION     | Life Vision                         | Planning            | P1       | Release 2 - Integrated Growth |
| WEEKPLAN   | Weekly Planning                     | Planning            | P0       | Release 1 - Core FocusOS      |
| MONTHPLAN  | Monthly Planning                    | Planning            | P1       | Release 2 - Integrated Growth |
| YEARPLAN   | Yearly Planning                     | Planning            | P1       | Release 2 - Integrated Growth |
| CAL        | Calendar                            | Planning            | P0       | Release 1 - Core FocusOS      |
| HABIT      | Habit Tracker                       | Tracking            | P0       | Release 1 - Core FocusOS      |
| LEARN      | Learning Tracker                    | Tracking            | P1       | Release 2 - Integrated Growth |
| PROG       | Programming Progress                | Tracking            | P1       | Release 2 - Integrated Growth |
| LC         | LeetCode Tracker                    | Tracking            | P1       | Release 2 - Integrated Growth |
| READ       | Reading Tracker                     | Tracking            | P1       | Release 2 - Integrated Growth |
| QURAN      | Quran Tracker                       | Faith and Wellbeing | P1       | Release 2 - Integrated Growth |
| PRAYER     | Prayer Tracker                      | Faith and Wellbeing | P1       | Release 2 - Integrated Growth |
| WORKOUT    | Workout Tracker                     | Faith and Wellbeing | P1       | Release 2 - Integrated Growth |
| SLEEP      | Sleep Tracker                       | Faith and Wellbeing | P1       | Release 2 - Integrated Growth |
| JOURNAL    | Journal                             | Reflection          | P0       | Release 1 - Core FocusOS      |
| REFLECT    | Reflection                          | Reflection          | P0       | Release 1 - Core FocusOS      |
| MOOD       | Mood Tracker                        | Reflection          | P1       | Release 2 - Integrated Growth |
| AICOACH    | AI Coach                            | AI Guidance         | P0       | Release 1 - Core FocusOS      |
| AIMENTOR   | AI Mentor                           | AI Guidance         | P1       | Release 2 - Integrated Growth |
| AIDAILY    | AI Daily Review                     | AI Guidance         | P0       | Release 1 - Core FocusOS      |
| AIWEEK     | AI Weekly Review                    | AI Guidance         | P1       | Release 2 - Integrated Growth |
| AIMONTH    | AI Monthly Review                   | AI Guidance         | P2       | Release 3 - Expansion         |
| AISUGG     | AI Suggestions                      | AI Guidance         | P1       | Release 2 - Integrated Growth |
| KHUB       | Knowledge Hub                       | Knowledge           | P1       | Release 2 - Integrated Growth |
| NEWS       | Technology News                     | Knowledge           | P2       | Release 3 - Expansion         |
| LRECO      | Learning Recommendations            | Knowledge           | P2       | Release 3 - Expansion         |
| NOTES      | Personal Notes                      | Knowledge           | P0       | Release 1 - Core FocusOS      |
| BOOK       | Bookmarks                           | Knowledge           | P1       | Release 2 - Integrated Growth |
| RES        | Resources                           | Knowledge           | P1       | Release 2 - Integrated Growth |
| SEARCH     | Unified Search                      | Knowledge           | P1       | Release 2 - Integrated Growth |
| FANL       | Focus Analytics                     | Analytics           | P0       | Release 1 - Core FocusOS      |
| DANL       | Distraction Analytics               | Analytics           | P1       | Release 2 - Integrated Growth |
| REPORT     | Progress Reports                    | Analytics           | P1       | Release 2 - Integrated Growth |
| EXPORT     | Export Reports and Data             | Analytics           | P1       | Release 2 - Integrated Growth |
| ACH        | Achievements                        | Gamification        | P1       | Release 2 - Integrated Growth |
| XP         | XP System                           | Gamification        | P1       | Release 2 - Integrated Growth |
| LEVEL      | Levels                              | Gamification        | P1       | Release 2 - Integrated Growth |
| STREAK     | Streaks                             | Gamification        | P1       | Release 2 - Integrated Growth |
| GAME       | Gamification Controls               | Gamification        | P1       | Release 2 - Integrated Growth |
| CHALL      | Challenges                          | Gamification        | P2       | Release 3 - Expansion         |
| NOTIF      | Notifications                       | Engagement          | P0       | Release 1 - Core FocusOS      |
| REM        | Reminder Engine                     | Engagement          | P0       | Release 1 - Core FocusOS      |
| AIREM      | AI Smart Reminder                   | Engagement          | P1       | Release 2 - Integrated Growth |
| ADMIN      | Admin Panel                         | Administration      | P0       | Release 1 - Core FocusOS      |
| AGENT      | Future AI Agent Support             | Future Platform     | P3       | Research / post-validation    |

## 12.3 Release Gates

- Product: validated problem/outcome, explicit non-goals, instrumentation, documented states and content design.
- Architecture: approved domain/API/data/security design, migration/rollback, capacity model, and operational ownership.
- Quality: tests required by NFR-QUAL-02, performance budgets, accessibility review, localization readiness, and no unresolved blocker/critical SonarQube issue.
- Security/privacy: threat model, data classification, consent/retention/deletion behavior, authorization negatives, dependency/secret scans, and incident/runbook readiness.
- AI: eval dataset/results, prompt/model version, grounding/safety/privacy/cost thresholds, fallbacks, kill switch, and action approval tests.
- Operations: dashboards, alerts, SLO/error budget, queue/provider failure drills, backup/restore evidence, and deployment rollback.

---

# 13. Success Metrics

Metrics are decision tools, not user scores. Each has a versioned definition, owner, source, inclusion rules, privacy review, and guardrail. Cohort metrics must be reported with sufficient sample size and without exposing individuals.

| ID    | Metric                         | Definition                                                                                                                                                                    | Initial target                                             | Guardrail                                                                             |
| ----- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| SM-01 | North star: Focused Days / WAU | A Focused Day is a local date with an intentional daily plan plus at least one completed priority or qualifying focus session; report median and distribution, not only mean. | >= 3.0 median by month 6 for activated weekly members      | Guardrail: no increase in excessive-session or notification-dismissal signals         |
| SM-02 | Activation                     | New members who within 24 hours create a daily plan and complete or intentionally close one focus session.                                                                    | >= 55%                                                     | Segment by accessibility mode, device, locale, and acquisition; no dark patterns      |
| SM-03 | Time to first focus            | Median time from verified first sign-in to starting the first intentional focus session.                                                                                      | <= 5 minutes; <= 2 minutes for onboarding completers       | Do not force module setup                                                             |
| SM-04 | Week-4 retained value          | Activated members with at least two Focused Days in week 4.                                                                                                                   | >= 35%                                                     | Track voluntary deletion and notification opt-out                                     |
| SM-05 | Plan realism                   | Share of daily/weekly plans closed with explicit completion/defer/cancel decisions and decreasing involuntary carry-forward.                                                  | >= 70% closed; trend carry-forward downward                | Never reward overcommitment                                                           |
| SM-06 | Focus completion quality       | Completed qualifying focus sessions divided by started sessions, with abandon reason and duration distribution.                                                               | Baseline then improve 10% relative                         | Guardrail: median session and break behavior remain healthy                           |
| SM-07 | Reminder usefulness            | Completed/acted reminders divided by delivered reminders, plus snooze, dismiss, mute, and complaint rates.                                                                    | >= 35% acted; < 2% category mute per week                  | Respect quiet hours >= 99.99%                                                         |
| SM-08 | AI grounded usefulness         | Accepted or positively rated AI suggestions that pass evidence-grounding evaluation.                                                                                          | >= 45% accepted/helpful; >= 95% grounding pass on eval set | Track harmful-output and unconfirmed-action rate; target zero confirmed safety breach |
| SM-09 | Review completion              | Members opening and intentionally completing daily/weekly review among those who enabled it.                                                                                  | >= 40% weekly                                              | Keep review under member-selected time budget                                         |
| SM-10 | Accessibility parity           | Difference in activation and critical-task success between assistive-technology cohorts and overall cohort.                                                                   | Absolute gap < 5 percentage points                         | Zero critical WCAG blocker in release                                                 |
| SM-11 | Reliability                    | Core API availability, p95 latency, timer reconciliation error, reminder duplicate rate, and job backlog SLOs.                                                                | Meet NFR SLOs; duplicate deliveries < 0.01%                | Error budgets drive release policy                                                    |
| SM-12 | Privacy and security           | Confirmed unauthorized disclosures, privilege violations, secret leaks, and overdue deletion/export requests.                                                                 | Zero severe incident; >= 99% requests within policy SLA    | Publish internal incident learning and corrective actions                             |
| SM-13 | Export portability             | Successful exports with valid manifest and schema divided by export requests.                                                                                                 | >= 99% excluding user cancellation                         | Expired artifacts cannot be retrieved                                                 |
| SM-14 | Performance                    | Core Web Vitals pass rate and API SLO compliance by device/region.                                                                                                            | >= 75% good CWV; >= 99% API SLO windows                    | No accessibility regression from performance work                                     |

---

# 14. Risks and Mitigations

| ID   | Risk                                                                          | Likelihood | Impact   | Primary mitigation                                                                                 | Trigger                                            |
| ---- | ----------------------------------------------------------------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| R-01 | Scope overload creates a cluttered product and delayed value                  | High       | Critical | Progressive disclosure, module opt-in, P0 focus loop, feature flags, strict release gates          | Activation falls or navigation depth grows         |
| R-02 | AI advice is generic, wrong, unsafe, or over-authoritative                    | High       | Critical | Evidence grounding, evals, uncertainty labels, bounded domains, feedback, human approval           | Grounding/safety eval regression or harmful report |
| R-03 | Sensitive journal, mood, faith, sleep, or coaching data is exposed            | Medium     | Critical | Classification, least privilege, encryption, no-admin-content boundary, DLP, audits, threat models | Unauthorized access test or incident signal        |
| R-04 | Gamification drives compulsive or unhealthy behavior                          | Medium     | High     | Opt-out, no penalties for rest/sensitive behavior, caps, no public ranking, wellbeing review       | Excessive-session distribution or complaint spike  |
| R-05 | Notification fatigue causes churn or OS-level blocking                        | High       | High     | Quiet hours, category controls, batching, frequency caps, usefulness metrics                       | Mute/dismiss/permission-revoke thresholds          |
| R-06 | Time zones, DST, recurrence, or offline sync corrupt plans and reminders      | High       | High     | Canonical time model, occurrence keys, property tests, conflict UI, reconciliation jobs            | Duplicate/missed reminder or date-shift defect     |
| R-07 | Third-party providers fail, change terms, or remove access                    | High       | Medium   | Adapter boundaries, manual fallback, licensed sources, health checks, user-visible sync state      | Provider error budget or policy notice             |
| R-08 | Metric definitions mislead users or change historical meaning                 | Medium     | High     | Versioned metric catalog, fixtures, provenance, snapshot reports, analytics owner                  | Metric discrepancy or unexplained dashboard jump   |
| R-09 | Vercel/serverless constraints conflict with timers, queues, or long AI jobs   | Medium     | High     | Separate durable workers/queues, async APIs, runtime budgets, deployment ADR                       | Timeouts, queue lag, or regional limit             |
| R-10 | AI inference and retrieval costs become unsustainable                         | High       | High     | Budgets, routing, caching, smaller models, quotas, batch reviews, kill switches                    | Cost per WAU exceeds unit target                   |
| R-11 | Search or embeddings leak unauthorized snippets                               | Medium     | Critical | Authorization-aware indexing/querying, tombstones, isolation tests, private semantic opt-in        | Canary record appears cross-account                |
| R-12 | Faith or wellbeing features make harmful authority claims                     | Medium     | High     | Configurable methods, source disclosure, non-medical/non-religious boundaries, domain review       | Complaint, safety review, or content audit failure |
| R-13 | Offline behavior creates silent conflicts or false completion                 | High       | Medium   | Documented offline matrix, client IDs/base versions, merge copies, stale indicators                | Conflict-loss telemetry or support report          |
| R-14 | Admin tools accumulate excessive privilege                                    | Medium     | Critical | Role separation, MFA, step-up, reason codes, no-content boundary, dual control, audits             | Privilege review or anomalous admin access         |
| R-15 | Premature microservices or abstraction slows delivery                         | Medium     | Medium   | Modular monolith first, measurable extraction criteria, ADRs, domain ownership                     | Cross-service change amplification                 |
| R-16 | Data model cannot support future mobile and agent clients                     | Medium     | High     | Server-owned rules, REST/OpenAPI, versioning, idempotency, event semantics                         | Web-only rule or breaking client contract          |
| R-17 | Technology news/recommendations create copyright, bias, or low-quality issues | Medium     | Medium   | Licensed feeds, provenance, source diversity, curation, report controls                            | Takedown, duplicate rate, or source concentration  |
| R-18 | Accessibility regresses as feature count grows                                | High       | High     | Accessible design system, automated/manual gates, AT testing, parity metrics                       | Critical audit failure or parity gap               |

## 14.1 Risk Governance

Every high/critical risk requires an accountable owner, measurable leading indicator, review cadence, mitigation status, accepted residual risk, and escalation path. A security/privacy/safety risk cannot be accepted solely by delivery management.

---

# 15. Future Scope

Future scope is directional and does not authorize implementation. Each item requires discovery, threat/privacy/accessibility review, architecture decision, requirements, acceptance criteria, and reprioritization.

| ID    | Capability                         | Boundary                                                                                                                                          |
| ----- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| FS-01 | Native mobile applications         | iOS/Android clients using the same versioned REST APIs, auth standards, sync semantics, and push preference model.                                |
| FS-02 | Wearables and health platforms     | Optional imports from platform health stores with strict provenance, consent, and non-medical boundaries.                                         |
| FS-03 | Desktop focus controls             | OS-supported app/site blocking through transparent, revocable local agents; no covert surveillance.                                               |
| FS-04 | Teams and accountability           | Explicit shared workspaces, coaches, accountability partners, and granular sharing—not implicit access to personal workspaces.                    |
| FS-05 | Coach/mentor marketplace           | Verified human professionals with consented data views, safety policy, billing boundaries, and member-controlled revocation.                      |
| FS-06 | Bounded AI agents                  | Durable multi-step agents defined by FR-AGENT with capability grants, approvals, budgets, and complete run audit.                                 |
| FS-07 | Voice and multimodal capture       | Accessible voice notes, image/document capture, and transcription with on-device or consented processing options.                                 |
| FS-08 | Advanced causal experiments        | N-of-1 experiments and statistical guidance that clearly distinguish association from causation and require adequate samples.                     |
| FS-09 | Personal knowledge graph           | User-controlled typed relationships, semantic retrieval, and portable graph export with private indexing controls.                                |
| FS-10 | Extension and integration platform | OAuth apps, webhooks, API keys/service accounts, rate limits, scopes, review, and developer documentation.                                        |
| FS-11 | Enterprise readiness               | SSO, SCIM, data residency, customer-managed keys, audit exports, policy controls, and contractual compliance after a separate requirements phase. |
| FS-12 | Advanced localization              | Additional languages, regional calendars, richer RTL QA, localized safety resources, and translator governance.                                   |

---

# Appendix A. Traceability

## A.1 Domain Traceability Matrix

| Domain                     | Feature IDs                                                  | User stories                | Use cases    | Goals / metrics                           |
| -------------------------- | ------------------------------------------------------------ | --------------------------- | ------------ | ----------------------------------------- |
| Foundation                 | AUTH, ONB, DASH, PROF, SET, LANG, A11Y                       | US-001, US-014, US-024..029 | UC-10, UC-11 | PG-01, PG-07..10; SM-02, SM-10..12, SM-14 |
| Focus execution            | DAILY, DEEP, POMO                                            | US-001..003, US-029         | UC-01, UC-02 | PG-01..03; SM-01, SM-03, SM-05, SM-06     |
| Planning                   | GOAL, VISION, WEEKPLAN, MONTHPLAN, YEARPLAN, CAL, SMARTSCHED | US-004, US-005, US-020      | UC-03        | PG-04; SM-05                              |
| Tracking                   | HABIT, LEARN, PROG, LC, READ                                 | US-006..008, US-011         | UC-04, UC-07 | PG-03, PG-05; SM-04                       |
| Faith/wellbeing/reflection | QURAN, PRAYER, WORKOUT, SLEEP, JOURNAL, REFLECT, MOOD        | US-009..013, US-021         | UC-06        | PG-03, PG-07, PG-08; SM-12                |
| AI guidance                | AICOACH, AIMENTOR, AIDAILY, AIWEEK, AIMONTH, AISUGG          | US-008, US-019..021         | UC-05        | PG-06, PG-07; SM-08, SM-09                |
| Knowledge                  | KHUB, NEWS, LRECO, NOTES, BOOK, RES, SEARCH                  | US-006, US-022              | UC-06, UC-07 | PG-05, PG-09; SM-04                       |
| Analytics                  | FANL, DANL, REPORT, EXPORT                                   | US-016, US-017, US-028      | UC-09        | PG-05, PG-09; SM-06, SM-13                |
| Gamification               | ACH, XP, LEVEL, STREAK, GAME, CHALL                          | US-011, US-015, US-023      | UC-04        | PG-03, PG-08; guardrail metrics           |
| Engagement                 | NOTIF, REM, AIREM                                            | US-018                      | UC-08        | PG-01, PG-08; SM-07, SM-11                |
| Administration/future      | ADMIN, AGENT                                                 | US-024, US-025, US-030      | UC-11, UC-12 | PG-07, PG-09, PG-10; SM-11, SM-12         |

## A.2 Verification Trace

Each FR-<FEATURE>-NNN requirement traces to AC-<FEATURE>-NN and AC-CROSS criteria, then to automated/manual test case IDs in the implementation repository. Business rules and NFRs are linked to every affected test suite and release gate. No feature is Done while an applicable requirement remains unverified, waived without expiry, or lacks evidence.

---

# Appendix B. Glossary and Open Decisions

## B.1 Glossary

| Term             | Definition                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| FocusOS          | The complete Focused system for direction, planning, execution, observation, reflection, and adaptation.                 |
| Focused Day      | A metric-qualified local date with an intentional plan plus at least one completed priority or qualifying focus session. |
| Context grant    | A purpose-, scope-, user-, and time-bound permission for AI or an agent to process selected data.                        |
| Action proposal  | Structured AI output describing a potential domain mutation; it is not executed state.                                   |
| Canonical plan   | The authoritative plan for one member and period under the applicable time-zone/week definition.                         |
| Occurrence       | A computed scheduled instance of a habit or reminder with a stable unique identity.                                      |
| Idempotency      | The property that safely retrying the same logical mutation does not create duplicate effects.                           |
| Snapshot         | An immutable, versioned view of selected evidence at a known time for a review/report/export.                            |
| Stale            | Data whose freshness exceeds its contract or whose upstream source is not currently confirmed.                           |
| Sensitive data   | Private content whose exposure or misuse could materially affect dignity, safety, faith, health, or autonomy.            |
| Operational role | A non-member role used to run the platform under MFA, least privilege, reason, audit, and separation of duties.          |
| PWA              | Installable web application behavior using a manifest, service worker, cache/update strategy, and optional web push.     |

## B.2 Open Decisions Requiring Sponsor Approval

- Target launch countries/regions and applicable privacy, consumer, child-safety, export, and data-residency obligations.
- Age eligibility and whether minors are permitted; this materially changes consent, safety, messaging, and data handling.
- Commercial model and entitlements. This SRS intentionally does not assign features to paid tiers.
- Supported launch languages, right-to-left launch scope, prayer calculation datasets/methods, and localized crisis-resource governance.
- Exact data retention and deletion durations by class, backup technology, legal hold needs, and AI-provider retention terms.
- Identity providers, database, object storage, queue/worker, search, analytics, notification, calendar, and AI vendors after architecture/security evaluation.
- Offline matrix by feature: which reads cache, which mutations queue, conflict policy, encryption of local data, and storage quota.
- Definition of qualifying focus session, XP rules/caps, achievement catalog, streak grace/pause policy, and challenge governance after psychology review.
- Whether technology news is globally available, which sources/licenses are approved, and how editorial balance and takedowns are governed.
- Support break-glass process, if ever needed. Initial requirements prohibit routine access to private content and leave break-glass out of scope.

## B.3 Definition of Ready

A feature is Ready only when its target persona/outcome, priority, dependencies, data classification, architecture/API/data design, all UI states, content, validation, edge cases, security/privacy/threat model, accessibility, analytics, test approach, rollout, operations, and acceptance criteria are reviewed and unresolved decisions are explicit.

## B.4 Definition of Done

A feature is Done only when every applicable FR, BR, NFR, AC, and migration/rollback requirement is implemented and evidenced; OpenAPI and user/technical documentation are current; telemetry and alerts are live; accessibility/security/privacy/AI release gates pass; CI lint/test/build/SonarQube scans pass; and production verification confirms the intended outcome without guardrail regression.
