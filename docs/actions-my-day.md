# Actions, My day and input guidance

My day (`/app`) now lists real actions owned by the signed-in person. An action has a title, details, due date, open/in_progress/done status, optional source and decision link, completion note and server-controlled completion time. All open shows unfinished work by due date; Due today and Overdue use the browser's local calendar date. Recently done orders completed work by completion time. Archived records can be restored. Search and every list/picker are bounded to 20 results with pagination or narrowing search.

Only the owner can create or change their actions. Managers read department actions and completion notes; HR Admins read company actions. The member picker follows profiles RLS. Owners, companies, timestamps and identifiers have restricted update grants. Composite decision keys prevent cross-company and cross-owner links. A trigger rejects new links to archived decisions, retains old links for history, timestamps completion and clears the completion time when reopened. Reopening preserves the previous note as context. Hard deletion has no client grant. Change audit uses database triggers; `log_action_view` logs opening the UI for an authorized owner, not every direct REST request.

From a decision in the employee's own role record, View linked actions opens My day filtered to that decision. New actions in that view start linked to it. The user can change or clear that selection before saving. Existing source/task URLs still point to external tools.

The completion form asks “Anything the next person should know?” Notes are optional. There is no handover table or cover assignment yet, so this milestone does not grant cover access, create handover links or send notifications. These will be connected with the planned handover loop. Reminders and automatic recurring action generation remain future work.

## First-time guidance

Shared inputs show examples for names, emails, departments and passwords. Role forms use examples tailored to each category, with explanations of responsibilities, workstreams, external contacts, documents and recurring deadlines. Decisions explain the reason, person, date, source and statuses. Actions explain outcomes, dates, progress and completion notes.

Placeholders are never input values. They disappear while typing; persistent field hints remain and use `aria-describedby` so assistive technology can read them. Date controls use persistent instructions because native date inputs do not reliably show placeholders. No example is inserted into the database automatically. Existing saved values are retained.

## Non developer checks

1. Open signup or login. Check the examples, then open Role record and add a record. Read the example without typing; saving should still require the real title.
2. Open My day and Add action. Enter your own title and due date, optionally link a decision, then save and refresh.
3. Check Due today, Overdue and All open. Each view should show matching real work only.
4. Complete an action and leave a note. Open Recently done and check the note remains after refresh. Reopen it and check it returns to All open.
5. Archive an action, open Archived and restore it.
6. Open your Decision Log and use View linked actions. Add an action there and verify its selected decision.
7. As a Manager, choose a department member and Recently done. Read the outcome; there should be no edit or completion buttons. Someone outside the department should not be listed.
8. Test the example forms on a phone and with the keyboard. Labels and guidance should remain readable without horizontal scrolling.

## Technical checks

`npm run check` runs lint, thirteen unit tests, TypeScript and build. `npm run test:browser` runs four intercepted-network suites for authentication, team, role/public and actions. These do not create real records or send mail. The action suite covers required examples, create/edit, failed-save draft retention, local due-date views, completion/reopen, archive/restore, decision filter/search/pagination, read retry, manager read-only and phone layouts.

For database checks, prepend `supabase/tests/team-fixtures.sql` to `supabase/tests/actions.sql`. The entire transaction rolls back. It covers two companies, owner and role scopes, decision links, due dates, audit, server timestamps, completion history, archive/restore, unsafe URLs, inactive callers and anonymous access. Auth isolation and role-record suites were also rerun.

No new database security advisor findings. The previously known disabled leaked-password-protection setting remains: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
