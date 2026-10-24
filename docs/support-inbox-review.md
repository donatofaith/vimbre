# Support inbox review — 24 October 2026

Use Starlink's in-app Support → Messages → Contact Support flow as a reference for a message-based support experience, retaining Vimbre's colours, typography and existing customer support API. Reference: https://starlink.com/bi/support/article/bdb63773-e93b-74e8-8e12-2da2fb6d534e

Desktop uses a request list and conversation panel. Mobile shows the request list, selected conversation or new request form individually, with Back to messages. New requests use the main panel rather than a narrow sidebar form. Use consistent control padding, label spacing, readable message bubbles, clear request numbers/statuses and a reply area below the conversation. No duplicate sidebar destinations or generic promotional copy.

Keep unsent replies separately per request while the page is open; keep a new request draft when returning to the list. Failed sends retain text. Failed detail loads offer Retry conversation. Refresh reloads requests/replies. No live-response promise, chatbot, automatic message, real email, attachment upload or new staff capability is introduced.

Preserve customer_support submit/list/detail/reply and its server authorization/rate limits. Test through intercepted requests without sending actual tickets to staff. Browser checks cover desktop/mobile layout, no overflow, separate drafts, successful/failed sends, rate limits, retained new request, detail failure/retry and no AI calls. Screenshots are captured for review.
