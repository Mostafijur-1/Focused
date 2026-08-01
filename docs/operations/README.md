# Focused operations handbook

This handbook owns deployment and incident operations for Focused. It separates repository-enforced controls from provider-console configuration and human approval. No checklist entry is considered complete merely because its instructions exist.

## Deployment topology

```text
tested commit/tag
      |
      v
GitHub protected Environment
      |
      +--> validate isolated secrets/capabilities
      +--> build one Vercel artifact + provenance attestation
      +--> apply additive Prisma migrations once through DIRECT_URL
      +--> deploy the same prebuilt artifact
      +--> run public smoke checks
      v
preview or production
```

PostgreSQL remains authoritative. Redis, queues, projections and provider caches are reconstructable or degradable and never become the sole copy of business state. Application startup never runs migrations.

## Runbooks and evidence

- [Protected deployment and rollback](deployment.md)
- [Observability and SLO ownership](observability.md)
- [Incident response and communications](incident-response.md)
- [Release checklist](release-checklist.md)
- [Launch record](launch-record.md)

Operational readiness status: **repository controls implemented; provider setup, protected-environment review and production exercises pending.**
