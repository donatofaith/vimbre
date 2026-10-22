# Vimbre AI gateway

The gateway was delivered in isolation first. The owner subsequently authorized connecting the pending website AI features. Capture extraction, reviewed text tidying, weekly summaries and handover drafting now use this gateway. Payment integration remains separate. See docs/ai-features.md for the current UI and activation limits.

## Routing

| Task | Primary | Fallback | Maximum output tokens |
| --- | --- | --- | --- |
| capture_extract | Claude Haiku 5.5 | Claude Sonnet 5.5 | 4096 |
| tidy_text | Claude Haiku 5.5 | Claude Sonnet 5.5 | 2048 |
| weekly_summary | Claude Haiku 5.5 | Claude Sonnet 5.5 | 4096 |
| handover_draft | Claude Sonnet 5.5 | Claude Haiku 5.5 | 4096 |

The server's tasks.ts supplies the instruction for each task. The model never chooses its own routing. These drafts use only supplied text and have no tools or side effects. Future callers must validate structured extraction before displaying or saving it. Nothing is saved to feature tables by the gateway.

Anthropic sources verified 21 October 2026:
- https://platform.claude.com/docs/en/models/haiku-5-5/overview
- https://platform.claude.com/docs/en/models/sonnet-5-5/overview
- https://platform.claude.com/docs/en/about-claude/pricing
- https://platform.claude.com/docs/en/build-with-claude/token-counting

IDs: claude-haiku-5-5 and claude-sonnet-5-5. Initial USD prices per million input/output tokens are 0.10/0.50 and 2/10 respectively. Haiku's higher tier starts above 100,000 input tokens; this gateway allows at most 16,000 UTF8 bytes of source text and preflights at most 32,768 input tokens including the system prompt. No prompt caching, tools, regional surcharge or batch option is enabled. Update verified prices before changing those assumptions. Temperature remains a nullable route field and is seeded NULL, because these models reject custom sampling settings. The Anthropic adapter refuses non-null temperature without making a paid request.

## API

POST /functions/v1/ai-run

Send a signed-in Supabase user JWT, Content-Type application/json and optional Idempotency-Key UUID. The only body fields are task and text. Sending company_id, user_id, model, system, credentials or sampling controls is rejected. Auth.getUser verifies the user and a protected active profiles row supplies the company. Anonymous/unverified/inactive accounts are denied. The service-only reservation rechecks active membership and obtains the company independently.

Success: {ok:true,text,request_id}. Failure: {ok:false,message,can_continue_manually:true}. The browser wrapper src/lib/ai-gateway.ts also converts platform errors and network failures into a plain manual-continuation message. Future features call runAI(task,text), never a provider. Retain a request reference when retrying a transport failure. Reusing it never repeats a provider call; because generated text is not stored, an earlier lost response cannot be replayed as a cached draft.

No provider calls existed in the inspected application; therefore no feature needed migration. The wrapper was initially delivered without UI wiring; the later AI feature integration now calls it by task name. Static tests prevent provider endpoints or keys from appearing in frontend source.

## Private tables and quotas

ai_models, ai_task_routes, ai_usage, ai_limits and ai_company_limits have RLS, no customer policies and explicit service-role grants. Customers cannot read/write config, budgets or usage or invoke the privileged accounting RPCs. The service RPCs are SECURITY INVOKER, including private-schema implementations, with PUBLIC/anon/authenticated execution revoked.

ai_usage did not previously exist. ai_company_limits separately stores per-company daily/monthly request caps and USD spend caps. Both are required to make the requested limits enforceable. The client approved plan allowances on 22 October. ai_limits stores the shared plan rows; ai_company_limits stores each company’s protected assignment. Existing unconfigured and new companies receive Trial. Missing, disabled or zero effective caps block spending. This is not subscription billing; only server operators can assign paid plans until verified Stripe subscription handling is implemented.

All periods use the server's UTC calendar and the request start timestamp. A company quota row is locked while a request checks ai_usage and inserts its reservation. Pending reservations count towards both limits, so simultaneous requests cannot each claim the same allowance. One logical request reserves the maximum possible primary AND fallback spend, even though most requests use only the primary. This is deliberately conservative.

One ai_usage row is created per accepted logical request. It records company, user, task, final/last-attempt model, aggregate token counts, cost and the price/route snapshot. An attempts array records each model's individual tokens, outcome and cost, so fallback usage is not silently discarded or priced at the wrong model's rate. Denied calls make no provider request and create no usage row. All accepted calls, including provider failures, are settled in the same reserved row. The finish write is idempotent and may be retried once without calling the provider again.

A timeout or lost response can leave actual provider usage unknown. Such attempts keep a conservative maximum cost, set cost_is_estimate=true and leave unknown aggregate token counts NULL; no fabricated zero-token usage is recorded. A worker crash or unavailable database leaves the reservation pending and retains its full allowance. There is no automatic expiry/refund that could allow late bills to bypass a cap. Operators must reconcile these records with provider billing before reducing their reserved/estimated charge.

No source text, prompts, generated drafts, API keys or raw provider errors are written to ai_usage. Input has a SHA256 fingerprint only for retry matching. Customer deletion does not acquire a new profile-deletion blocker: usage user references can become NULL and company deletion cascades its gateway data.

## Anthropic adapter and fallback

Each attempt shares one 30-second deadline for token preflight, request and response parsing. The gateway aborts the attempt and tries the enabled fallback at most once, without SDK retries. Empty, refused or truncated responses retain any reported billable usage before fallback. HTTP 4xx failures are unbilled; uncertain network/server/response failures retain a cost estimate. Missing credentials, unsupported providers or incompatible sampling fail safely. A third attempt is never made. No attempt is made when the company cap or route denies it.

adapters/index.ts is the extension point. Another provider must implement the same AdapterInput/AdapterOutput contract, report usage, respect AbortSignal, call onDispatch immediately before a potentially billable request, and map failures to ProviderError with known or unknown usage. Its keys must be read through the server secret callback, never from a request or browser environment.

## Activation

1. Save ANTHROPIC_API_KEY in Vimbre's Supabase Edge Function Secrets. Do not commit it or prefix it with VITE_. The function uses built-in server Supabase credentials separately.
2. The approved Trial allowance is now provisioned. Edit shared plan caps in public.ai_limits through Supabase Table Editor/SQL Editor. Change a company’s ai_company_limits.plan only through an authorized operator or future verified billing webhook. Keep enabled=true. For Enterprise, set all four company caps to the contract values before enabling it. A NULL plan preserves legacy custom caps. Costs are USD. Never accept a browser-supplied plan as proof of payment.
3. Run one signed-in tidy_text smoke test with non-sensitive text and a fresh Idempotency-Key, after approving the budget. Inspect the private ai_usage row. No paid smoke call was made during implementation.
4. UI feature wiring is implemented. Keep manual paths working and require review before saving drafts. A real authenticated provider smoke test is still required after allowances are approved.

The migration and ai-run deployment are independent of Vercel. supabase/config.toml configures ai-run with JWT verification plus the handler's own verified-profile check; the existing team-invitations configuration is preserved. Supabase keys and ANTHROPIC_API_KEY are read only by the Edge runtime.

## Verification and test list

- npm run check: lint, unit tests, gateway TypeScript, application TypeScript and production/prerender build.
- npm run test -- scripts/ai-gateway.test.ts: authentication, forged fields, task validation, UTF8 limits, origins, idempotency, limits/no call, primary success, timeout/abort, fallback once, safe errors/manual continuation, billed partial failures, logging retries, provider request shape, token preflight, secret isolation and actual entrypoint profile selection.
- Concatenate supabase/tests/team-fixtures.sql and supabase/tests/ai-gateway.sql. Execute in a controlled database session. Every fixture and test budget rolls back. Tests cover customer/anonymous denial, four model routes, unconfigured caps, company scope, pending reservations, both daily/monthly count/spend limits, disabled routes/models, duplicate references, snapshotted prices, two-attempt cost accounting, unknown bills and settlement idempotency. No provider call or email is sent.
- Supabase advisors: the four RLS-with-no-policy INFO notices are intentional. Never add customer policies to silence them. The pre-existing leaked-password warning is unrelated to this change.
- Deployment smoke checks: signed-out POST returns 401; main-domain OPTIONS returns the allowed CORS header. These do not invoke Anthropic.
- Activation acceptance: with approved test caps, send two simultaneous calls with distinct references when only one reservation fits. Only one may reach the provider. Repeat the same reference: no second call or row. Test both cap periods in staging, missing/invalid key, both models unavailable and manual continuation. These paid, authenticated acceptance checks remain pending activation.

## Files

- supabase/migrations/20261021024056_ai_gateway.sql
- supabase/functions/ai-run/index.ts
- supabase/functions/ai-run/gateway.ts
- supabase/functions/ai-run/tasks.ts
- supabase/functions/ai-run/types.ts
- supabase/functions/ai-run/adapters/index.ts
- supabase/functions/ai-run/adapters/anthropic.ts
- supabase/functions/ai-run/deno.json
- supabase/config.toml
- supabase/tests/ai-gateway.sql
- src/lib/ai-gateway.ts
- scripts/ai-gateway.test.ts
- scripts/ai-deno.d.ts
- scripts/tsconfig.ai.json
- package.json
- docs/ai-gateway.md
- PROJECT_NOTES.md


## Approved plan limits, 22 October 2026

| Plan | Requests/day | Requests/month | USD/day | USD/month |
| --- | --- | --- | --- | --- |
| Trial | 15 | 100 | 0.25 | 1 |
| Starter | 40 | 500 | 0.75 | 2 |
| Growth | 200 | 3000 | 4 | 12 |
| Business | 1000 | 15000 | 20 | 60 |
| Enterprise | Per contract | Per contract | Per contract | Per contract |

All four caps apply; the first reached wins. The gateway locks the company row and reads the plan row under a shared lock for every reservation, so a Console edit affects the next request with no code release. Existing explicitly configured or disabled rows are preserved. Trial provision does not invent a subscription, trial duration or expiry; these were not supplied. Operators can disable a company explicitly. Enterprise defaults are zero at company level and fail closed until contract caps are entered.

Days and months reset by UTC calendar boundaries; no reset job or usage deletion is needed. A next request is denied before its conservative primary plus fallback reservation could exceed a spending cap. This can stop AI before a displayed actual spend reaches 100 percent. Pending reservations count; completed costs settle to measured usage, and uncertain bills retain the existing conservative estimate. All other features and manual forms continue working.

Company HR Admins, including the founder displayed as Super admin, see an in-app banner at 80 percent of any request or cost cap. It refreshes on login, focus, returning to the tab, each AI result and every minute while visible. At 100 percent the banner says AI is paused and shows the UTC reset time. Employees and managers receive no admin usage summary. A narrowly scoped authenticated RPC derives the company from auth.uid(), returns aggregates only, and rejects anonymous access. Configuration and raw usage remain service-only. AI limit responses have a plain daily or monthly reset message and a Contact support email action, with manual continuation. No email warning dispatch is added.

Usage logging remains numbers/identifiers and route accounting only. No source text, generated draft or secret is saved in the ledger. The existing fingerprint is a one-way retry hash, not prompt text. No paid provider call was made by these tests.

Files: migration 20261022053534_ai_plan_allowances.sql; supabase/tests/ai-plan-allowances.sql and updated ai-gateway.sql; gateway.ts/types.ts; src/lib/ai-gateway.ts and database.ts; AIAllowanceNotice.tsx, AIDraftPanel.tsx, CaptureAI.tsx, ai.css; AppLayout.tsx; gateway unit and AI browser checks.

Verification: rollback SQL covers exact plan values, automatic Trial provision, live Console edits, independent request/spend daily/monthly caps, pending reservation accounting, UTC boundaries with a non-UTC session, custom Enterprise, disabled companies, cross-company/admin/employee/manager/anonymous boundaries and customer upgrade denial. Existing gateway rollback tests still cover reservation idempotency, fallback billing and snapshot rates. Browser tests cover 80/100 percent notices, contact links, untouched manual drafts, employee hiding and phone/tablet fit.
