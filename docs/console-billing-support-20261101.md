# Billing and support checkpoint, 1 November 2026

## Delivered

The configured Vimbre live Stripe webhook now also writes the approved Console subscription and invoice projection after customer billing sync. It uses the existing live restricted key and signing secret, preserves sandbox separation and raw body signature verification, and retries a failed Console write. No new checkout, charge, refund, price, subscription or webhook was created for testing. A SQL insert mismatch in console_billing_sync (four values for three event columns) was corrected without changing its authorization, ordering or idempotency checks.

Only the three verified GBP monthly plans with quantity one are projected. Discounted subscriptions are marked Needs review and excluded from revenue totals rather than counting their undiscounted list price as revenue. Their invoice totals still use Stripe's actual due/paid values. Other unrecognised plan shapes fail closed. Stripe search returned no active, trialing or past due subscriptions at this checkpoint. There is no genuine live subscription event available for an end to end paid acceptance check; no synthetic event is retained as live financial data.

Billing now has company search, status filters, separate subscription/invoice views, subscription details (trial, renewal and cancellation), and an Owner/Finance Stripe subscription link. No records no longer means “Billing is not connected.” Existing role scoped RPCs remain in place. Records remain limited to the RPC's latest 500; server pagination is later work.

Customer Support fills the full workspace. Real AppLayout checks exposed global heading, card and form styles overriding the earlier minimal shell fixture. Support now explicitly overrides those styles. Composer and new request actions remain visible at six sizes from 320 × 568 through 1440 × 900.

Customers choose This solved it or Reopen. An ownership checked customer_support_state RPC records closure/reopening without message content in the audit. A trigger prevents another identity from closing their conversation, including stale staff UI calls. Customer messages automatically move waiting/closed tickets back to open, including inbound email messages. Console queue labels are Needs reply, Reply sent and Closed; staff status editing is removed. Priority and assignment remain.

## Email evidence and outstanding work

The mail queue contains two notifications accepted by Brevo, with cron runs succeeding. HTTP acceptance is not proof of recipient delivery. No Brevo delivery/bounce/spam event or recipient inbox was available to verify the reported missing email. Console now says “Accepted by email provider” instead of suggesting that accepted means delivered; footer copy explains that notifications are queued separately.

Next email work: inspect the provider's delivery logs for those notifications, verify the sender/domain configuration, capture provider message IDs and authenticated delivery/bounce callbacks, then perform an explicitly authorised recipient test. No extra real email was sent during this change.

## Validation

316 customer unit tests, including live projection and actual webhook handler signature/mode/retry cases; 23 Console unit tests; both production builds; billing Edge type check; Console lint and targeted customer lint (existing effect warnings only). Full customer lint still has unrelated existing errors, so is not recorded as passing.

Hosted transaction rollback fixtures verified billing insert/idempotency, customer close/reopen, automatic reply queue movement, cross customer denial and the staff closure guard. All fixture rows rolled back. Security advisor categories/counts stayed unchanged. Browser tests used only local intercepted fixture data and actual production AppLayout/Console App code; no production login, paid transaction or outbound message occurred.

## Remaining billing scope

Paid subscription/invoice event acceptance with a genuine subscription; explicit net recurring revenue policy for discounts; server pagination; trial extension still reads the older separate Stripe credential configuration and needs its own guarded implementation/test pass. Reporting history requires real recorded snapshots and cannot be backfilled with invented financial history.
