# Release status — live checkout held

Owner approved the live release. Migration 20261028111439 is installed; installed-schema acceptance passed. ai-run v29, my-day-mail v19 and stripe-billing v7 are deployed with existing authentication preserved. Live signature endpoint rejects unsigned requests (400); existing email credentials are configured (invalid scheduler token returns401, not missing-config503). No real customer was charged or mailed during checks.

A real launch blocker was found: task_delivery_config.enabled=false and the existing dispatcher only runs for task jobs, so the trial reminder worker would not reliably run. A separate billing-mail Edge handler and private per-minute billing dispatcher were prepared and rollback-validated. Automatic approval review rejected persistent installation of 20261028111808_billing_trial_dispatch.sql because the new scheduler/email effect needed specific approval. Do not bypass this rejection.

To prevent incomplete live activation, LIVE_CHECKOUT_ENABLED=false is deployed. Migration 20261028112037 restores the previous AI gateway behavior while activation is held; ordinary users are not blocked by the partial rollout. The new private billing schema remains installed, but no live Checkout can start. The pending frontend is not published yet.

Final activation requires approval of the billing dispatcher and enabling live checkout. Then: install/reconcile dispatcher migration, deploy billing-mail, run an authenticated empty-queue scheduler probe, apply supabase/proposals/activate_live_billing.sql, set LIVE_CHECKOUT_ENABLED=true, deploy billing Edge, and merge/publish the customer-facing release. Confirm live signature and provider readiness without real charges. The existing task-mail preference remains disabled and unchanged.

# Updated client rule: card-required trial and reminder

This supersedes earlier no-card trial wording below. The client now requires a saved card before starting the free trial. The live Checkout collects the card and creates one 3-day Stripe trial; the authoritative trial starts at successful Checkout, not account signup. The card is charged the monthly price at expiry unless the customer cancels. Cardless companies cannot enter the AI trial. Previously used trials are not granted again. Creating an account and using manual work remain possible without a card.

A transactional email confirms the trial/price/date, then a separately scheduled reminder is due 24 hours before the charge. Both include the monthly amount, cancellation link and charge date in UTC. Stripe's default reminder on a 3-day trial is immediate, so it cannot alone satisfy the requested 24-hour timing. A private idempotent reminder queue is drained by the existing authenticated mail scheduler; cancellation suppresses future reminders. Failed sends retry boundedly; ambiguous sends are held for review. Tests use stubs, never real recipients. Existing role/task reminders continue if the billing queue fails.

All 213 tests, types, lint and build pass. Rollback SQL additionally verifies no early ending reminder, a single reminder at the 24-hour boundary, concurrent claim deduplication and no cardless AI trial. Live activation remains blocked by the earlier automatic approval review; the updated migration also includes the reminder queue and service-only delivery RPC. No live SQL, Edge or frontend from this release is installed.

The older implementation notes below are historical where they conflict with this section. The previous last-48-hours trial restriction applies to sandbox only; live trials now start at card-confirmed Checkout with trial_period_days=3.

# Live Stripe release — pending explicit migration approval

Client rules: 3-day free trial, no card required at signup. Settings → View plans → landing pricing → chosen plan → authenticated billing review. Existing subscribers review a change to their existing subscription instead of buying a second subscription. Settings also links directly to Manage subscription.

## Live Stripe resources created
Merchant: Vimbre Ltd, acct_1UUpbY4AwSci2kG6.
- Starter £29/month: price_1UVUXb4AwSci2kG6vvor5nsm (10 active people).
- Growth £99/month: price_1UVUXg4AwSci2kG6AX2jfzEK (50 active people).
- Business £249/month: price_1UVUXm4AwSci2kG6lxKPqCNa (250 active people).
- Portal bpc_1UVUXr4AwSci2kG6U0pXZ19d: price changes enabled, immediate invoiced prorations for upgrades, decreasing-price changes scheduled at period end, existing trial continues, cancellation at period end, invoices and payment methods enabled.
- Webhook we_1UVUXx4AwSci2kG62knA1OIn: /functions/v1/stripe-billing/live-webhook, API version 2026-08-26.dahlia.
No customer has been charged and no real subscription was created by the agent.

## Backend and privacy
Test and live keys, signatures, customer mappings, event tables and catalogues are isolated. The default endpoint is live; explicit /sandbox and /webhook remain test-only. Live runtime requires STRIPE_LIVE_SECRET_KEY with rk_live_ prefix and STRIPE_LIVE_WEBHOOK_SECRET. Missing credentials fail closed; no production checkout should be advertised as active until configuration and acceptance pass. All actions require verified Auth and active company creator privileges. Server-side selected-plan and capacity validation precedes Checkout or portal plan confirmation. Portal previews show pricing before user confirmation. Webhook and refresh reconcile canonical provider state and never use the return URL as proof of payment.

The migration adds private live billing records, service-only RPC and three scoped triggers. A new company's trial starts at company creation, exactly 72 hours, without a card. Existing companies start once on first live billing access; untouched existing companies retain current behavior. Retry does not reset trial. Verified active subscriptions map AI plan quotas; a trial keeps trial quotas. Expired trials, failed/unpaid/paused/cancelled subscriptions pause AI through an AI gateway guard. Existing manual AI-disable settings remain respected. Tasks, saved records and manual operations are unchanged. Member caps prevent new active members above the paid plan; existing users and records are never deleted. A downgrade below current membership may leave the company over capacity; new member additions are blocked until capacity is resolved.

Signup/login/email confirmation preserve only allowlisted plan names, not arbitrary redirects. Enterprise remains contact-only. No annual pricing or tax registration is invented. Automatic tax stays off pending the merchant's confirmed registrations/tax treatment. The portal permits cancellation and upgrades; refund handling remains an operator action.

Stripe Checkout's 48-hour minimum remaining trial is unchanged: a company without a subscription in its last 48 trial hours can subscribe after expiry, instead of being charged early or receiving a new trial. Existing trial subscribers can add their payment method through the portal. This limitation must be assessed before public launch.

## Validation and release status
All 211 tests, lint, Edge/application TypeScript and production build pass. Rollback SQL passed service/client permissions, exact trial/no reset, event replay, environment mismatch rejection, serialized checkout, paid quota mapping, expired trial denial and failed payment denial. Real money payment tests were not used.

Automatic approval review rejected applying 20261028105759_stripe_live_billing.sql because it persistently changes the production schema, AI entitlement gate, member-cap trigger and service permissions. It explicitly requires approval of this exact migration; the general live-billing instruction was deemed insufficient. Do not bypass this block. The migration and dependent Edge/frontend remain undeployed.

After approval: apply migration, reconcile its hosted version, rerun installed-schema acceptance, deploy both stripe-billing and the existing ai-run bundle (preserving every import, route, secret and authentication setting), publish frontend, and verify authenticated live status/portal/price readiness without charging a customer. Owner must copy the live webhook signing secret from Stripe Workbench directly into Supabase as STRIPE_LIVE_WEBHOOK_SECRET. No secret belongs in chat or source. Keep pricing availability disclosures until this has passed.
