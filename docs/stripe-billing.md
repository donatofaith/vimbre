# Stripe billing setup — 28 October 2026

The client approved a **3-day free trial**, with **no card required at signup**. Do not replace this with a 7/14/30-day default or restart it when Checkout is retried.

## Current environment
- Live merchant: Vimbre Ltd, `acct_1UUpbY4AwSci2kG6`. Live prices, subscriptions and entitlements remain unchanged.
- Approved development sandbox: Genade Global services Ltd sandbox, `acct_1UUoHn3dlOUNkjoi`.
- Sandbox company bundles: Starter £29/month (10 active people), Growth £99/month (50), Business £249/month (250). Enterprise stays contract-only.
- Price IDs and portal configuration are pinned in `supabase/functions/stripe-billing/catalog.ts`. Sandbox portal supports invoices, customer details, payment method changes and cancellation at period end; plan switching is disabled pending final policy verification.
- Sandbox webhook: `we_1UVTzn3dlOUNkjoiaaIur7uM`, receiving subscription, Checkout and invoice lifecycle events at `https://ijyjrooarwoafkykvzjp.supabase.co/functions/v1/stripe-billing/webhook`.

## Prepared implementation
`stripe-billing` verifies Supabase Auth and active company creator permissions before any Checkout or portal operation. Browser-supplied company/customer IDs are ignored. A persistent server trial deadline lasts exactly 72 hours; retrying checkout does not restart it. Sandbox trial begins on first billing-context initialization; live signup trial provisioning is a separate go-live task.

Only the three pinned GBP monthly prices and quantity one are accepted. Seat capacity is checked before Checkout. Provider subscriptions/open sessions are checked and a serialized database claim plus Stripe idempotency key prevents duplicate checkout creation. Trial Checkout omits required card collection and cancels the subscription if its trial ends without a payment method. Stripe's 48-hour minimum remaining trial in Checkout is respected: during the final 48 hours of the local trial, fresh Checkout is deferred until expiry rather than charging early or extending the trial.

Webhooks require the endpoint signing secret, verify the raw body and timestamp with the Stripe SDK, reject live events, retrieve canonical subscription state and apply a mapped customer subscription idempotently. No success-page callback grants access. The service-only database RPC writes private sandbox tables with RLS deny-all; ordinary authenticated users cannot invoke it. Sandbox subscription state **never writes live AI allowances, team mode or entitlements**.

The test interface appears only at `/app/settings?billing=sandbox`, only for company creators, and clearly labels the test environment. Ordinary settings and public signup are unchanged.

## Release status and blockers
The migration `20261028102015_stripe_billing_sandbox.sql` passed rollback-only SQL acceptance. Automatic approval review rejected persistent installation because it creates tables, privileged functions and service-only permissions in the production Supabase project; explicit approval is required before applying it. Dependent frontend and Edge function are not deployed.

The owner reports `STRIPE_SECRET_KEY` is saved in Supabase secrets. Its value is never read into chat or committed. Runtime requires `rk_test_` and refuses live/unrestricted keys. The second required secret is `STRIPE_WEBHOOK_SECRET`, copied directly from this sandbox endpoint's Signing secret in Stripe Workbench into Supabase secrets. The function rejects webhook/checkout operations while it is missing. No signing secret or API key belongs in source, logs or chat.

After approval and secrets, apply the migration, deploy the Edge function with `verify_jwt=false` (the handler validates user JWTs for billing actions and Stripe signatures for webhook requests), and expose the sandbox test interface. Rerun SQL acceptance against installed schema and test real sandbox Checkout, signed event delivery, portal, cancellation, expired trial, duplicate delivery, payment failure and cross-company isolation. Do not mark the integration complete until this passes.

## Go-live remains separate
Recreate verified prices and portal/webhook configuration in the Vimbre Ltd live account, add separate restricted live credentials and signing secret, confirm tax registrations/tax treatment, and finish live entitlement and signup-trial integration. Sandbox payments must never activate paid AI. Live failure/expired-trial policy must pause drafting only; tasks, saved records and manual work remain available. No annual pricing, tax collection, custom Enterprise charge or automatic live subscription change is invented by this release.

## Checks completed before release approval
- `npm run check`: lint, 210 unit tests in 41 files, existing Edge checks, new Stripe Edge TypeScript check, application build and prerender passed.
- `scripts/check-billing-browser.cjs`: mocked authenticated browser passed webhook gating, 3-day trial display, plan selection, checkout failure retention, hidden ordinary settings and widths 320, 390, 768, 1024 and 1440.
- Rollback SQL: exact trial duration, no reset, customer binding, serialized checkout claim, webhook replay, live-event rejection, creator-only access and ordinary-client RPC denial passed.
- Actual sandbox Checkout and signed webhook delivery remain pending signing-secret configuration and release approval. No real charge or real customer subscription was created.
