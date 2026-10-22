# My day

The 22 October client brief is in `docs/client-my-day-v2.md`. `MyDayPage` is the personal task list; `WorkspacePage` retains a separate, read-only team detail viewer. SQL role values and existing role record permissions are unchanged.

`myday_tasks` derives the owner and company from the signed-in user, applies filters before pagination, uses the personal timezone, and includes unfinished overdue work in Today. Done work appears for seven days. List/Board preference stores only a layout choice, never task content. Keyboard users change status with the same selector used by the board's drag operation.

`myday_action` checks active ownership and locks the row for edits, status, archive, snooze, rescheduling and context. New tasks start To do. Context is a separate explicit save, with a stable result across retries. Open work appends the reviewed outcome and retains the previous next step when no replacement is supplied. My notes uses an owner-only table; it is never part of manager data or AI summary context.

Vimbre AI uses `tasks_extract` for reviewed task suggestions and `task_context` for a reviewed outcome. Role suggestions load only the signed-in user's Responsibilities, Open work and Recurring deadlines after a click. AI department/contact names must be matched to a real choice before Save. Missing AI dates stay blank. No new direct provider call or frontend key exists.

The minutely worker creates recurring tasks once per record/date, skips historical cycles and anchors month-end repeats. Supported repeat rules include daily, weekly, monthly, quarterly, yearly, weekdays, every N days/weeks and first/second/third/fourth/last weekday of each month. New recurring form saves validate this rule before writing; existing records are retained. One bell alert is created at the chosen reminder time and one check-in after due time plus an hour. Snooze/Not yet create a new delivery cycle. Completed/archived/deactivated tasks and old cycles cannot produce another current reminder. Responsibility alerts and chat remain separate.

## Email activation

Bell reminders are active. Email dispatch is deliberately disabled until a sending key and verified sender are configured. There is no outgoing backlog accumulated during this disabled period.

1. In Supabase Edge Function Secrets, set `BREVO_TRANSACTIONAL_KEY` to a Brevo API key with transactional sending permission, and `VIMBRE_REMINDER_SENDER` to the verified sender email. A webhook-only key cannot send these messages. Never put either secret value in browser code or GitHub.
2. Verify the sender/domain in Brevo. Keep `support@vimbre.com` as Reply-To when its support mailbox is ready.
3. After those checks, the operator enables `private.task_delivery_config.enabled` in Supabase. It contains no customer-editable settings. Do not disclose its token hash or the Vault dispatch token.
4. Run one agreed live reminder test. Confirm one grouped email, the correct signed-in task links, notification controls and the recorded provider outcome.

`my-day-mail` authenticates the cron bearer via SHA256 and a service-only claim RPC. It sends grouped recipient batches in a bounded background drain of up to 200 recipients per invocation, with five concurrent deliveries and a 45 second claim window. Remaining work is picked up on the next minute. It stops claiming on provider rejection or uncertainty. Browser calls cannot claim email batches. `sent`, `failed` and ambiguous `uncertain` outcomes are stored; an uncertain provider result is not retried blindly. Email action links open authenticated controls; GET never completes, reschedules or snoozes work. No live email or paid AI call is part of automated tests.

## Verification

- `npm run check`: lint, unit tests, Edge type check and production/prerender build.
- `npm run test:browser`: nine suites including `check-my-day-browser.cjs`, with intercepted APIs only.
- `supabase/tests/team-fixtures.sql` plus `supabase/tests/my-day-workflow.sql`: one rollback transaction. Covers ownership, cross-company isolation, protected delivery fields, context privacy/idempotency, retained Open work, UTC dates, month-end/weekday recurrence and the two-alert cap. Mail is enabled only in the uncommitted test transaction; the HTTP dispatcher is never called.
- Visual review at 360, 768, 1024 and 1440px and a reduced-motion check.
