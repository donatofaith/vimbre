# Architecture

The new build follows the Vimbre PRD dated 15 October 2026. Bolt prompts and previous code are not the implementation baseline.

- React, TypeScript and Vite render the responsive client.
- React Router handles public and workspace routes.
- Supabase Auth, PostgreSQL, REST Data API and private Storage provide backend services.
- Edge Functions handle AI, email and inbound webhooks. Multi record workflow changes require atomic database operations.
- Database policies enforce company, department, owner and active cover permissions. A hidden button is not authorisation.
- No mock data or pretend authentication. The current workspace is a public, data free foundation page, not a protected application.

Public fonts are bundled from local package assets. Colours and design scales live in src/styles/tokens.css. Feature availability is recorded in PROJECT_NOTES.md.

Before any private records are added, implement verified sessions, route guards and database isolation. Never rely on browser supplied company or role values. Generate database TypeScript types after the schema exists.
