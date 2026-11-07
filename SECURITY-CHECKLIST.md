# Security and launch checklist — mandatory before production

- [ ] Fix refresh-token lifecycle: persist newly refreshed credentials safely and handle revoked/expired consent.
- [ ] Add OAuth disconnect and token revocation/deletion.
- [ ] Add CSRF tokens to all POST/PUT/DELETE routes; same-site cookies alone are not the complete CSRF strategy.
- [ ] Add per-IP and per-user rate limits and request-size limits.
- [ ] Enforce strict tenant ownership in every query and test cross-tenant denial.
- [ ] Add HTML sanitization and a visual diff; preserve Blogger-specific markup/widgets.
- [ ] Make apply + backup state transition recoverable if Blogger succeeds but DB update fails.
- [ ] Implement restore endpoint and test round-trip restore.
- [ ] Validate Blogger post version/updated timestamp immediately before applying to prevent overwriting newer edits.
- [ ] Add pagination caps, timeouts, retries/backoff and quota handling.
- [ ] Add audit trail for OAuth, sync, proposals, approvals and restores.
- [ ] Add database migrations with version tracking and backup/restore procedures.
- [ ] Add automated integration tests against a dedicated test blog and OAuth test project.
- [ ] Complete privacy policy, terms, data retention/deletion, LGPD process and support contact.
- [ ] Add subscription/billing only after core product/security validation.
- [ ] Review OAuth scopes and Google verification requirements before public launch.
