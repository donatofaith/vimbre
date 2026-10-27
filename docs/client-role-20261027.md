# My role: 27 October client specification

The two supplied screenshots supersede the prior role presentation and phase classification. Preserve My Day task behavior and Capture review/confirmation.

- Real readiness: role title, Team department/line manager, preferred cover, at least one current My work item, and every current item checked within the configured period (90 days by default). Identify missing essentials and stale items. The progress ring counts these checks, not filled sections.
- Compact header: My role, exact cover subtitle, Handover ready, Start handover, Preview as cover, Who sees my role. Inline details use Team as the department/manager source. Five collapsible counted sections: My work, Decisions, Contacts, Documents, Deadlines. Compact rows open side panels. One Add menu offers all five item types and Add from a conversation with the selected role. No bottom navigation bar.
- Fields retain old information and add importance, steps, tools/links, who to ask, watch outs, backup person, access directions, Do not change and decision links. Every row displays frequency. Spellcheck is enabled on text inputs. Documents warn against storing passwords; obvious secrets/card numbers are blocked both in forms and SQL.
- Item inclusion defaults on. Private items are excluded from manager views, previews, guides and transfers; notes default private until explicitly included. RLS, role RPCs and handover population enforce this. Changed-since-handover markers, actor/field history, checked date, due-only Still correct, Duplicate, Remove, Undo and 30-day Deleted restoration are retained. Concurrent writes reject stale versions.
- Notes are individual autosaved entries with inclusion switches. Recent outcomes lists saved My Day outcomes with an explanation and per-outcome inclusion. No AI is called for suggestions: repeated completed tasks and repeated confirmed Capture contacts are offered by rules.
- Work/deadline repeating tasks use the existing owned My Day importer and cycle deduplication. Linked tasks, last completion and completed count are visible. The client now defines repeating tasks and review freshness as core, so those paths no longer require the old phase-two flags.
- Manager review requests are role-specific and read only; only the current line manager can approve/comment, and content changes invalidate approval. Team readiness exposes counts only. Company admins can configure the review period. In-app reminders and the existing authenticated Brevo scheduler deliver review nudges without AI.
- Role guide: explicit preview, expiry of at most 30 days, hash-stored random capability, revocation, current-holder validation, anonymous read-only snapshot and browser PDF export. Source Capture IDs, storage paths, private notes and excluded items do not enter the snapshot. Department templates and successor drafts use included role items; successor acceptance is explicit and personal notes/tasks remain private.
- Role summary is five lines, generated only on tap with the centrally priced smaller Claude model and shared allowance. Unchanged input reuses the server cache; Check before saving is editable and nothing is written into the role until Save summary.
- Notifications suppress superseded reminder rows and show each task once with current status.

Verification uses fixture data, intercepted providers and rollback SQL: no paid Claude request or real review email is sent by tests. Full historical test output is not treated as proof of the new UI.

## Verified status

Application checks pass: 186 unit tests, application/Edge TypeScript checks and production build. Browser run 40445653679 passed on runtime source 43e7f8a742ff8d00be10b60134184672c7a31d55, including note autosave/failure retention, all five forms, decision replacement, Undo/restore, cover privacy, summary acceptance/cache and 14 responsive widths. Desktop and phone screenshots were inspected. Subsequent frontend changes only remove an erased TypeScript cast and declare the RPC type.

The exact SQL proposal in supabase/proposals/my_role_client_final.sql passes hosted rollback tests, including real handover population, tenant isolation, raw RLS denial, stale-version rejection, repeating tasks, manager review, successor acceptance, guide revocation and revocation on consent withdrawal. No fixture remains and no provider request or email was sent.

The hosted migration is applied and the installed-schema checks pass. The AI and reminder handlers are active. Cross-origin document sites that disallow HEAD checks require the user to open the link to verify access; the interface reports this limitation rather than declaring a working link broken.


Deployment resumed: hosted migration 20261027040043_my_role_client_final applied successfully after reconnection. The rollback acceptance suite passes against the installed schema. ai-run version 24 and my-day-mail version 13 are active; the latter retains scheduler-token authentication. Frontend publication and live-asset verification follow.

Member allowance display corrected in migration 20261027041234_member_ai_allowance_projection. Active members receive request counts and limits only; pricing, plan and spend stay admin-only. Focused rollback tests pass financial privacy, company isolation and inactive-account denial. This is a database-only correction; no paid AI call or GitHub Actions suite is needed.
