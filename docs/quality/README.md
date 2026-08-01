# Milestone 12 quality evidence

This directory is the release-evidence index for Focused. Automated results and human/external approvals are deliberately separated. A green CI run does not imply security, accessibility, localization, performance, or disaster-recovery sign-off.

## Current gate

**Status: automated hardening in progress; release sign-off not granted.**

The following evidence is maintained here:

- [Requirements traceability](requirements-traceability.md)
- [Integrated test report](test-report.md)
- [Accessibility conformance](accessibility-conformance.md)
- [Security assessment](security-assessment.md)
- [Performance assessment](performance-report.md)
- [Milestone 14 optimization report](optimization-report.md)
- [Disaster-recovery rehearsal](disaster-recovery-rehearsal.md)
- [Release defect register](release-defect-register.md)

Milestone 12 can be closed only after every P0 criterion has passing evidence or an approved exception and all required manual/external reviews are signed. CI publishes this directory with the machine-readable Vitest and Playwright results for each protected change.
