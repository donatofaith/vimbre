# Today priorities and Capture completion — 2 November 2026

## Reported failures

The supplied screenshots show an accepted undated priority remaining in Coming up, and a saved Capture with seven tasks displaying No actions found. Acceptance had only written a daily-choice row, so it never put the task in Today. Capture also remounted draft rows on version changes, invalidated the entire detail view on refresh, and could keep a fully saved conversation in its Check screen.

## Behavior

- Move to today uses the existing owner-checked myday_action date operation with the account-local date. It then records the daily choice and refreshes the shared task/count readers. The button explicitly describes the date change. In Today appears only when the task date matches today, including tasks that were previously accepted without a date. Existing due dates appear beside other priority suggestions before moving them.
- A failed date operation cannot display a successful addition or daily acceptance. The daily-choice write is supplementary; a successfully moved task remains in Today if that preference write fails.
- Priorities validate required response arrays, retain loaded content during background read failures and offer Retry priorities. Duplicate submission is guarded immediately.
- Capture rows keep stable identities across accepted versions; draft fields reset from the authoritative version without remounting the entire card. The source/review layout remains visible while the same capture refreshes.
- Checkmarks stay in review. Save creates the reviewed records. If drafts remain, the remaining review stays open. Saving the last drafts opens a fresh Capture form with a confirmation, View saved items and Open My day. Reopening a fully saved capture shows Saved with the third workflow step selected, never No actions found.
- No permission, SQL definition, original-source or approval rule changes. This uses existing guarded RPCs. No automatic extraction or paid call is introduced.

## References

[Microsoft My Day](https://support.microsoft.com/en-us/outlook/create-and-manage-task-lists-with-my-day-in-outlook) describes adding existing tasks to the day list. [Todoist Today](https://www.todoist.com/help/todoist/get-started/plan-your-day-with-the-today-view-UVUXaiSs) distinguishes tasks scheduled today from undated tasks. [Todoist Inbox](https://www.todoist.com/help/todoist/get-started/use-the-inbox-in-todoist-HwHvYErS) retains unscheduled work for processing. These support clear list membership and visible completion feedback; there is no universal requirement that every product return to an empty form. The return-to-new-capture behavior follows the owner’s request while preserving partially reviewed work.

## Verification

339 unit tests passed; TypeScript and the production build passed. A hosted rollback-only test created an undated synthetic task, moved it using the actual public.myday_action RPC, recorded the choice, then read public.myday_tasks. The task appeared in Today and its count was 1 in Africa/Lagos. No synthetic data was retained.

Browser QA uses actual MyDayPage and CapturePage with sample data. Moving the priority changed the visible Today count from 0 to 1 and showed the same task in Today. A simulated background read failure retained the priority and Retry restored it. Checking a Capture task updated the same accessibility row in place. Saving one task retained seven pending drafts; saving those seven returned to a blank Capture form with the success receipt. View saved items opened all eight saved tasks without the false empty state. The fresh Capture form and receipt fit 320px, 393px, 768px and 1440px configured widths; the workflow indicator returned to Add. A screenshot shows the same priority in both the priority card and Today with a count of 1. These are cloud-browser checks, not a physical-device or complete network latency guarantee.

Publish the six explicit changed files with [skip ci]. GitHub Actions and paid extraction are not used.
