# Free plan and company access codes

Requested by the owner from two client task screenshots on 29 October 2026. The owner selected limited AI for the £0 plan. Conservative launch defaults were communicated before implementation: 3 active members, 100 chat messages per UTC calendar month, 100 MiB of uploaded files, and 15 company-wide AI requests per UTC calendar month, at most 3 per UTC day. AI spend caps are $0.25/day and $1/month; conservative reservations may pause drafting before the request ceiling. Existing paid plan prices, card-required three-day trials and cancellation behavior are unchanged.

New company owners must choose a plan before entering the workspace. Free needs no Stripe card or subscription. Invitees inherit their company's plan. Existing companies are marked as having completed plan choice; existing data and members are retained even when already above a Free cap. The caps block new members/messages/uploads, not reading saved work or deleting unused files. Manual tasks, records and handovers remain available.

The effective AI plan is resolved from current live subscription dates or a valid redeemed company-bound access code, with a Free fallback. This fixes the previous condition where an unsubscribed billing record blocked AI independently of the displayed request allowance. Paid trial remains 15/day under the existing trial limits; Free is a separate plan. Usage counters do not reset when a code is applied or a plan changes. Explicit existing Enterprise contracts are preserved.

## Complimentary access

Codes are single-use, bound to one company, stored only as SHA-256 hashes, expire on a fixed date, and retain the selected plan's request and spend caps. They neither create nor cancel Stripe subscriptions. Revocation and expiry affect the next request without a scheduled job. Issuance is restricted to the database administrator; authenticated users and service-role clients cannot call the issuer. Only an active company creator with the HR admin role can redeem a code in **Plans and billing → Company access code**.

For a database administrator in Supabase SQL Editor, after verifying the exact company:

```sql
select private.billing_issue_access_code(
  (select id from public.companies where name = 'Vimbre Ltd'),
  'starter',
  30
);
```

The raw code is returned once; do not commit it or put it in a URL. This example grants Starter allowances for 30 days from issuance. Change the selected company, plan or duration deliberately. Revoke with the returned code ID:

```sql
update private.billing_access_codes
set revoked_at = now()
where id = '<issued-code-id>'::uuid;
```

## Discounts

New Stripe Checkout sessions allow promotion-code entry. A valid promotion code must first be created in the live Vimbre Stripe account with the client's chosen percentage/amount, duration and redemption restrictions. No discount amount or customer charge was invented or created in this release. Previously opened Checkout sessions may need to expire before the new field appears. No tax collection settings were changed; the client still needs to confirm applicable tax registrations and treatment.

## Validation and release

- Missing public landing cleanup found in PR #22 and merged independently, preserving the mobile fixes from PR #23.
- 218 unit tests passed; application and billing Edge TypeScript checks passed; production build, prerender and offline generation passed. Lint has no errors; existing warnings remain.
- Billing browser suite covers owner plan choice on direct app entry, Free continuation, invalid and valid access-code flows, existing checkout/plan change/refresh behavior and five widths (320–1440).
- Previous task-save/time/hero browser regression passed.
- Database acceptance ran in rollback transactions before and after installation: authenticated owner choice, nonowner denial, company-bound code, single use, expiry, revocation, active member cap, chat cap, storage cap, Free AI limits and preserved Starter spend cap. Fixture identities, messages and files were rolled back. No real email, paid AI call or customer payment was made.
- Migration `20261029124028_free_plan_access_codes.sql` installed; `stripe-billing` version 10 active. Function source matched the prior live version before changing only Checkout promotion-code support.
- Backend-only tables have RLS and no client table grants; the public RPC delegates to a private function with explicit active-company-owner authorization. Anonymous redemption and client issuance are denied. Existing Storage ownership policies remain in place; the added trigger checks server-recorded sizes at completion and permits Storage permission probes.
