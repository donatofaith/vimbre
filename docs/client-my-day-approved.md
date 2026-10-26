# Approved My Day brief — 26 October 2026

Authority: the two client screenshots supplied by Donato, image(20261026-110936).png and image(20261026-111012).png. These supersede the earlier ranked My Day brief where they differ. Keep role, Capture and company privacy boundaries. No AI on page load and no automatic confirmation or provider writes.

## Required presentation and corrections

List by default; Board and Week in a view menu. One filter menu: Today, This week, All, Done, Deleted. Overdue is a section. One Star replaces pin and priority. Default task statuses are To do and Done; optional In progress lives in the panel or Board, with a small row chip. Top controls: search, filter menu, view menu, plus menu (Add task, Capture, Add from template, Add from My role). Slim rows show checkbox, title and date; details live in side panels. Footer link: Who sees my tasks. Hide complete Get started and empty sections, except Today: “You’re clear for today.” Header: “2 today, 1 overdue, 3 to review”. One shared calculation supplies counts. To review replaces both Decisions waiting and Waiting on you. Coming up has one truthful list.

Section order: Overdue, Today, Coming up, Waiting on others, Covering for, Done today. Overdue is due before now; Today is due today or starred; Coming up is next seven days and undated. To avoid duplicate task rows, Overdue takes precedence over Today, and Today over Coming up. Sort Star first, due time, oldest. Local dates follow personal settings.

## Required task workflow additions

Source chips retain excerpt and mark disconnected tools; Open in app. Decision link or Link a decision. Capture drafts in To review with Accept/Edit/Dismiss; suggested owner/date/reminder, duplicate protection and 30-day draft archive. Plain-rule quick add (N), no AI cost. Reminders at chosen time, next morning, then Overdue. Snooze, Tomorrow, later today, next week or picked date. Repeat daily/weekdays/weekly/monthly/custom, one open instance; mark missed when next is due. Waiting on others with Nudge; cover with Hand back. Away/handover warning. Optional outcome on Done. Undo Done/Delete for ten seconds. Steps, links, files, label, planning-only time needed (15/30/60/120 minutes). Move overdue to today. Multi-select, mobile swipe and keyboard shortcuts.

Soft deletion retains tasks 30 days with Restore/Delete forever. Source/decision-linked deletion requires confirmation and keeps source/decision. Repeat deletion chooses instance or future series. Owners/creators delete their tasks; notifying an assignee when creator deletes. Cover only hands back. Managers cannot delete employee tasks; only Super admin exception is audited. Drafts Dismiss. Done tasks remain on the Record. Permanent removal only after 30 days or company data request.

## Required AI, collaboration and platform additions

Plan my day on tap: due dates, Stars, time needed, working hours; one-line reasons and accept/reorder. Opt-in daily briefing. Summarise this conversation on tap in panel, cached. AI allowance governs all three, manual work continues at limit. Email/web/mobile push, quiet hours, digest. Week/calendar export and revocable private calendar feed. Scoped direct-report team panel, away/covering, exact visibility disclosure. Comments/@mentions, notification, author edit/delete, separate private notes. Assigned tasks require Accept/Decline/Suggest a new date. Board To do/In progress/Done.

Update source only after explicit confirmation: Slack/Teams reply, Trello comment/move, email reply draft; audit all writes and show Reconnect when expired. Settings rules: Capture draft, overdue interval, done triggers; owner, label, notification, reminder, manager-notify actions. Personal/company templates and steps. Offline view/add with later sync and conflict notice. Installable phone app with push. CSV import and CSV/PDF export. Personal language/date style.

Company switches cover AI/allowance, email/push, per-tool source updates, manager team view, company rules/templates and calendar feed. Record each mutation/event; reserved metadata schema version.

## Implementation review in this branch

The existing feature/my-day-client-approved branch contained terminology/CSS changes and an unapplied additive field migration. It did not implement the full brief. This work preserves that branch history and fixes the compact layout, side panels, Done filter, Overdue partition, shared scoped counts, hidden empty sections, footer disclosure, unbounded Star, ten-second server-enforced Undo, owner-only delete and restore window, Tomorrow/move to today, rule-based quick add (including the weekday reminder example), Board/Week choice, undated tasks in Coming up, planning fields, captured source/excerpt and connection status, Accept/Edit/Dismiss draft cards with duplicate blocking, shared sidebar counts and append-only task events. Existing approved Capture/handover APIs remain in place.

The complete additions above are acceptance requirements, not a claim that they are all implemented. Further workflows (assignment/repeats/rules/templates/push/offline/AI planning/provider writeback and calendar feeds) must not be presented as working until implemented and verified end to end.
