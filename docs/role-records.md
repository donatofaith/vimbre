# Current role record rules

The 21 October client review supersedes the earlier access and form descriptions below. See [client-role-review.md](client-role-review.md) for current behavior, private uploads, notes, approvals, AI limitations and verification.

# Role records and Decision Log

## Available

At `/app/role-record`, employees can create and edit their own responsibilities, workstreams, external contacts, document links and recurring deadlines. The Decision Log records what was decided, why, who decided, the date, live/replaced/reversed status, an optional workstream, source link and related task link. Decisions may apply to the whole role. Task links point to existing work tools and View linked actions opens the related Vimbre actions in My day.

Every list starts empty, searches titles and loads 20 rows per page. Decisions filter by status. Removed records are archived with `deleted_at` and can be restored. Existing decision links survive archiving a workstream; new decisions cannot link to archived workstreams. The owner, company, category and creation fields cannot be changed through the client. Hard delete has no client grant.

Document links open the external service, which enforces its own file permissions. Uploads, private Storage and signed URLs are not implemented yet. Responsibilities can have an optional deadline. Dated responsibilities, tasks and recurring deadlines appear in the notification bell when due soon, due today or overdue. A recurring deadline stores its next date and a recurrence note; users update the next date after each occurrence. No recurring dates, emails or push notifications are generated automatically.

## Access

Employees read and edit their own records. Managers read their own and their department's records. HR Admins read company records. Managers and HR do not edit another person's role record. Managers with no department have only their own records; small team HR Admins still see the company. Inactive callers, anonymous users and other companies cannot read or write these records. Cover access will be built with handovers.

The owner picker uses profiles RLS, active members, search and a 20 result limit. The workstream picker also searches with a 20 result limit. Composite foreign keys enforce matching company and owner. A trigger validates the referenced item's category. RLS checks protected profiles on every request, so department/access changes take effect without relying on JWT metadata.

Insert/update audit triggers record the actor, record ID, action and time without copying record contents. Opening the role screen calls a narrow checked `log_role_view` RPC; this logs UI opens, not every possible direct REST read. Audit writes have no direct client grant. There are no export/approval flows in this milestone.

The existing glass styling is a working design foundation. Final visual design remains a later pass, per the user's instruction on 16 October 2026.

## Non developer check

1. Open the public site signed out. Check the feature labels, then use Create your company or Log in.
2. Open Role record. Add one responsibility, workstream, external contact, document link and recurring deadline. Refresh and check that they remain.
3. Open Decision Log. Add a decision with a reason, person, date and workstream. Open its source link. Edit the status and filter by that status.
4. Archive a record. Enable Show archived records and restore it. Turn the archive filter off and check the record returns.
5. Sign in as a Manager. Choose a member in the same department. Check that the record is readable and has no edit controls. Someone outside that department should not be listed. HR can read across the company.
6. Open What my manager can see and check its explanation. Test at phone width and use the keyboard to reach labels, controls and links.
7. Visit the homepage while signed in. Open workspace should return to My day without asking for a new account.

## Verification

- `npm run check`: lint, unit tests, TypeScript and production build.
- `npm run test:browser`: authentication, team and records/public flows using intercepted network fixtures. No messages or real customer records are created.
- Prepend `supabase/tests/team-fixtures.sql` to `supabase/tests/role-records.sql`, then execute against development. The complete transaction rolls back all fixtures. Covers five categories, decision status/links, unsafe URLs, archive/restore, immutable identity, owner-only writes, HR/manager reads, department change, two companies, audit, inactive and anonymous callers.
- Supabase security advisors: no database findings. The previously known disabled leaked-password-protection warning remains: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

The public page describes only implemented features as Available. AI capture, forwarding and handovers remain Coming soon. Actions are available in My day. No pricing, public contact inbox, testimonial or results statistics have been invented.

