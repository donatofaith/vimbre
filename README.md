# Vimbre

Fresh build from the PRD dated 15 October 2026. Vimbre preserves decisions, reasons and follow ups so someone covering or taking over a role knows what comes first. 

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

The user has received a signup email. The user reported a successful invitation check. A live password recovery inbox acceptance test remains pending. Configure Brevo SMTP and the allowed callback URLs before a real signup/recovery acceptance test. See docs/auth-setup.md. Departments, manager assignment, member edits, expiring invitations and recipient acceptance are implemented. Role records and the Decision Log are implemented, including search, status filters, archive/restore and protected read scopes. The public landing page at https://vimbre.vercel.app/ has its own responsive navigation, product introduction, starting steps, features, benefits, FAQ and signup/login links. Website home in the app returns to it. My day now has saved actions, due views, completion notes, decision links and scoped team reads through a separate Team activity page. My day stays personal. Input examples and field guidance help new users. Capture, AI and handovers remain future work. See docs/actions-my-day.md. See docs/role-records.md. See docs/team-setup.md for team setup and its acceptance checklist.

## Structure and checks

src/app contains routing and layouts; src/features contains feature modules; src/lib contains the typed backend client. supabase/migrations records the applied development schema. supabase/tests/auth_isolation.sql contains rollback-only policy tests. PROJECT_NOTES.md records implementation status.

npm run check runs lint, thirteen unit tests, TypeScript and a production build. For browser integration checks, install Chromium with `npx playwright install chromium`, then run `npm run test:browser`. Authentication, team, records/public and actions browser suites intercept Supabase traffic with test fixtures; database policies are checked separately against PostgreSQL.

Work locally from `development`. The owner reviews local changes and chooses when to push. Future assistant improvements are delivered as code blocks unless a GitHub update is explicitly requested. Old Bolt code is not reused.

## Hosting

npm run build produces dist. Configure the host to rewrite application paths to /index.html. Set the Supabase Auth Site URL and redirect allowlist to the actual deployment origin before testing confirmation and password recovery. The development branch deploys to https://vimbre.vercel.app. This is the development site, not a separate customer production environment.

## Local review and publishing

The owner requests landing-page iterations through GitHub and Vercel until the design is approved. Provide code files directly when requested. The owner can also pull `development` for local testing; pushing this branch deploys automatically. See [local setup](docs/local-development.md) and [release workflow](docs/development-and-releases.md).

The four company pricing bundles come from the original Vimbre product notes dated 13 October 2026, page 7, reinstated by the owner's instruction. Pricing is presentation only; no payment or plan enforcement was added.
