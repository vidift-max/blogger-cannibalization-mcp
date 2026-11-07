# Blogger Cannibalization AI — v2.0 alpha

MVP scaffold for a multi-tenant SaaS that connects each customer to Google/Blogger using OAuth, stores tenant-owned data in PostgreSQL, analyzes possible keyword cannibalization, and stages content changes as proposals requiring explicit approval.

## Current scope
- Google OAuth authorization (openid/email/profile + Blogger API scope).
- Encrypted OAuth tokens using AES-256-GCM.
- PostgreSQL schema with user ownership on blogs, posts, analyses, sessions and backups.
- Blogger blog/post listing and synchronization.
- Heuristic title/content similarity analysis (not a substitute for Search Console data or human SEO review).
- Proposed HTML changes are backed up and are not sent to Blogger until the user approves.
- Basic responsive Portuguese dashboard.

## Not production-ready yet
This is an initial implementation, not a completed/approved SaaS. Before real customers or production deployment, complete the security and reliability checklist below. In particular: add per-user refresh-token handling, revoke/disconnect flow, rate limiting, CSRF protection for all state-changing routes, stricter HTML sanitizer/diff preview, transactional apply/restore workflow, audit logs, tenant-isolation tests, pagination limits, observability, billing, terms/privacy/LGPD, and end-to-end OAuth/Blogger tests. Review the `approve` flow for distributed failure recovery before production.

## Local setup
1. Node.js 20+ and PostgreSQL.
2. `cp .env.example .env` and fill environment variables. Generate `TOKEN_ENCRYPTION_KEY` as 32 random bytes encoded in hex; use a separate random `SESSION_SECRET` (32+ characters).
3. In Google Cloud Console, configure OAuth consent and a Web application client. Add the exact redirect URI from `GOOGLE_REDIRECT_URI`.
4. `npm install`, `npm test`, `npm start`.
5. Open `BASE_URL`. Each customer clicks **Conectar com Google**; customers do not provide API keys.

## Render
`render.yaml` describes a Docker web service and PostgreSQL database. It intentionally leaves OAuth credentials and cryptographic secrets as environment variables to be entered in Render. Verify the current Render plan availability/cost before creating paid resources. Do not deploy until the production checklist is completed.

## Safety
Never commit `.env`, tokens, OAuth client secrets, database credentials, or encryption keys. Do not run content updates without a user-approved proposal and a verified backup. This alpha is not authorized for unattended bulk edits.
