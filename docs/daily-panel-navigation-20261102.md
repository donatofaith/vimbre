# Daily panels and task navigation — 2 November 2026

The priority and day-review links previously changed /app?task=..., remounting My Day and selecting All. Priorities only render in Today, so the interaction appeared to reload the site and lose suggestions.

Both daily sections now open tasks through a targeted, owner-checked myday_tasks read and the existing task dialog, without changing the route, selected filter, layout or priority state. Completed and unfinished review tasks use the same action. Change priority opens the existing edit form directly. Lookup errors remain in the daily section and never fall back to another task.

Priorities for today and Your day in review have Close and Show controls. Each section remembers its collapsed state for the account and local day in the current browser session. Hiding the content preserves drafts and suggestions and does not call AI. Retry keeps already-loaded priorities visible. An accepted suggestion whose task date moved away from today offers Accept for today again instead of displaying a stale success label.

Validation: targeted lookup tests verify completed-task resolution, owner-filtered request shape, missing records and failed reads. Sample-data cloud browser checks verify task opening/closing, unchanged Today filter, preserved priority list, direct priority editor and independent close/reopen of both sections. The production landing page has exactly one visible Log in link at desktop width. Existing authentication, AI allowance, decision approval, task history and daily-review permissions are unchanged.
