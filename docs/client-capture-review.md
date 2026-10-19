# Client Capture and returning-user review — 19 October 2026

These client screenshot corrections supersede the earlier instruction to send every Open workspace click to login. Preserve the earlier My day and Team activity requirements except where this review explicitly renames the shared sidebar item.

| Item | Required result |
| --- | --- |
| Returning signed-in visitor | Open workspace opens /app; RequireAuth retains account/recovery/invitation checks |
| Public Log in menu | Hidden while signed in; shown for signed-out visitors after session initialization |
| Capture page title | Save what your team decided |
| Subtitle | Forward an email, paste notes or upload a file. Vimbre drafts the decisions and tasks for you to confirm. |
| Step 1 | Add an email or notes |
| Step 2 | Review drafts (unchanged) |
| Step 3 | Confirm and save |
| Archive button | Archive; tooltip: You can find it later |
| Original source disclosure | Read the original email or notes |
| Role destination link | Open in My role |
| Shared sidebar label | My role |
| Side panel heading | Nothing is saved until you confirm it. |
| Side panel categories | Decisions and reasons; Tasks and dates; External contacts |
| Side panel privacy | Your notes and drafts are private to you. Once confirmed, they follow your company’s access rules. |
| Task terminology | Tasks in the interface; internal actions table unchanged |
| AI drafting | Coming soon until an actual AI drafting service is connected |
| Manual draft entry | Secondary button; no empty-state instruction to type drafts manually |
| Confirmed drafts | Removed from Review drafts; shown separately under Saved with output links |
| Dates | 16 Oct 2026, retaining ISO values only in date inputs/storage |
| Heading spacing | Existing -0.01em large-heading and 0 small-text tokens preserved |

## Behavior and scope

The public entry uses the existing authenticated session and protected route, including after a reload. Login/signup remain available to signed-out users. A session never bypasses inactive-account, recovery or invitation checks.

Notes and pending drafts remain privately persisted; the exact client “Nothing is saved…” heading refers to confirmed work records, not the absence of private storage. Failed confirmations remain in Review drafts. Confirmed records stay in Saved across reload and archive/restore. Discarded drafts remain in the database history and are not shown as pending or saved work. Save/update/confirm RPCs and RLS are unchanged.

Dates use a UTC date-only formatter so a source date cannot move to the previous day in American timezones. Invalid dates display Date needed; form values remain native date inputs.

AI drafting, inbound forwarding and file upload processing are not implemented by these copy changes. Availability notices make this explicit beside the requested future-facing subtitle. There is no fabricated AI output or enabled upload/forward control. The client’s requirement to polish AI-generated sentences (including capital I and consistent title capitalization) remains a requirement of the future AI drafting implementation; manual user text and original source text are not rewritten by arbitrary capitalization heuristics.

## Verification

Unit tests validate formatted and invalid dates. The new Capture browser suite exercises login/public return and reload, exact client copy, secondary manual entry, private original disclosure, failed confirmation, pending-to-Saved movement, saved output links, reload persistence and four viewport widths. Existing auth, team, role and task suites remain in the CI run.
