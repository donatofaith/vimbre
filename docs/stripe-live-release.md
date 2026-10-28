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
