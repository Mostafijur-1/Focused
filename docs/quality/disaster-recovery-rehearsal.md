# Disaster-recovery rehearsal

Target from NFR-REL-02: RPO no greater than 15 minutes and RTO no greater than 4 hours, subject to the configured managed-service plan.

## Rehearsal procedure

1. Record release SHA, schema migration, Neon branch, backup/PITR window, encryption/key versions and accountable operators.
2. Create synthetic transactions after a known recovery point; never use production personal data in the exercise.
3. Restore into an isolated target and verify schema migration status before application access.
4. Run integrity checks for users/ownership, sessions, goals, habits, timers, outbox/jobs, notifications, analytics, exports, RBAC and append-only audit events.
5. Deploy the matching application version, run health/authenticated smoke tests, then reconcile queues and rebuildable projections.
6. Measure actual RPO/RTO and document data intentionally excluded from restoration.
7. Exercise application rollback or roll-forward, revoke temporary credentials and remove the isolated target under the approved retention process.

Latest rehearsal: **Not run.**

Required evidence: timestamps, operator/reviewer, provider logs, migration output, integrity-query results, smoke-test artifacts, measured RPO/RTO, defects and remediation owner.

Recovery sign-off: **Pending a Neon production-like rehearsal.**
