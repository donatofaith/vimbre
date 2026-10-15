# Vimbre project notes

## Authority
Fresh build from the PRD dated 15 October 2026 and later written product decisions. No old Bolt implementation is reused.

## Current status
Available: project build, PRD tokens, locally bundled fonts, shared UI primitives, responsive shell, navigation, not found handling, safe configuration validation and automated checks.
Coming soon: authentication, company creation, departments, invitations, role permissions, role records, decisions, actions, capture, AI, email and planned handover workflows.
No remote Supabase schema, RLS policy, storage bucket or Edge Function is deployed. Workspace pages are public, data free build status screens. They must be protected before private records are introduced.

## Routes
/ is the public foundation page. /login, /signup and /forgot are explicit Coming soon screens.
/app is the workspace foundation. /app/capture, /app/role-record, /app/handovers, /app/my-cover-duties and /app/settings show feature status. Unknown URLs show not found pages.

## Data and security
Three roles: HR Admin, Manager and Employee. Cover is a temporary assignment. One company per user. Every company record will be scoped and protected in the database; frontend route guards alone are insufficient.
No sample business data. AI drafts require human confirmation. Files will be private. No passwords or secrets in business records. The old profiles and departments relationship bug is not imported into this fresh build.

## Configuration
Frontend: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY only. All other keys belong on the server. Copy .env.example to .env.local for development. Keys are not committed.

## Next milestone
Authentication and company setup with reviewed schema, protected routes and two company isolation tests. Update these notes with every implemented feature and test result. Do not mark a feature Available before it is connected and verified.
