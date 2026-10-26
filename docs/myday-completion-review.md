# My Day completion review

This extends the approved 26 October 2026 brief. The completion build passed the browser and database checks. Migration `20261026171201_myday_complete_workflows` is installed. The public deployment is verified against the promoted release commit.

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

The release check passes 168 unit tests, frontend and Edge Function type checks, and the production build. Rollback-only database tests cover company isolation, assignment acceptance, private comments, source-write scope and duplicate suppression, calendar revocation, quiet hours, recurrence and deletion retention. Tests use temporary fixtures and do not send real email, provider messages or paid AI requests.

Browser verification passed the existing workflows, twelve widths for the add control and new panels, Safari WebKit, offline adding/sync, offline reload of the production build, and explicit AI-plan acceptance/cached reuse. Evidence: [Application checks, run 40365837569](https://github.com/donatofaith/vimbre/actions/runs/40365837569), tested source `84168b4e7836bc73554050fa942bc812ced29ada`.

Supporting services: ai-run v18, capture-connect v18, my-day-mail v11, myday-device v1 and myday-calendar v1. Unauthorised requests are rejected; invalid calendar capabilities return no data. The migration grants no client access to delivery credentials, provider update services or private collaboration tables.
