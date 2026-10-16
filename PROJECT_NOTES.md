# Vimbre project notes

Authority: fresh build from the PRD dated 15 October 2026 and subsequent written decisions. No Bolt implementation is reused.

## Implemented

Responsive foundation, approved glass/blur/brief motion, reduced motion, shared UI, protected routes and typed Supabase integration. Signup creates a company/HR Admin. Login/logout, confirmation/resend countdown, password visibility, recovery and company settings are connected. The live development URL is https://vimbre.vercel.app; vercel.json supports direct SPA routes.

Team setup now includes departments, manager assignment, empty-department archive, member name/role/department/status edits, last-admin protection, expiring email invitations, resend/cancel and explicit verified-recipient acceptance. Small team mode skips departments. Lists are paginated and pickers search. Manager and Employee controls/read scopes remain restricted. See docs/team-setup.md.

## Backend and security

Public tables: companies, departments, profiles, activity_log, invitations and email_log. Every table has RLS and restricted grants. Authorization uses protected profiles, not editable metadata. Pending invite profiles are inactive. Trusted invitation records determine assigned roles; acceptance checks the verified recipient. One workspace per account; transfers are not implemented.

Privileged helpers live in private. Public RPC wrappers are SECURITY INVOKER and expose only narrow checked operations. The deployed team-invitations function validates tokens with Auth.getUser and HR membership in SQL before requesting mail. Its gateway verify_jwt is false because it performs its own verification; there is no anonymous send path. Email status finalization is service-only. Built-in service secrets stay on the server.

Development migration history: 20261015221743_auth_company_foundation, 20261015221928_tighten_setup_audit, 20261016021024_team_setup, 20261016023106_archive_cancelled_invite_departments. Keep applied contents immutable. Generated database.types.ts remains the server snapshot; database.ts adds explicit nullable RPC argument overrides omitted by generation.

## Current routes

Public /, /login, /signup, /forgot, /reset-password, /auth/callback and /join. Protected /app, /app/team, /app/departments and /app/settings. Capture, role record, handovers and cover duties retain honest Coming soon screens.

## Verification and pending work

Eleven unit tests, lint, TypeScript/build, both browser suites and live rollback-only database suites passed. Tests do not send email. The user received and confirmed the signup email. A real invitation inbox acceptance test and live password recovery acceptance still need a team-selected recipient. Security advisors flag disabled leaked-password protection; enable the available Auth protection before the pilot (docs/team-setup.md has the remediation link).

Capture/AI, forwarding, role records, decisions, actions/My day data, handovers and cover permissions remain unimplemented. Next product milestone: role records and decision log, then actions/My day. Use a separate appropriately backed-up production project for customers. development currently deploys to the development website; return reviewed releases to main when the release workflow is configured.
