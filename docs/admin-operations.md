# Focused Admin Operations

Milestone 11 implements a separate Administration bounded context. It is a control plane for safe platform operation, not a route to member content.

## Privacy boundary

Routine Admin queries never select Journal, note body, mood, faith, health, Life Vision, reflection, or AI conversation content. Account lookup accepts only an exact email address or UUID and returns a masked email plus minimum account, session-count, and operational-role metadata. Impersonation and break-glass access are intentionally absent.

Every privileged read or write requires an operational role. Data reads additionally require a verified operational MFA session and an active reason-coded case owned by the operator. A case lasts 15–480 minutes.

## Roles and separation of duties

| Role                   | Intended capability                                                          | Explicit boundary                                                |
| ---------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Support Administrator  | Minimal account metadata, status correction, session revocation, safe health | No private content, role changes, flag writes, or job retry      |
| Content Curator        | Delegated catalog/configuration, safe flags/health, own audit evidence       | No member metadata or role changes                               |
| Platform Administrator | Policy, flags, bounded jobs, delegated role workflows                        | Cannot self-escalate; role changes require another administrator |
| Auditor                | Read-only audit/configuration evidence                                       | No operational mutation or member-private content                |

Authorization is server-side and deny-by-default. Navigation visibility is only presentation.

## MFA and step-up

Operational TOTP secrets use AES-256-GCM with `AUTH_DATA_ENCRYPTION_KEY_BASE64`. Recovery codes are shown once and only SHA-256 digests are stored. The accepted TOTP counter is advanced atomically to prevent replay.

- Routine Admin reads require a session with verified TOTP.
- Sensitive email/password actions require current password plus a new TOTP code.
- Google-only actions require a Google sign-in no older than ten minutes plus a new TOTP code.
- The resulting grant lasts five minutes, is single-use, and is bound to one action scope, target type, target ID, user, and session.

## Privileged command guarantees

Account status, session revocation, Feature Flag changes, job retries, and role workflows require a UUID `clientCommandId`, current aggregate version where applicable, active case, and scoped `X-Admin-Step-Up` grant. Replaying the same command returns its recorded result; reusing the identifier with different input returns `409 Conflict`.

Account suspension revokes sessions and refresh tokens atomically. Self-status changes are blocked. The last active Platform Administrator cannot be suspended or removed. Role grants cannot exceed the requesting and approving administrators' own permission boundary. A role request is only executed by a different Platform Administrator.

## Audit integrity

Admin audit rows form a SHA-256 chain over a canonical payload containing actor, action, target, reason, correlation ID, outcome, sequence, timestamp, metadata, and previous hash. The chain head is locked and advanced in the same serializable transaction as the audit insert. A database trigger rejects update and delete operations on `audit_events`; privileged mutations fail closed if audit persistence fails.

Chained Admin evidence cannot be changed when an actor account is deleted, so operational accounts use soft deletion and a governed archival process. Legacy unchained security events permit only the foreign-key-driven `actorUserId` nulling needed by their existing retention lifecycle; every other update/delete remains blocked.

## Initial bootstrap

The migration creates roles and permissions but grants no operational role to any member. After the migration is verified, bootstrap exactly one active, email-verified account only when no active Platform Administrator exists:

```powershell
$env:ADMIN_BOOTSTRAP_EMAIL='operator@example.com'
$env:ADMIN_BOOTSTRAP_CONFIRM='grant-platform-administrator:operator@example.com'
corepack pnpm --filter @focused/web admin:bootstrap
```

The script runs a serializable transaction, increments token permission versions, and appends a chained audit event. Once an administrator exists, it refuses to run; all later assignments use the dual-control API.

## Deployment and verification

```powershell
corepack pnpm db:migrate:deploy
corepack pnpm db:migrate:status
corepack pnpm db:admin:verify
```

Expected verifier result: one finished migration, four roles, seventeen permissions, forty-three role-permission grants, five Admin tables, the append-only trigger, and the Admin chain head.

## Access review and incident response

- Review active operational assignments and expiry at least quarterly.
- Revoke an operator's operational roles through dual control, then revoke sessions.
- Investigate using correlation IDs and chained audit evidence; never copy private member content into cases.
- Disable a risky Feature Flag using its documented rollback plan and record the incident case.
- Retry only failed/partial jobs below their per-job attempt limit. Payloads and provider secrets are not exposed in routine Admin UI.
- If the audit database is unavailable, privileged changes remain unavailable. There is no emergency bypass in Release 1.
