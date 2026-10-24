# Client Team activity review — 19 October 2026

The three client screenshots are authoritative for this page. Preserve the previously approved My day requirements and the workspace copy rule.

| Item | Required result |
| --- | --- |
| Company name above page title | Removed |
| Subtitle | See what your team has captured, finished and left open. |
| Return link | Back to My day |
| Overview heading | Pick a person to see their tasks and decisions. |
| One-person empty state | It’s just you so far. Invite a teammate to see their work here. |
| Invitation link | Invite a teammate button |
| Breadcrumb | Company / page name, consistently across protected pages |
| Terminology | Tasks in the interface; internal actions table retained |
| Overview | One row per active member in the viewer’s permitted scope; row/link opens a durable member URL |
| Metrics | Tasks done this week, tasks overdue, drafts waiting, handover status |
| Flags | Overdue tasks, handovers not started, people with no role record |
| Search | Shown only when the company has at least five active members |
| Trust line | You can see confirmed tasks and decisions. You cannot see private drafts or the original emails. |
| Trust link | Opens the same visibility information locally on Team activity, using the shared employee-side panel content; no redirect (owner clarification, 19 October) |
| Manage navigation | Team activity, Team and Departments grouped together; only Managers and HR Admins |
| One-person navigation | Team activity hidden until a second active company member joins |
| Typography | Existing -0.01em heading limit and 0 smaller-text tracking preserved |

## Implemented behavior and access

HR Admins see company-wide rows and flags. Managers retain their existing department-only scope; their flags are explicitly labelled Department overview. The client’s company-wide wording does not grant managers access to other departments. A manager without a department gets a setup instruction rather than unrelated company records.

The overview includes the current viewer when they are in scope. A one-person company shows the exact invitation empty state on a direct visit, while hiding the sidebar entry. Invitations/pending/inactive accounts do not count as active members. Search and flags use the full permitted population, independently of pagination and search results. Pages contain at most 20 rows.

Completed tasks count from Monday at 00:00 in the browser’s IANA timezone through the current time. Overdue tasks count all currently overdue, non-archived, unfinished tasks, including older work; waiting drafts count all pending drafts on non-archived sources. These are current snapshot counts, not a historical report. A role record exists if the member has any active role item or confirmed decision.

Only aggregate draft counts are disclosed as the client requested. No draft IDs, draft titles/payloads, source IDs, original source text, or forwarding addresses are returned. Sources and draft tables keep their owner-only RLS. Public wrappers are SECURITY INVOKER; narrow private SECURITY DEFINER functions authorize active profiles, tenant and role/department before producing aggregates. Employees, inactive users and anonymous callers are rejected. Member detail queries use existing confirmed actions/decisions RLS and contain no Capture calls.

## Still dependent on the handover milestone

The database has no handover lifecycle, scheduled handovers or approval/cover model yet. Consequently, handover status and handovers-not-started counts are explicitly null (displayed as an accessible em dash), never fabricated zeros or “not started” assignments. Implement the genuine handover workflow before enabling these two fields. This review does not complete the pending handover requirement or email-forwarding setup.

## Verification

Rollback-only database tests cover role/tenant scope, aggregate numbers, timezone and pagination/search validation, inactive/anonymous denial and source/draft isolation. Browser checks cover the overview/member tasks and decisions, trust panel link, search threshold, sidebar groups, single-person behavior, retry, pagination, and employee guard. Unit tests reject malformed overview responses. Existing My day regression checks remain.

## Visibility interaction clarification

The owner approved opening the trust explanation directly on Team activity to avoid the confusing My day redirect. Team activity and the employee’s “What my manager can see” panel now use the same `WorkVisibilityDetails` component and exact trust statement. Team activity uses a “Team visibility” dialog title and manager-facing wording; the employee title and wording remain. The trigger is a semantic button styled as a text link. Opening/closing does not navigate, reset filters or replace the current member. Native dialog focus restoration and Escape dismissal are retained. Access enforcement is unchanged.
