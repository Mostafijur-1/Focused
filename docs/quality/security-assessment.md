# Security assessment

## Automated and implemented controls

- Google OAuth Authorization Code flow uses server-owned PKCE, state/nonce validation, allow-listed origins and return paths.
- Access/refresh-token tests cover signing, expiry, rotation, replay-family revocation and secure session controls.
- RBAC is deny-by-default with owner-scoped services; admin operations add MFA/step-up, approval and append-only audit controls.
- Zod rejects unknown transport fields in sensitive mutations; API errors are stable and redact internal details.
- AI context requires explicit scopes, provider output is untrusted/schema-validated, and state changes require the normal authorized use case plus confirmation.
- Export and push tests cover encryption/checksums, privacy-minimized payloads and bounded provider failure.

## Open release controls

- Independent OWASP ASVS/API and AI abuse-case threat-model review.
- DAST/API penetration test against a production-like deployment.
- Dependency, container, SBOM and secret-scan evidence for the release SHA.
- Verification that SonarQube is configured and its quality gate is required, not skipped.
- Production OAuth configuration, TLS/security headers and key-rotation exercise.
- Cross-user/role matrix run against the release environment.

Known critical/high security defects: none identified by the executed automated suites. This is not evidence that none exist.

Security sign-off: **Pending independent review and production-like testing.**
