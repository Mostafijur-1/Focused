# Release checklist

## Candidate

- [ ] Exact 40-character SHA recorded; production has a `v*` tag.
- [ ] Quality Gate, PostgreSQL integration, Playwright, accessibility and SonarQube gates pass for the SHA.
- [ ] Milestone 12 security, accessibility, native Bangla, performance and recovery exceptions are approved.
- [ ] Dependency/secret/container findings have no release blocker.
- [ ] API and migration compatibility reviewed; lock/rollback/roll-forward plan recorded.

## Environment and providers

- [ ] Preview and production secrets/data are isolated and environment validation passes.
- [ ] Google callback exactly matches the stable environment origin.
- [ ] Neon PITR/retention/restore permissions and pooled/direct URLs verified.
- [ ] Redis, QStash, VAPID, Groq/Gemini quotas/fallback and kill switches verified.
- [ ] SonarQube, Vercel, Neon and uptime alerts route to named owners.
- [ ] DNS/TLS, canonical/hreflang, robots, sitemap, PWA manifest and security headers verified.
- [ ] CSP remains report-only until reviewed telemetry proves an enforceable policy; any enforcement change is separate and tested.

## Promotion and observation

- [ ] Protected Environment reviewer approves the deployment.
- [ ] Provenance-attested artifact is built once and deployed prebuilt.
- [ ] Migrations apply once before traffic; application startup performs none.
- [ ] Public 29-check smoke and authenticated feature canary pass.
- [ ] Error, latency, Neon, queue, OAuth, AI and notification signals remain within limits.
- [ ] Canary Feature Flags, rollback tag, incident roles and support escalation are ready.
- [ ] Launch record contains evidence links, approvers, decision and residual risk.
