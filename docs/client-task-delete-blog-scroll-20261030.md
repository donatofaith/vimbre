# Task deletion and guide navigation correction

Client video: related guide links changed articles while retaining the previous bottom scroll position. BlogPage now resets document scroll on slug changes without overriding hash anchors.

Client task feedback: Delete belongs in Edit beside Save. A successful deletion must immediately remove the task and its open panel, retaining Undo. TaskCard's standalone Delete control is removed; TaskPanel owns the footer Delete and the existing linked-source/recurrence confirmation choices.

My day previously retained `inspected` snapshots as a fallback when a task disappeared from refreshed groups. Successful deletion now clears matching detail/edit/history/context/reminder/comment views, bulk selection and completion grace rows, and prunes all local task groups immediately. A local deleted-ID guard prevents older in-flight responses resurrecting the task; Undo and Restore clear that guard. Restoring or moving a task to Tomorrow also dismisses stale views. Server data and permissions remain authoritative. No database changes.

Validation: helper tests cover all five groups, immutable snapshots and repeat pruning without count underflow; SSR checks verify Delete placement and absence on Add/view-only panels. Browser checks on actual TaskPanel with disposable callbacks cover desktop and 360px delete, Undo, recurrence choices and failed-delete retention. Browser related-guide navigation opens the new H1 at the top. No real task was deleted for verification.
