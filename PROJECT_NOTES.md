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


## 18 October 2026: approved product-led landing

Owner approves the final light SaaS mockup (generated design exec-c2d19a0a) with actual product previews, PRD plan checklists, flowing blue line details and scroll entrances. Replaces the rejected eclipse direction. Home now uses a single light theme with a navy feature section; no theme switch. Motion uses one-time transform reveals, staggered content and restrained decorative paths, with reduced-motion support. The existing two-circle loading intro and authentication routes remain. All illustrative work content is identified as an example. Pricing uses the original PDF pages 7–8; Business integrations and Enterprise SSO/custom integrations are omitted from MVP marketing. Plan limits, billing and backend handover capabilities still require implementation; this public design does not implement those services.


## 19 October 2026: client My day corrections

Owner explicitly authorizes direct GitHub changes and Vercel deployment for the client feedback. Start from development 348795b; preserve the owner's pasted-code work.

My day now greets the first name with the client's exact "Good morning" wording and "Your tasks for today" subtitle. Today is the normal default; decision-linked entry opens all linked tasks, and read-only teammate lists retain Open. Tab order is Today, Open, Overdue, Recently done, Archived. One Add task control remains. Capture is the main entry. Removed the large duplicate navigation cards and personal-work footer/explanation. Compact handover/cover links appear below the task list. One manager-visibility control remains. User-facing task terminology is consistent across My day, forms, Capture, role records, team outcomes and examples; SQL tables/columns stay unchanged.

Checklist progress is computed from distinct non-archived role-item categories for the current owner. Each row opens its actual section through a validated section query parameter, with a completed tick and genuine 0–5 progress. My day reads real pending capture-item counts, excluding discarded/confirmed drafts and archived sources. Summary refreshes on return to the tab and at 60-second intervals. Sources and drafts remain private; manager role access does not grant source access.

Global heading tracking tokens use -0.01em and normal 0 tracking on smaller headings/text. Replaced tighter local CSS overrides. Sidebar Back to website and distinct cover/team/department icons follow the client wording.

Restored the previously applied capture migration to the repository under its actual live migration version (20261019042036); the owner's src-only push had omitted it. New migration 20261019103715 adds my_day_summary and owner-readable, server-provisioned forwarding-address records. No mailbox is invented or provisioned by these rows. Only a receiving-service-tested, verified and enabled address appears with Copy address.

Outstanding client requirements: no inbound receiving service/domain or actual personal Vimbre address is configured, so the forwarding card has no real address to display yet. Planned handovers, approval state and temporary cover assignments are not implemented in this database; their requested top status messages cannot yet be sourced. Do not fabricate them or describe these two items as completed. Build the actual handover lifecycle/access model before rendering those statuses.

Validation: npm run check passes 19 tests, lint and TypeScript/production build. Live rollback-only my-day-summary tests verify counts, archived/discarded filtering, category deduplication, verified address display and tenant/owner/inactive/anonymous isolation. Browser checks updated for the requested semantics and summary fixtures; run in GitHub Actions. No local browser QA is available in this managed session.


## Interface copy rule — 19 October 2026

Write for people using Vimbre, not for the implementer following development progress. Keep copy concise, professional and tied to a real task. Avoid redundant permission reminders (for example, “Only you can edit your role record”), definitions of obvious controls, repeated page descriptions, development commentary, and promotional filler in the workspace. Keep useful examples/placeholders, actionable empty states, errors, privacy/access details requested by the client, and explanations of material consequences or limitations. Do not conceal missing functionality or imply it is implemented.

The client’s explicit My day wording and behaviors in `docs/client-my-day-review.md` remain authoritative. This copy cleanup must not alter those requirements, backend access rules, routes, counts, checklist completion, icons, or heading spacing. Keep “What my manager can see” and its meaningful visibility details. Apply this rule to future development as well.

## 19 October 2026: client Team activity corrections

See `docs/client-team-activity-review.md` for the exact requested copy, behaviors, metric definitions, privacy rules and incomplete handover fields. The page now opens a paginated aggregate overview and a durable member detail URL with confirmed tasks and decisions. A one-person company hides the Team activity sidebar entry; search appears only at five active company members. Manage groups Team activity, Team and Departments for leaders. All protected breadcrumbs use Company. The exact client trust line links to `/app?visibility=manager`, opening the existing employee-side visibility panel. Explicit client copy remains exempt from general copy cleanup.

Applied migration 20261019145146_team_activity_overview adds narrow aggregate and company active-count RPCs with explicit active-profile tenant/role/department checks. It does not widen RLS on source or draft tables. HR flags are company-wide; manager flags retain department scope. Only numeric draft counts are shared, never private text or IDs. Handover status/count are null until the genuine handover workflow exists; these client fields remain incomplete, as do the earlier handover/cover and inbound email requirements. Existing leaked-password-protection advisory is unchanged.


## 19 October 2026: Team activity responsive fix

The shared mobile table CSS hides column headings and expects data-label attributes. Team overview cells previously omitted those labels and retained a 650px minimum width, creating unlabelled values and internal overflow despite passing a page-width-only check. Every metric now has its exact column label. Mobile shows each member as a two-column metric card with a full-width name; desktop/tablet retain a fitting five-column table. Browser regression checks validate container fit, actual visible metric labels and desktop table layout at 320, 360, 390, 768, 1024 and 1440px. No client wording, access rules or backend behavior changes.


## 19 October 2026: visibility explanation stays on Team activity

Owner approved replacing the confusing My day redirect with an in-place Team visibility dialog. The exact client trust statement remains clickable and shares `WorkVisibilityDetails` with the employee’s “What my manager can see” panel. Manager-facing phrasing describes team access; employee wording and title remain intact. This supersedes the earlier redirect interaction only. No navigation, member/filter state or access rules change. Browser checks cover mobile/desktop opening, unchanged URL, close/focus restoration and Escape.

## 19 October 2026: Capture review and returning-user navigation

See `docs/client-capture-review.md`. New client instructions supersede the earlier always-login Open workspace rule: signed-in visitors now enter protected /app and do not see a duplicate public Log in link, including after reload. Signed-out entry and account guards remain intact.

Capture uses the client’s exact title/subtitle/steps/privacy text and shared sidebar My role label. Manual entry is secondary; empty states no longer instruct users to type drafts manually. Confirmed items leave Review drafts and appear under Saved. Capture display dates are formatted without timezone shifts; date input/storage formats stay ISO. Archive has the requested tooltip. Client-requested Coming soon status is shown for unimplemented AI drafting, forwarding and file uploads. This explicit client requirement overrides the general avoidance of progress labels for these unavailable capabilities only. AI prose cleanup remains a requirement for the forthcoming AI drafting pipeline; this change does not implement AI or rewrite manual/source text. Database grants and RPCs are unchanged.
