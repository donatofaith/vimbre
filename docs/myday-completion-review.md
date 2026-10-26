# My Day completion review

This extends the approved 26 October 2026 brief. The release remains a draft until the browser checks, database migration and deployment checks pass.

## Implemented workflows

- Centred SVG add control, descriptive hover and keyboard-focus label, responsive menus and side panels.
- Personal and company templates, manually configured rules, repeating tasks with one active cycle, missed cycles, instance/series deletion and ten-second Undo.
- Pending assignments with acceptance, decline and date suggestions; waiting list, daily nudge limit, withdrawal and hand-back. Capture also uses acceptance when a task is assigned to someone else.
- Shared comments and mentions, author-only editing/removal, separate private notes, private file uploads, decision links, bulk actions and mobile swipes.
- Explicit AI planning with review/reordering, cached conversation summaries, optional scheduled briefing, shared company allowance and manual fallback.
- Chosen-time and next-morning reminders, quiet hours, optional digest and device push. Expired reminders are checked again before delivery. Ambiguous external sends are not retried automatically.
- Calendar downloads and a revocable feed that includes titles and dates, CSV import/export, browser PDF printing, personal date formatting, offline viewing/adding/sync and app installation.
- Direct-report task metadata and away/cover information. Private task details and original conversations remain with the owner.
- Confirmed source updates: email reply drafts, Slack replies, messages in the original Teams chat, and Trello comments or moves within the same board. Every request has a stable reference and an audit event.

## Company and device setup

In Settings, **Company task controls** lets an HR Admin manage AI, email, push, team view, rules, templates, calendar and individual tool updates. Source updates start off and require a fresh connection with update permission. Previously imported captures without a verified provider reference must be imported again before source updates can be used.

**My task settings** contains working hours, quiet hours, date format and optional briefing, digest and push settings. **Enable notifications on this device** registers the current browser. On iPhone, install Vimbre on the Home Screen before enabling push. Signing out clears the device's account binding and offline account data.

A private calendar feed URL grants access to its titles and dates. Creating a replacement or revoking it immediately invalidates the previous token. Calendar applications may retain their already downloaded events until their next refresh.

## Verification

The local check currently passes 166 unit tests, frontend and Edge Function type checks, and the production build. Rollback-only database tests cover company isolation, assignment acceptance, private comments, source-write scope and duplicate suppression, calendar revocation, quiet hours, recurrence and deletion retention. Tests use temporary fixtures and do not send real email, provider messages or paid AI requests.

Browser verification includes the existing workflows, twelve widths for the add control and new panels, Safari WebKit, offline adding/sync, and an offline reload of the production build. Final release evidence is recorded after these checks finish.
