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


## 19 October 2026: timezone-aware My day greeting

Owner explicitly replaces the fixed Good morning prefix with local-time greetings. Use the browser/device timezone: morning before 12:00, afternoon 12:00–15:59, evening from 16:00 (owner’s requested evening behavior at 4 pm). Keep first name and Your tasks for today unchanged. The existing minute refresh now updates greeting as well as Today date; focus/visibility refresh handles returning after a time or timezone change. No stored preference or server timezone is assumed. Tests cover local boundaries and the same UTC instant in Lagos and Los Angeles.

## 19 October 2026: red errors and purpose-specific branded email preparation

Shared field-error text previously used navy; it now uses the red error token #b42318. Account errors retain their existing red panel. Server-reported duplicate-signup codes have a helpful login/reset message; generic anti-enumeration signup responses remain generic and are not probed.

team-invitations Edge Function v2 reads inviter/company/role from protected database rows, includes display-only invitation context in OTP metadata, and refreshes it for existing pending recipients. It preserves the existing callback URL and verified-recipient membership flow. Migration 20261019154616 clears the mail personalization fields when the invitation stops being pending, without changing authorization or other user metadata. Rollback SQL and invitation unit tests cover the boundaries.

Prepared 13 branded Auth/security email templates under supabase/templates, with distinct purposes and Vimbre navy/blue design. IMPORTANT: hosted Auth templates are NOT yet changed. The Supabase connector does not expose Auth configuration and CLI reports no Management API access token. User approval is required by browser fallback instructions before opening the dashboard. Apply only the manifest’s subject/content keys and preserve SMTP, sender, redirect allowlist, expiry and notification settings. No real mail sent. Future welcome dispatch and real-inbox rendering checks remain separate; see supabase/templates/README.md.

## 19 October 2026: client-approved team chat

Owner confirms the client wants WhatsApp-style team conversations rather than comments on records and authorizes implementation. Added /app/chat for active employees, managers and HR: selected-participant group chats, reusable direct conversations, message replies with original context, explicit @mention chips, record links, unread conversation badges and a workspace notification bell. Notification/reply links load the relevant history; older history does not mark newer messages read. Text uses safe React rendering. Responsive chat switches from split pane to a single conversation/list on phones. Existing client copy, sidebar Manage visibility and task/record permissions remain intact.

Migration 20261019190141_team_chat creates four RLS-protected tables and narrow checked RPCs. HR role alone grants no private chat access. Only current active same-company conversation participants can read or send. Direct table writes, external record links, cross-chat replies and nonparticipant mentions are blocked. The notification table is in supabase_realtime; the app refreshes immediately on received events, with visible-tab 20-second recovery and focus refresh. Message UUID idempotency and atomic send/notification operations prevent duplicate retries.

See src/features/chat/README.md for scope and verification. Group membership is fixed at creation in this first release. Attachments, group participant administration, message edits/deletion, presence/read receipts and chat email/push delivery are not implemented. Existing Supabase branded templates remain prepared but not applied; domain and inbox work is separate. No chat email or welcome mail dispatch is implied by these in-app notifications.

Chat verification: 31 unit tests, clean lint, TypeScript and production build pass. Live rollback-only SQL passed 25 assertions plus anonymous RPC denial; no test users/messages remain and no mail was sent. Security advisors report no new findings (the existing leaked-password-protection warning is unchanged). All six browser suites passed in GitHub Actions run 39308817779, including chat groups/directs, replies, mention/notification navigation, duplicate-safe retries, text escaping, access failure and fit at 320/360/390/768/1024/1440px. Browser API fixtures are mocked; real two-account websocket/inbox acceptance remains to be tested by the owner after deployment. The earlier duplicate-signup browser fixture now exposes its Supabase API version response header so SDK error codes match real responses; application anti-enumeration behavior is unchanged.

## 20 October 2026: header chat access and notification privacy

Owner approves placing Chat in the top-right header beside the notification bell, removing it from the sidebar. The header icon retains a named accessible link, active state and unread badge on every workspace page, including mobile. Chat breadcrumbs still identify the page. Notifications show New message from [name] or [name] mentioned you with group context and timestamp; message bodies and the duplicate Open chat footer are removed. Clicking an alert retains the original message/conversation route. Replaced the chat welcome slogan with Select a conversation and notification filler with No unread notifications. Preserve concise professional copy and the client's existing page wording. Chat access, data, permissions and delivery behavior are unchanged.

## 20 October 2026: deadlines in the workspace notification bell

Owner requests notifications beyond chat, including approaching/today responsibility deadlines. Added personal task, responsibility and recurring-deadline reminders: Due soon covers the next three local calendar days, followed by distinct Due today and Overdue stages. The combined notification bell counts unread work reminders plus messages; Chat shortcut counts messages alone. Message previews remain absent. Optional responsibility Deadline input is now supported by the database constraint, and recurring-date guidance makes manual next-date updates explicit.

Applied 20261020040754_work_deadline_notifications. Reminder rows are computed from current source status/dates under checked owner+tenant+active-profile authorization; read receipts persist across devices and are idempotent. Rescheduling or a new stage becomes unread again. Completed/archived tasks and archived records are excluded. Source-specific links filter the protected personal task/role list and provide All tasks/All records return links. Work-save/archive events and visible-tab polling refresh counts. No email, cron or push delivery is implemented in this change. Arbitrary recurrence text never triggers automatic scheduling. Existing client My day/Capture/Team copy and access rules are preserved.

Rollback SQL passed 21 assertions plus anonymous denial; all fixtures roll back and no mail is sent. See src/features/notifications/README.md for scope, tests and the optional redundant-index cleanup limitation. Security advisors show no new findings.

## 20 October 2026: official Vimbre brand assets

Owner uploaded public/vimbre-lockup-compact-colour.svg (full logo), public/vimbre-mark-colour.svg (standalone symbol) and public/favicon-192.png, then explicitly requests applying them across the website. Start from the owner's merge e9b614e and preserve their source changes, including account.css. Added a shared BrandLogo component with original colours/aspect ratio and accessible labels. Full lockup appears in the landing header, login/signup/recovery screens, invitation page, workspace brand and retained legacy public header. Compact standalone symbols replace the placeholder circles in illustrative product sidebars. Existing footer copyright-only layout remains unchanged.

The initial loading animation is a branded splash screen. It now displays the original full lockup on white, preloads/decodes the image and retains the progress animation, reduced-motion behavior and existing maximum-time fallback. Navy/blue logos use light supporting surfaces in the dark workspace/product sidebar so their original colours remain legible. The exact uploaded 192px PNG favicon is linked for browser tabs and Apple touch icons. No asset recolouring or replacement artwork is introduced. Browser checks validate the logo resources, favicon dimensions, splash markup and responsive header fit.

## 20 October 2026: automatic company Team chat

Owner approves replacing the custom-group creation interface with one company-wide Team chat, alongside direct messages. Chat opens/creates the singleton automatically and pins it first. Team chat needs no name or participant selection; new active company members join through a protected profile trigger and departing/inactive members lose membership. Existing private groups remain private and retain their history. New joiners can read shared Team chat history. All original reply, mention, private notification and direct-message behavior is preserved.

Prepared migration 20261020060536_company_team_chat and extended rollback SQL to 39 assertions plus anonymous denial. All pass in a rolled-back transaction, leaving no schema or fixture data behind. Local lint, 35 unit tests, TypeScript and production build pass. Hosted apply_migration returned Invalid or expired requestState twice. Automatic approval review rejected a raw SQL workaround that also wrote migration-history metadata, citing deployment consistency risk. No persistent database change has been made; hold development deployment until the migration can be applied normally. Draft browser verification is separate.


Owner explicitly approved the SQL migration and migration-history fallback on 20 October 2026. Applied 20261020060536_company_team_chat atomically with its exact SQL in schema_migrations, after verifying the version/name and schema were absent. Post-apply rollback SQL passes all 39 assertions plus anonymous denial; security advisors show no new findings. All six browser suites passed in GitHub Actions run 39380358954, alongside lint, 35 unit tests and production build. Promoted the tested commit 9c47eaa to development. The prior deployment hold above is resolved.

Email activation follow-up: owner authorizes completing the earlier branded emails. Supabase dashboard email/password sign-in reached an interactive hCaptcha challenge. Hosted email templates have not been modified; manual browser handoff is required to finish sign-in before the prepared subject/content-only changes can be applied. Existing SMTP/sender/redirect settings remain unchanged. Welcome delivery remains separate from Auth templates.


## 20 October 2026: hosted branded Auth emails activated

Owner completed the Supabase dashboard CAPTCHA and sign-in. Applied all 13 prepared purpose-specific subjects and HTML templates through the visible dashboard, preserving their exact repository source. Reloaded each template and verified full HTML via editor copy; sources match, including invitation inviter/company/role display and separate reset/sign-in purposes. Checked the password-change Preview visually. Nine email/invitation unit tests pass. Temporary template-validator throttling was resolved by verifying other work before retrying; final saves all verified. No real inbox emails were sent, so actual delivery and personalized invitation acceptance still need user testing.

Preserved Brevo SMTP credentials/sender, URL configuration, expiry and existing security-notification enablement. Password-change notification remains enabled; six other security notifications remain disabled, with branded designs saved. SMTP host is smtp-relay.brevo.com, port 587, sender display name Vimbre. This resolves the earlier prepared-not-applied template status and dashboard handoff blocker. Domain/no-reply sender verification, support/hello reply routing and a separate post-verification welcome dispatch remain outstanding. No transactional email credential is available in the coding environment. See supabase/templates/README.md for the exact state and remaining work.


## 20 October 2026: customer contact routes

Owner approves a Contact navbar link and public /contact page with support@vimbre.com for account/workspace help and hello@vimbre.com for general enquiries. Shared WebsiteHeader preserves the signed-in Open workspace behavior and mobile navigation. The footer remains copyright-only. Workspace Help now opens a concise Contact support dialog with the support email and All contact options link. Email links open the user's mail app; no contact form, response-time promise or automated support delivery is implied. All 13 account/security templates now include Contact support mailto links, preserving all Auth variables and existing sender settings. No-reply verification and separate welcome dispatch remain outstanding.

Contact release verification: lint, all 35 unit tests, TypeScript and production build pass. All six browser suites passed in GitHub Actions run 39383268880, including public Contact routing/reload, both mailto addresses, mobile menu Escape behavior, copyright-only footer, workspace Help support link and overflow checks at 320/390/640/768/1440px. Deployed tested commit c860d92 to development; Vercel reports success. Live /contact renders both contact addresses and the shared header. Added the Contact support link to all 13 hosted Auth templates and reloaded every source to verify it matches the repository; temporary validator throttling resolved after cooldown. No messages were sent. Existing sender/Reply-To/security switches and Cloudflare forwarding were not changed.


## 20 October 2026: contact section on the landing page

Owner requests contact details near the landing-page footer rather than a separate page. Reviewed Linear contact routing (support vs general inquiries) and Notion's bottom-of-page resources/help navigation. Added a compact How can we help? contact section after the final landing CTA and directly above the copyright-only footer. The Contact navbar anchor scrolls there on desktop/mobile, workspace All contact options links to /#contact, and /contact redirects to /#contact for existing links. Hash scrolling waits for lazy-loaded landing content, including reloads. Both email addresses and the existing email-template support links remain unchanged. No contact form, chat support, download, phone/address, response-time promise or sender change is introduced.


## 20 October 2026: landing page repositioning draft

Owner supplies the complete founder build brief. Prepare the new decision-record positioning and page composition on a draft branch; section 12 explicitly requires founder launch confirmations. Preserve workspace pages and their client instructions. See docs/landing-repositioning.md for scope, current capabilities, missing brand/legal/social assets and the publication gate. Do not present unimplemented AI, forwarding, file upload, handover or cover workflows as active pricing features. The new brief supersedes the earlier copyright-only footer instruction for this homepage.


## 20 October 2026: owner approves landing completion and publication

Owner states that the client approved and instructs completion. This supersedes the prior draft-only hold. Finish the social sharing asset and metadata, three-loop final-frame behavior, initial HTML startup and production auditing, then promote the tested commit to development. Preserve original colour logo assets until the actual reverse logo is supplied. Privacy/Terms content has not been supplied; prepare content-driven routes and conditional links, without inventing legal policy or publishing empty documents. Missing documents and brand files remain factual outstanding items, not a new approval request. Live domain and Lighthouse results must be reported accurately.



## 21 October 2026: revised founder landing brief

Owner supplies a revised situation-led brief and screenshots showing detached lines and overlapping hero tiles, authorizing direct GitHub implementation and Vercel review under the existing workflow. New headline: Someone leaving or away? The next person already knows where to start. Replaces the definition-heavy hero, My day marketing section and old hero tiles with daily role-record growth, Employees/Managers cards, six FAQ answers and a single app-component product story. Search, schema and social text follow the new brief. Notes has one correctly attached connector, matching the one working input. No AI, mailbox forwarding, cover access, HR readiness or completed-task context implementation is added by this marketing work. AI example is explicitly Coming soon; HR card omitted as instructed. Actual legal and reverse-brand materials remain outstanding. See docs/landing-repositioning.md for conflicting word/layout/playback requirements and their resolution.


## 21 October 2026: retain the original hero animation

Owner explicitly rejects the replacement app-window animation and instructs fixing the original lines instead. Restore the sources > decision record > Sam away > Alex covering story, original 8.6/7.6-second timing and three plays. Remove the small repeated Works next to the tools you already use line under the hero buttons. This instruction supersedes the revised brief for these two elements only; preserve the new headline, other page copy, six FAQs, metadata and pricing. Use grid gutters for the curved source connectors and matched columns for the record-to-Alex connector, so endpoints stay attached at every width without absolute page coordinates. Keep sources, people and record in separate non-overlapping grid rows. Mobile stacks cards and hides connectors; reduced motion/no JS retain the complete static frame. One Example tag covers the story. The rejected AI preview scene and its Coming soon label are removed; AI remains unimplemented.


## 21 October 2026: dashboard and My role client review

Owner requests direct GitHub implementation of the attached My role brief plus collapsible sidebar, smaller logo, creator Super admin label, more spacing and locked Settings email/team structure. See docs/client-role-review.md for the complete current behavior and external-service limits. Preserve earlier client My day, Team activity and Capture wording. The responsibility write policy is explicitly replaced by manager/HR editing, with owner-only private notes and approval proposals; other role tabs permit scoped manager/HR edits. Personal task writes and private Capture sources are unchanged.

Applied workspace_settings_lock and role_record_review through the normal migration tool. Original files created with Supabase CLI. SQL rollback tests passed settings grants/trigger, employee responsibility denial, manager changes, private notes, approved suggestions, controlled role context and company isolation. All fixtures roll back; no email or message is sent. Security advisors report no new findings; the existing leaked-password-protection warning is unchanged. Private document bucket is limited to 10MB and allowed file types. AI and Stripe remain unconfigured; controls must not imply generated drafts, email ingestion or a completed subscription.

Invitation Edge Function version 3 deployed with the explicit deno.json import map, original fixed callback and getUser verification. Main-domain CORS now permits https://vimbre.com and www. An unauthenticated main-domain request returns 401 with the correct CORS header. SQL tests also passed private Storage object isolation and invitation-context acceptance, including rejection of forged metadata role authority. Repository migration versions match the hosted migration history: 20261021015857 and 20261021020048.

Release validation: GitHub Actions run 39532643545 passed all seven browser suites and all 35 unit tests, lint, TypeScript and the prerendered production build on commit 2f8faee. Browser checks cover persisted full-width collapse, independent mobile navigation, founder label, locked email/structure and name-only Settings saves, per-tab fields, retained edits on errors, private upload/signed link requests, employee read-only responsibilities, notes, suggestions/approval, manager editing, readable dates, pagination and fit at 360/768/1024/1440px. Screenshots reviewed on desktop and phone. API fixtures are intercepted; actual policy/acceptance/isolation checks use rollback SQL. No real emails/messages were sent. This release documents the remaining AI-provider and Stripe-checkout dependencies, without claiming they work.

## 21 October 2026: isolated AI gateway

Owner explicitly requests the gateway only, with no other feature changes. Added service-only ai_models/ai_task_routes, the missing ai_usage ledger, and ai_company_limits for explicit daily/monthly request and USD spend caps. Applied ai_gateway normally as migration 20261021024056; repository filename matches the hosted version. Model IDs/rates verified against current Anthropic docs: Haiku 5.5 for capture_extract/tidy_text/weekly_summary, Sonnet 5.5 for handover_draft, with reciprocal fallback. Nullable temperature uses the provider default because Claude 5.5 rejects custom sampling. Existing app had no provider calls; the new runAI client is not wired to buttons and no feature/UI/payment is enabled.

ai-run is deployed with platform JWT validation plus getUser and protected active-profile authorization. Company/user/model fields from the body are rejected. A per-company row lock reserves both possible attempts before calling Anthropic. Each attempt is limited to 30 seconds, including free token preflight; fallback is attempted at most once. One usage row includes both attempts and price snapshots. Unknown provider bills retain an explicitly estimated maximum; worker crashes retain pending reservations, not silent refunds. Errors allow manual continuation; generated content is never saved to feature tables. Secret values were not read, committed or copied to the browser.

Local npm run check passed 61 tests (26 new gateway tests), lint, both type checks and the unchanged prerendered frontend build. Rollback SQL passed table/RPC customer denial, routes, company scope, pending reservations, daily/monthly count/spend limits, disabled routes/models, duplicate references, price snapshots, exact fallback accounting and unknown-bill estimates. No fixture, test budget, email or paid provider call remains. Supabase advisors show the four expected RLS-with-no-policy INFO notices and the unchanged Auth leaked-password warning. See docs/ai-gateway.md for files, contract, tests, costs, activation and concurrency acceptance. No company budget was supplied, so gateway spending remains disabled until the operator explicitly configures approved caps and the Anthropic secret.
