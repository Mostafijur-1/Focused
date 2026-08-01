# Protected deployment and rollback

## Environment isolation

Create separate GitHub Environments named `preview` and `production`. Production must require designated reviewers, prevent self-review where the plan supports it, disallow untrusted branches, and retain deployment history. Preview and production must use different Neon branches/projects, Redis databases, QStash credentials, Google OAuth registrations or callback allow-lists, VAPID keys, AI keys/quotas, telemetry destinations and Vercel environment values.

Production data must never be copied to preview. Use synthetic fixtures. A stable preview domain is recommended because Google OAuth callback URLs must match exactly.

### Environment variables

Set these GitHub Environment variables:

| Variable            | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `APP_URL`           | Exact HTTPS origin for the environment                |
| `AUTH_JWT_KEY_ID`   | Current signing-key identifier                        |
| `AUTH_JWT_ISSUER`   | Must equal `APP_URL` origin                           |
| `AUTH_JWT_AUDIENCE` | `focused-api` unless an approved migration changes it |
| `VAPID_SUBJECT`     | Operations contact URI                                |

Set these as Environment secrets: `DATABASE_URL`, `DIRECT_URL`, both JWT keys, `AUTH_DATA_ENCRYPTION_KEY_BASE64`, both Upstash Redis values, both Google OAuth values, optional Groq/Gemini keys, the VAPID key pair, all QStash keys, and `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

Production strict validation requires at least one AI provider and the complete Web Push/QStash set. Preview may intentionally degrade those capabilities, but emits warnings. Focused has Google-only Authentication; Resend and password-email variables are not required.

In Vercel, keep the project Root Directory at `apps/web`, output at `.next`, Node.js 24, and the primary function region at Singapore (`sin1`) unless measured latency/data-residency evidence supports a reviewed change. Keep Production, Preview and Development secrets scoped separately.

## Release procedure

1. Confirm the exact commit has a successful `Quality Gate`, no unresolved launch blocker, and the required Milestone 12 sign-offs.
2. Deploy the exact SHA to `preview` through `Protected Release`.
3. Complete authenticated canary checks for Google Authentication, Dashboard, Habit, Goal, Focus, AI fallback/provider path, notification inbox/push, Analytics/export and Admin health.
4. Review migration SQL for expand/contract compatibility, lock risk, ownership grants and rollback/roll-forward instructions.
5. Create a signed or protected `v*` tag on the approved SHA.
6. Dispatch `Protected Release` with the 40-character SHA, `target=production` and `confirm_production=true`.
7. The protected job validates configuration, pulls Vercel environment settings, creates/attests one artifact, applies pending migrations once, deploys the prebuilt artifact and runs 29 public smoke checks.
8. Observe canary metrics and logs before enabling risky Feature Flags. Record approver, URL, artifact, schema state, smoke output and decision in the launch record.

The workflow is intentionally manual. GitHub/Vercel automatic production deployment should be disabled or limited to previews so it cannot bypass Environment approval and the migration gate.

## Rollback

Application rollback is a forward operational action, not a database reset:

1. Freeze Feature Flag expansion and preserve evidence.
2. Identify the last compatible `v*` tag and verify its successful Quality Gate and artifact evidence.
3. Confirm current schema remains backward-compatible with that application. Never reverse a destructive migration during an incident.
4. Dispatch the protected production workflow for the prior compatible tag. `prisma migrate deploy` is idempotent and must report no incompatible pending action.
5. Run public and authenticated smoke checks, reconcile outbox/jobs, and compare error rate/latency.
6. If application rollback cannot restore service, follow the Neon isolated-restore procedure in the disaster-recovery evidence document and obtain incident-command approval before traffic cutover.

Provider fallback: disable the affected provider or risky Feature Flag, retain the in-app/non-AI workflow, and never route private content to an unapproved provider. Removing QStash/VAPID disables external push while the authoritative reminder/inbox records remain in PostgreSQL.

## Key rotation schedule

| Secret                             | Normal cadence               | Emergency action                                                     |
| ---------------------------------- | ---------------------------- | -------------------------------------------------------------------- |
| JWT signing pair                   | 90 days or approved policy   | Add new key ID, deploy, revoke sessions if exposure is suspected     |
| OAuth transaction encryption       | 90 days                      | Wait for short-lived transactions or invalidate them, rotate, deploy |
| Google OAuth secret                | 180 days                     | Rotate provider and environment secret, verify callback              |
| Neon/Redis/QStash/AI/Vercel tokens | 90–180 days by provider/risk | Revoke, replace in both environment stores, redeploy, audit use      |
| VAPID key                          | Only on compromise           | Rotate with explicit subscription re-enrollment impact communication |

Every rotation must be exercised in preview first and recorded without secret values.
