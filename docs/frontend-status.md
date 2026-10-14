# Vimbre frontend handoff — October 2026

## What has been implemented

The **frontend UI** has been built in Next.js + TypeScript + Tailwind CSS, guided by the approved white / blue, modern glassmorphism design. The live application is **not deployed or integration-tested**.

### Public-facing pages

- `/`: complete white glass landing page with hero, feature grid, handover workflow, dashboard preview, PRD-based draft pricing and footer.
- `/pricing`: pricing plans and feature/entitlement caveats.
- `/login`: visual login form (disabled until Supabase Auth is connected).
- `/register`: visual company-registration form (disabled until Supabase Auth is connected).

### Preview application

- `/demo`: switch between HR/Admin, Employee, Manager and Cover Person dashboards.
- `/demo/handovers`: example table of handovers.
- `/demo/handovers/new`: interactive handover-type selector; creation disabled until DB/auth integration.
- `/demo/handovers/sample`: example responsibilities, deadlines, contacts and cover-person actions.
- `/demo/ai`: interactive notes editor and demonstrative review/finalize steps. **No AI calls occur.**
- `/demo/team`: example users and manager approval queue.
- `/demo/settings`: general/branding/subscription visual tabs.

All people, handover statistics, files, dates and statuses in the preview are fictional examples. They are not fetched from Supabase.

## Incomplete / pending integration

1. Supabase Auth, authenticated company membership and Row Level Security.
2. Real CRUD for handovers, related entities, approvals, questions, acknowledgements and documents.
3. OpenAI API for note structuring, with employee review of all suggestions.
4. Brevo transactional email and invitations.
5. Billing provider decision and plan permissions.
6. Upload the final licensed woman-with-laptop hero image. The landing page currently uses a temporary external photograph.
7. Mobile/browser accessibility validation, real build, lint, typecheck and deployment; these were **not run** in this execution environment.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000 and http://localhost:3000/demo.

After installing dependencies, run `npm run build` and `npm run typecheck`. Configure `.env.local` from `.env.example` before connecting external services. Never commit API keys.

## Security

All preview app data is synthetic. Do not turn visual/demo forms into active privileged operations without backend authentication, strict authorization and RLS.
