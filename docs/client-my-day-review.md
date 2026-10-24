# My day client review — 19 October 2026

Implemented: exact greeting/subtitle; task terminology; Today default and tab order; one Add task button; Capture main entry; one manager visibility control; compact links after tasks; linked role checklist with database-derived ticks/progress; pending draft count and Capture link; Back to website; distinct cover/team/department icons; global spacing tokens.

The forwarding card and Copy address render only for a genuinely configured, verified, enabled receiving address. The database deliberately has no seeded address. Provisioning a mailbox/inbound webhook and authenticating an outbound no-reply sender are separate operations. Current email sending does not supply an inbound personal capture address.

Cover and handover status are blocked by the unimplemented handover/approval/cover backend. No such tables or active assignments exist at this change. These messages remain outstanding, rather than being rendered with dummy state.

The header uses the client’s exact Good morning copy regardless of time of day. Decision-linked task entry keeps the full linked-task scope; normal My day entry defaults to Today. Checklist completion means at least one active record in each of five categories; it is not a manual checkbox.

Supabase my_day_summary executes with caller privileges and existing RLS. Forwarding addresses can only be provisioned through trusted server access, and users can only read their own enabled address. No roles, ownership or record permissions were widened.


## 19 October 2026: owner timezone clarification

The owner supersedes the fixed Good morning prefix with a greeting based on the viewer’s browser/device timezone: Good morning before noon, Good afternoon from noon, and Good evening from 4 pm. The first name and exact subtitle remain. Refresh the greeting and Today date every minute and when the tab becomes visible/focused. Do not use the hosting/server timezone. Browser checks compare Lagos evening and Los Angeles morning at the same instant, plus noon transitions.
