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

## Approved visual direction update

On 15 October 2026 the user approved the UI direction and requested glass surfaces, background blur and modern website motion. This supersedes the earlier flat surface restriction for this visual treatment. Use static blur, high opacity reading surfaces, brief opacity and transform entrances and hover feedback. Respect reduced motion, keep solid surface fallbacks and avoid continuous background animation. Product feature availability is unchanged.
