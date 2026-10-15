# Vimbre

Fresh build from the PRD dated 15 October 2026. Vimbre preserves decisions, reasons and follow ups so someone covering or taking over a role knows what comes first. The approved glass, blur and brief animations remain in place.

## Start locally

Use Node 24 (.nvmrc).

```bash
npm ci
npm run dev
npm run check
```

The browser uses the connected development Supabase project by default. Its publishable key is public by design; database policies enforce access. To use another project, create .env.local and supply both values from .env.example. Empty or invalid overrides fail configuration validation. Never put service role, AI, SMTP or other secrets in VITE_ variables. Use a separate Supabase project and explicit environment overrides for production.

## Current implementation

- Company signup, confirmation callback, login, logout, password recovery and protected workspace routes.
- Server-created company and HR Admin profile; company settings persisted through the Supabase REST API.
- Company and department isolation, immutable client role/company fields, active membership checks and append-only setup audit history.
- Responsive navigation, shared UI, reduced motion and clear status pages for unfinished features.

Email delivery is **not verified**. Configure Brevo SMTP and the allowed callback URLs before a real signup/recovery acceptance test. See docs/auth-setup.md. Invitations, department management, capture, AI, role records and handover workflows remain future work.

## Structure and checks

src/app contains routing and layouts; src/features contains feature modules; src/lib contains the typed backend client. supabase/migrations records the applied development schema. supabase/tests/auth_isolation.sql contains rollback-only policy tests. PROJECT_NOTES.md records implementation status.

npm run check runs lint, six unit tests, TypeScript and a production build. For browser integration checks, install Chromium with `npx playwright install chromium`, then run `npm run test:browser`. Browser checks intercept Supabase traffic with test fixtures; database policies are checked separately against PostgreSQL.

Develop on development and review the existing pull request before merging main. Old Bolt code is not reused.

## Hosting

npm run build produces dist. Configure the host to rewrite application paths to /index.html. Set the Supabase Auth Site URL and redirect allowlist to the actual deployment origin before testing confirmation and password recovery. No public deployment is created by this change.
