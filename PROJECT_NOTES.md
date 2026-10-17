# Vimbre project notes

Authority: fresh build from the PRD dated 15 October 2026 and subsequent written decisions. No Bolt implementation is reused.

## Implemented

Responsive foundation, approved glass/blur/brief motion, reduced motion, shared UI, protected routes and typed Supabase integration. Signup creates a company/HR Admin. Login/logout, confirmation/resend countdown, password visibility, recovery and company settings are connected. The live development URL is https://vimbre.vercel.app; vercel.json supports direct SPA routes.

Team setup now includes departments, manager assignment, empty-department archive, member name/role/department/status edits, last-admin protection, expiring email invitations, resend/cancel and explicit verified-recipient acceptance. Small team mode skips departments. Lists are paginated and pickers search. Manager and Employee controls/read scopes remain restricted. See docs/team-setup.md.

Role records and the Decision Log are implemented at /app/role-record. Five categories, workstream linked decisions, source/task links, status filters, paginated title search, archive/restore and the manager visibility panel are connected. Employees edit their own record; HR reads company records and Managers read their department. See docs/role-records.md.

The public website at / is the first visitor page, with its own responsive navigation, product explanation, how-to-start steps, benefits, feature availability, FAQ and account calls to action. Public signup/login remain connected to the protected workspace. Website home in the app and Back to website on account pages return to this public entry. The public landing page explains the product with accurate Available/Coming soon labels and connected signup, login and authenticated workspace links. The design is a working foundation, with final visual polish deferred by user instruction.

Actions are available in My day: open/today/overdue/recently done/archive views, due dates, status, completion notes, decision links, title search, pagination and archive/restore. My day is now personal for every role. Managers and HR read scoped team actions on the separate /app/team-activity page, with a searchable paginated roster and explicit empty/no-department guidance. Examples and persistent field guidance now help first-time users across account, team, role, decision and action forms. Examples never become saved data. See docs/actions-my-day.md.

## Backend and security

Public tables: companies, departments, profiles, activity_log, invitations, email_log, role_items, decisions and actions. Every table has RLS and restricted grants. Authorization uses protected profiles, not editable metadata. Pending invite profiles are inactive. Trusted invitation records determine assigned roles; acceptance checks the verified recipient. One workspace per account; transfers are not implemented.

Privileged helpers live in private. Public RPC wrappers are SECURITY INVOKER and expose only narrow checked operations. The deployed team-invitations function validates tokens with Auth.getUser and HR membership in SQL before requesting mail. Its gateway verify_jwt is false because it performs its own verification; there is no anonymous send path. Email status finalization is service-only. Built-in service secrets stay on the server.

Development migration history: 20261015221743_auth_company_foundation, 20261015221928_tighten_setup_audit, 20261016021024_team_setup, 20261016023106_archive_cancelled_invite_departments, 20261016030026_role_records_and_decisions, 20261016032527_actions_my_day. Keep applied contents immutable. Generated database.types.ts remains the server snapshot; database.ts adds explicit nullable RPC argument overrides omitted by generation.

## Current routes

Public /, /login, /signup, /forgot, /reset-password, /auth/callback and /join. Protected /app, /app/team-activity (Managers/HR), /app/role-record, /app/team, /app/departments and /app/settings. Capture, handovers and cover duties retain honest Coming soon screens. My day now shows saved actions; cover duties will be connected when handovers exist.

## Verification and pending work

Thirteen unit tests, lint, TypeScript/build, four browser suites and live rollback-only database suites passed. Tests do not send email. The user received and confirmed the signup email. The user reported completing the real invitation check on 16 October. Live password recovery inbox acceptance still needs checking. Security advisors flag disabled leaked-password protection; enable the available Auth protection before the pilot (docs/team-setup.md has the remediation link).

Capture/AI, forwarding, handovers and cover permissions remain unimplemented. Next product milestone: the planned handover loop. Actions do not yet have handover links or temporary cover access. Documents are links only and recurring deadlines are notes without automatic reminders. Use a separate appropriately backed-up production project for customers. development currently deploys to the development website; return reviewed releases to main when the release workflow is configured.

## 17 October 2026: draft review workflow

Owner requests final public landing polish before returning to the employee experience. Keep unfinished changes on `draft/*`, which disables automatic Vercel Git deployment. Do not update the live `development` branch until the owner asks to publish. Separate owner-private landing review uses the actual public component and CSS, embedded fonts, working theme/menu/FAQ controls and links to current live account pages. Application and Auth testing remain separate from this landing-only review. See docs/development-and-releases.md.

## 17 October 2026: finish public website before portal work

Owner explicitly requests a complete launch presentation before employee, manager and HR screens. Replaced progress labels and early access copy with the planned launch product narrative. This overrides the PRD availability labelling rule for this unreleased draft only. The PRD fixed headlines and colours remain. Capture, AI review and handovers still require implementation and acceptance before this landing may be released; the marketing changes do not complete those features.

The previous opacity entry and animated blurred layers were removed from public content cards after the owner reported intermittent white blanking. Feature surfaces are opaque with no backdrop filter or fade. Glass effects are restricted to a stable header; motion uses a brief transform entrance and hover feedback. The backing pseudo element stays removed in both themes. No browser visual verification was available locally; the existing browser regression suite now checks both theme surfaces.

Owner now reviews from VS Code with Vite, not the separate ChatGPT review site. Do not update or send that review link. The review banner and standalone review builder are retired. Keep changes on the non-deploying draft branch. See docs/local-development.md.

## 17 October 2026: one authorized Vercel release, then pasteable-code workflow

Owner explicitly authorizes publishing the reference-inspired local landing design now, including pricing and a brand loading intro. This supersedes the earlier draft-only restriction for this release. Automatic Git deployment is restored; future improvements must be given as code blocks and exact file paths, with no assistant GitHub pushes unless asked. Source is pulled from GitHub development, not Vercel.

Corrected the pricing investigation: the newer 15 October PRD leaves pricing open, but the original 13 October Vimbre.pdf contains Starter £29/month (10 people), Growth £99 (50), Business £249 (250), Enterprise custom (250+). Owner authorizes those starting bundles. No invented charges or claim that billing is implemented. No V2 mailbox integrations advertised.

Landing now uses the reviewed dark framed hero and varied grid composition in PRD navy/blue, brief copy, four plan cards, light/dark toggle and transform-only scroll reveals. A static HTML logo/name loading screen fades when the routed page and fonts are ready; a timeout prevents it blocking the page indefinitely. Content cards remain opaque and do not animate filters. Homepage tab title is Vimbre.


## 17 October 2026: reference rebuild and GitHub review

The owner supersedes the pasteable-code workflow and requests publishing the latest landing rebuild to GitHub for Vercel review. Continue landing iterations through this workflow; provide code files when asked. The rebuild uses a centred hero, a large blue glowing arc, wide role-record illustration, bento features, alternating feature rows, the original PRD pricing, FAQ and copyright footer. It retains the logo loading intro and existing account routes. Backend implementation status is unchanged.
