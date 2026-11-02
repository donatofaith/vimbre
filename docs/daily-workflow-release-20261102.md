# Daily workflow release — 2 November 2026

Stars now supports a week-containing calendar picker, previous/next week and comparison with the preceding week. Lifetime task badges unlock at 50, 100, 150, 200 and 250 tasks. Weekly rankings continue to require positive earned stars and existing visibility consent.

My Day proposes owned tasks using urgency, dates, role links and extracted work. Accepting a suggestion records a daily choice without changing its due date or task priority. Every task displays its priority. Decisions use the existing version-checked approval and record workflow; urgent decisions expand automatically.

At account-local work end, the new independent scheduler snapshots completed and pending work, respecting workdays, leave, notification preferences and quiet hours. An in-app notification links to the dated review. Users choose new dates for unfinished tasks. This does not verify email inbox or device push delivery.

The landing page has a bottom-corner support launcher and visitor conversation routed to the existing Console Support inbox. Staff replies return to that browser tab. The visitor capability expires after 24 hours. There is no invented availability or response-time promise. No visitor email is collected or sent. This follows the familiar visitor messenger pattern documented by [Intercom](https://developers.intercom.com/installing-intercom/web/installation) and [Crisp](https://help.crisp.chat/en/article/how-to-install-crisp-chat-widget-on-nextjs-app-xh9yse/).

## Performance

Refresh bursts are coalesced, with at most one read active and one trailing refresh after a mutation. The small source-connection helper avoids a repeated company lookup. A controlled rollback database test of 100 tasks averaged 140.81 ms before and 118.29 ms after (about 16% lower). This is not an end-to-end real-device speed guarantee.

## Hosted installation order

1. stars_week_history
2. daily_priorities_and_wrapup
3. day_review_notification_path
4. day_review_quiet_delivery
5. myday_source_connection_helper
6. website_support_chat
7. support_reply_closure_guard
8. website_support_retention

The website-support Edge Function is active with capability authentication and rate limits. Public JWT verification is intentionally disabled for this guest entry point; its server-only service RPC cannot expose other conversations. Private tables have RLS and no direct customer or Console content grants. Conversation messages survive expired-capability cleanup.

Automatic review rejected broad replacement of the existing My Day tick and task projection. Those replacements were abandoned. The installed implementation is additive, apart from the narrow source helper and closure guard fixes. The uninstalled myday_source_lookup_performance proposal is excluded from this release.

## Validation

- 330 customer unit tests passed, including refresh coalescing and Edge request validation.
- Production builds passed for the customer application and Console.
- Strict Edge TypeScript validation passed. Lint has existing warnings; the untracked QA fixture is excluded.
- PGlite executes actual SQL for owner/company isolation, historical weeks, daily acceptance, quiet-hour delivery, idempotency, capability expiry, retention and guest closure restrictions.
- Hosted rollback tests exercise actual decision recording and guest-to-Console-to-guest replies, without sending email or retaining synthetic identities.
- The independent day-review cron has succeeded. Retention runs daily at 02:15 UTC.
- Browser QA covered six viewport sizes from 320px to desktop, daily acceptance/decision approval/rescheduling, historical Stars and visitor chat. Preview uses sample data.
- Source commits use [skip ci]; no GitHub Actions are needed. Vercel deployment status is checked separately.

Existing live billing verification and email inbox verification remain separate work.
