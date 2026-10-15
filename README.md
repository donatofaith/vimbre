# Vimbre

Fresh project foundation for Vimbre, based on the PRD dated 15 October 2026. Vimbre preserves decisions, reasons and follow ups so someone covering or taking over a role knows what comes first.

## Start locally

Use Node 24 (see .nvmrc).

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Supabase values may remain empty while reviewing the scaffold. No account, company or business record is created. When connecting a development project, use only its public frontend key. Never put service role, AI or email secrets in VITE_ variables.

```bash
npm run check
```

This runs TypeScript checks, lint, configuration tests and the production build. npm run preview serves the production output locally.

## Structure

- src/app: routes, navigation and application layouts
- src/components/ui: shared controls, cards and loading, empty and error states
- src/features: feature modules; implemented public and workspace foundations
- src/lib: configuration and backend client boundary
- src/styles: PRD tokens and global styling
- supabase/migrations: future database schema and policies
- supabase/functions: future server operations
- docs: architecture, scope, workflow and manual review checks

## Status

Only the foundation is implemented. Authentication, company setup, data and product workflows are Coming soon. The workspace is public and contains no private records. Read PROJECT_NOTES.md before changing anything.

Develop on development and merge reviewed changes into main. The repository keeps previous files in Git history; this build does not reuse them.

## Hosting

npm run build produces dist. Configure any static host to rewrite unknown application paths to /index.html, so direct navigation to /app and nested routes works. Deployment is not configured by this scaffold.
