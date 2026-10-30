# Vimbre analytics chat and legal review

Prepared on 30 October 2026 against development commit `2fa0c00ebd937a64a7566aa7675868f3c808802a`. The owner approved publication on 30 October 2026 after the local review. Application publication is authorized; GTM/GA4 dashboard configuration and Realtime acceptance remain separate. This release requires no database migration.

## What changed

Collapsed desktop navigation now gives Chat the complete workspace width and the remaining viewport height below the top bar. The conversation list and messages scroll within that area; the composer remains at the bottom. The existing expanded-sidebar and mobile layouts are retained.

The supplied Privacy Policy and Terms and Conditions are transcribed without changing their wording, including their version, effective date of 1 November 2026 and the full data-processing schedule. Both pages have section navigation, readable lists, footer links, canonical addresses and prerendered HTML. Account creation and invitation acceptance link to these documents. The previous Stars and competition terms remain available separately at `/competition-terms` and in Settings. The documents' retention periods, supplier contractual statements and service commitments are client-supplied statements; this implementation does not establish or change those operational arrangements.

## Tracking design

The head loads `/vimbre-analytics.js`, which initializes the data layer and consent defaults. It loads one asynchronous container, `GTM-KTXM87CG`, only after analytics consent is accepted. The GA4 measurement ID is `G-E599PM5PBE` and must be configured inside that container as described below. Adding the supplied direct `gtag.js` snippet alongside a GTM Google tag would create a second installation, so there is no parallel direct GA4 loader. There is no consent-bypassing noscript tracking iframe.

Analytics is off until accepted, matching section 11 of the supplied Privacy Policy. Cookie settings are available in public/account footers and workspace Settings. Withdrawal stops new app events, disables the named GA4 property in the page and clears GA cookies without removing Supabase authentication storage. Advertising consent stays denied. Events that happen before consent are discarded, rather than replayed later.

The reusable TypeScript helper rebuilds payloads from fixed category allowlists. It sends no names, emails, user/company/record/request IDs, text, document contents, source URLs or OAuth parameters. Opaque operation keys stay in session storage for deduplication and are never included in event payloads. Sanitized SPA pageviews exclude query strings, fragments, dynamic record IDs, raw referrers and private document titles. Unknown paths are grouped as `/other`.

## Event catalogue and acceptance tests

All product events below include `success: true`. Test with analytics accepted and an approved test account. A failed request, validation error or button click without a successful result must not produce the event.

| Event | Successful boundary and parameters | Test in GTM Preview and GA4 Realtime |
| --- | --- | --- |
| `sign_up` | New Supabase signup succeeds and returns a real user with identities. `method: password`. Supabase's obfuscated existing-email responses are excluded. | Create a genuinely new test account. Expect one event after account creation, before email verification. Retry an existing email and confirm no extra signup event. |
| `login` | Explicit password sign-in returns a session. `method: password`. Token refresh/session restoration do not emit it. | Sign out, log in successfully, and expect one event. A wrong password must produce none; refreshing the workspace must not produce another login event. |
| `onboarding_completed` | Not emitted: the current application has no explicit onboarding completion action or stored completion state. The optional Get started checklist is not treated as account onboarding. | No completion event is expected. A product definition and successful completion boundary are needed before enabling this event. |
| `integration_connected` | Verified OAuth completion succeeds. `source_type` is one of gmail, drive, outlook, teams, slack or trello. Includes configured reconnect/calendar/write-permission flows. | Complete a configured connection in an authorized HTTPS environment and return to Capture. Expect one event. Clicking Connect, declining access or a failed callback must produce none. |
| `context_generated` | Explicit AI generation returns usable output; structured outputs are parsed before reporting. `context_type` identifies the fixed AI task and `source_type` its category. | Generate a task outcome, role summary, Capture draft, day plan or handover draft. Expect one event for the successful generation. An unavailable AI service or malformed structured output must produce none. Reopening cached results produces none. |
| `action_created` | Confirmed task creation from manual/AI task forms, approved Capture drafts, template use or accepted assignments. Imports report one event with the confirmed `action_count`; zero-new-item imports emit none. `action_type: task`, `source_type`, `action_count`. | Save a manual task, then an AI draft. Confirm a Capture task. Expect one event for each successful creation. Confirming a decision or merely generating an AI draft must not count as a task. An import with three new rows sends one event with `action_count: 3`. |
| `action_completed` | Successful normal, scheduled-plan, batch or authorized cover completion. Task-editor status changes are included. `action_type: task`, `source_type`. | Complete one ordinary task and one planned task. Confirm each event after the server response. Opening a task, pressing Start, or a failed save produces none. |
| `handover_created` | First successful saved draft, identified by version 1. `source_type: manual`, `context_type: leave`, `exit` or `sudden`. | Start a handover and advance/save the first valid step. Expect one event. Autosaves, edits, AI drafting and submission of that same handover must not send another creation event. |
| `page_view` | One sanitized event per route change after consent. `page_path`, `page_location`, `page_title`, `page_referrer`. | Navigate between public/workspace pages. Expect one pageview for each actual route change. Conversation query changes alone do not generate extra views, and no tokens or record IDs should appear. |

Offline task changes send events only after successful synchronization. Conflicts and failed syncs do not count as successful saves. Duplicate success callbacks and retries are suppressed by operation/record keys, including across reloads in the same browser tab. This is browser telemetry, not a transactional ledger: blockers, closing the page or using another device can affect delivery. A task's repeated completion is counted at most once in that tab's session.

Server-only scheduled/background AI processing is not reported as a fresh interactive generation. The role-task get-or-create RPC can reuse an existing task without returning whether it inserted one, so that path is not labelled as a new creation. Instrumenting it accurately needs an insertion receipt from that API. Existing APIs, permissions and database functions were left unchanged.

## Configure GTM without duplicates

1. Open container `GTM-KTXM87CG` in Google Tag Manager. Review existing Google/GA4 tags first. Keep exactly one Google tag for `G-E599PM5PBE`; edit an existing matching tag instead of adding a second one. Keep changes in the GTM workspace for review.
2. Create or edit the native **Google tag**. Set Tag ID to `G-E599PM5PBE`, with **Initialization – All Pages** as its trigger. Set configuration parameters `send_page_view` to false, `allow_google_signals` to false and `allow_ad_personalization_signals` to false. Use safe defaults `page_location: https://vimbre.com/`, `page_title: Vimbre`, and an empty `page_referrer`.
3. In the GA4 web stream, disable Enhanced Measurement's automatic page views/history changes, site search, form interactions, outbound clicks, file downloads and video collection for this implementation. The app supplies sanitized pageviews; automatic collection can otherwise duplicate them or capture private URLs/form metadata. Do not enable user-provided data collection or configure a User ID from workspace identifiers.
4. Create Data Layer Variables (version 2) for `method`, `source_type`, `context_type`, `action_type`, `action_count`, `success`, `page_path`, `page_location`, `page_title` and `page_referrer`. Give page location/title safe fallback values and page referrer an empty fallback.
5. Create a **Custom Event** trigger for each emitted event name in the table. Do not create a click trigger, history trigger or `onboarding_completed` tag.
6. Create a native **Google Analytics: GA4 Event** tag per event, using measurement ID `G-E599PM5PBE`, the exact event name and its matching Custom Event trigger. Send only the parameters listed for that event. For product events also set `page_location`, `page_title` and `page_referrer` from their sanitized Data Layer Variables. Keep parameters specific to their tags: data-layer values persist, so attaching every parameter to every event can reuse a stale value from a previous event.
7. Require `analytics_storage` consent for these analytics tags. Do not add advertising or other automatic content-collection tags. The app blocks the container before analytics acceptance and queues its consent update before container initialization. Do not add a second copy of the installation scripts in GTM or another site plugin.
8. In GA4 Admin, register `source_type`, `context_type` and `action_type` as event-scoped custom dimensions if they are needed in reports; register `action_count` as an event-scoped custom metric. Use the sum of `action_count` for created-task totals, rather than counting import events as single tasks.

## Preview and Realtime testing

1. Run the reviewed code locally with `npm run dev`. In GTM, choose **Preview**, enter the local website address shown by Vite and connect Tag Assistant. Real provider callbacks require an authorized HTTPS review/staging environment; use it only after that deployment is approved.
2. Open Cookie settings and reject analytics. Confirm no `googletagmanager.com/gtm.js` or GA4 collection request loads and no product analytics events are pushed. Reload to confirm the choice persists.
3. Accept analytics. Confirm one GTM container loads, then carry out the acceptance tests in the event table. In Tag Assistant, select each event and inspect its Data Layer/Variables tabs. Its matching GA4 event tag should fire once. Check consent is granted for analytics and denied for advertising.
4. In GA4, open **Reports → Realtime** and look at event names/event counts. Use **Admin → DebugView** while Tag Assistant is connected to inspect test events and their parameters. Realtime can take a short time to update; browser blockers, consent and data filters can suppress delivery.
5. Check failed operations and repeated callbacks as well as successes. Inspect the actual GA4 `collect` requests in the browser Network panel: neither `dl`/`dt` nor event parameters should contain emails, names, tokens, query strings, document titles or workspace text. Confirm there is only one pageview for a route change.
6. Withdraw analytics through Cookie settings and repeat a product action. No new app analytics event should appear. Reload: no Google script should load while consent remains rejected.

The local checks verify event queues and product boundaries without sending analytics hits, creating production test accounts, invoking paid AI, or changing GTM/GA4. Real receipt in GA4 remains a manual Preview/Realtime acceptance step after the GTM workspace is configured. Publish the GTM version and deploy the application only after owner review.

## Verification

258 unit tests across 52 files passed. TypeScript, Vite production build, prerender and offline asset generation passed. New checks cover consent/loading/withdrawal, payload filtering, safe paths, signup anti-enumeration, integration state verification, duplicate retries, API failures, offline acknowledgements/conflicts, Capture selections, import counts and first-save handovers.

Browser checks used the actual AppLayout and ChatPage with local mock responses: collapsed 1440×900 and 1920×900 chat exactly filled the viewport below the top bar, and the composer bottom matched the viewport bottom. The new-chat dialog was 480 pixels wide and about 478 pixels tall at desktop size. At 320 pixels, chat and both legal pages had no horizontal overflow. The privacy page showed 15 sections and Terms showed 20 including Schedule 1. Rejecting analytics loaded zero Google scripts; reopening Cookie settings showed analytics off. Temporary fixtures and host configuration were removed before final build.

Official references: [Google data-layer installation](https://developers.google.com/tag-platform/devguides/datalayer), [Google consent mode](https://developers.google.com/tag-platform/security/guides/consent), [Manual pageviews and duplicate prevention](https://developers.google.com/analytics/devguides/collection/ga4/views), [Tag setup troubleshooting](https://support.google.com/analytics/answer/9311124).

## Changed files

- `docs/analytics-chat-legal-review-20261030.md`
- `index.html`
- `public/vimbre-analytics.js`
- `scripts/analytics-loader.test.ts`
- `scripts/prerender.mjs`
- `src/app/App.tsx`
- `src/app/layouts/workspace.css`
- `src/features/ai/AIDraftPanel.tsx`
- `src/features/ai/CaptureAI.tsx`
- `src/features/ai/StructuredAI.tsx`
- `src/features/analytics/AnalyticsConsent.tsx`
- `src/features/analytics/analytics.css`
- `src/features/auth/AuthPage.tsx`
- `src/features/auth/JoinPage.tsx`
- `src/features/capture/CapturePage.tsx`
- `src/features/capture/capture-api.ts`
- `src/features/handovers/CoverDutiesPage.tsx`
- `src/features/handovers/HandoverEditor.tsx`
- `src/features/handovers/HandoversPage.tsx`
- `src/features/handovers/model.ts`
- `src/features/my-day/MyDayPage.tsx`
- `src/features/my-day/SourceUpdate.tsx`
- `src/features/my-day/TaskAI.tsx`
- `src/features/my-day/TaskPanel.tsx`
- `src/features/my-day/api.ts`
- `src/features/my-day/offline.ts`
- `src/features/my-day/plan-api.ts`
- `src/features/my-day/suite-api.ts`
- `src/features/public/BlogPage.tsx`
- `src/features/public/LandingPage.tsx`
- `src/features/public/LegalPage.tsx`
- `src/features/public/legal-content.test.tsx`
- `src/features/public/legal-content.ts`
- `src/features/public/legal.css`
- `src/features/public/prerender.tsx`
- `src/features/records/RoleFinalPage.tsx`
- `src/features/team/CompanySettings.tsx`
- `src/features/workspace/ActionForm.tsx`
- `src/lib/analytics-operations.test.ts`
- `src/lib/analytics.test.ts`
- `src/lib/analytics.ts`
