# Incident response

## Roles

- Incident commander: owns severity, decisions, cadence and closure.
- Operations lead: deployment, rollback, provider and infrastructure actions.
- Application lead: diagnosis, mitigation and safe code changes.
- Security/privacy lead: containment, evidence and disclosure assessment.
- Communications lead: internal and member-facing updates.
- Scribe: immutable timeline, commands, approvals and outcomes without secrets/private bodies.

## Severity and first actions

| Severity | Example                                                                               | First response target                           |
| -------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| SEV-1    | Cross-user exposure, credential compromise, destructive corruption, total core outage | Page immediately; contain and preserve evidence |
| SEV-2    | Major workflow outage, sustained high errors, queue loss risk, OAuth failure          | Acknowledge within 15 minutes                   |
| SEV-3    | Degraded provider/non-core feature with safe fallback                                 | Triage during on-call window                    |

For every incident: assign roles, create a private incident channel/case, record correlation/deployment/schema IDs, stop risky rollout, protect member data, prefer reversible Feature Flag/provider isolation, and communicate known facts only. Never paste tokens, cookies, private text or raw database rows into tickets or chat.

## Status template

```text
Focused incident update — <time and zone>
Status: Investigating | Identified | Monitoring | Resolved
Member impact: <plain-language scope; no private details>
Started: <time>
Current action: <safe summary>
Next update: <time>
```

Resolution requires restored SLO, smoke checks, queue/data reconciliation, security/privacy review, member communication decision and a blameless follow-up with owned actions. SEV-1/2 events require a tested prevention or detection improvement before closure.
