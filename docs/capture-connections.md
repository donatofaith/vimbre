# Capture tool connections — 24 October 2026

Owner request supersedes the earlier no-direct-connections scope. Capture supports manual paste and a private connection picker for Gmail, Google Drive, Outlook, Microsoft Teams, Slack and Trello. Imports run only on an explicit Import and draft confirmation. Existing Capture AI, duplicate reuse, allowance checks, draft acceptance and confirmation remain the pipeline. Confirmed action drafts become My day tasks through the existing server operation; My day itself is unchanged. No continuous background scanning, implicit AI or automatic task confirmation is introduced.

## What the adapters read

- Gmail: 20 recent messages, then the selected message body.
- Google Drive: 30 recently modified Google Docs/plain text files, then the selected file.
- Outlook: 30 recent messages, then the selected message body.
- Teams: 30 chats, then recent messages in the selected chat. These are delegated work/school chats, not organisation-wide channel ingestion.
- Slack: 30 conversations, then recent messages; importing a thread includes up to 30 replies.
- Trello: open boards, cards in the selected board and up to 30 comments on the chosen card.

Longer sources are rejected rather than silently truncated. Users can paste the relevant excerpt. Other work tools remain available through manual paste; they are not advertised as direct integrations. Providers can require workspace-admin consent. The current picker shows recent results, not complete searchable historical archives.

## Provider registration required before live account consent

New consent callbacks for all six providers use `https://vimbre.com/api/capture/callback`. The original Supabase callback remains supported for earlier pending grants. Trello OAuth1 sends a per-attempt state query parameter on the callback. The callback returns only to the trusted Vimbre origin where the flow began. A short-lived authorization code travels in a URL fragment, is removed immediately, and is exchanged only after authenticated account and browser-nonce verification. Access/refresh tokens never reach the browser. The server never persists the callback code for another browser to retrieve. Real OAuth acceptance uses the production Vimbre domains; localhost is for intercepted tests.

Set these **server-only Edge Function secrets** in the Vimbre Supabase project, never in VITE variables or Git:

| Registration | Required secret names | Read permissions |
| --- | --- | --- |
| Google Cloud OAuth web app | CAPTURE_GOOGLE_CLIENT_ID, CAPTURE_GOOGLE_CLIENT_SECRET | gmail.readonly and drive.readonly, requested separately |
| Microsoft Entra web app | CAPTURE_MICROSOFT_CLIENT_ID, CAPTURE_MICROSOFT_CLIENT_SECRET | offline_access plus Mail.Read or Chat.Read, requested separately |
| Slack OAuth app | CAPTURE_SLACK_CLIENT_ID, CAPTURE_SLACK_CLIENT_SECRET | user scopes channels:read, groups:read, im:read, mpim:read and their :history scopes |
| Trello Power-Up OAuth app | CAPTURE_TRELLO_CLIENT_ID (API key), CAPTURE_TRELLO_CLIENT_SECRET | OAuth1 read grant |

Enable the respective APIs, complete each provider's consent-screen/privacy requirements and any required public-app verification/admin approval. Google mail/Drive restricted scopes can require additional review before public distribution. Do not use a personal ChatGPT connector as the SaaS customer credential store. No existing provider app or secret is assumed.

The unauthenticated `/capabilities` endpoint returns configured booleans only. Authenticated status returns only the requesting person's connection metadata. A missing registration is labelled Setup required and cannot initiate OAuth; paste remains usable. Real connection/refresh/revocation acceptance must be tested with explicitly authorised provider accounts after registrations and secrets exist. Mock tests are not proof of provider approval or real consent success.

## Security and lifecycle

New private RLS tables, with all client table grants revoked. Tokens and short-lived OAuth grant material are encrypted in Supabase Vault. The service-only RPC checks service identity and active membership; credentials are company/user-bound. OAuth state is hashed, expires after ten minutes and is consumed once. Completion is bound to both the initiating browser nonce and the authenticated Vimbre account, so forwarding a consent link cannot attach a different person’s account. Google/Microsoft use PKCE; Slack uses confidential OAuth plus state; Trello uses signed OAuth1. Token refresh uses a connection lease to avoid concurrent refresh-token rotation. Owner removal/disconnect deletes stored Vault secrets, including account-delete cascades. Per-user request limits apply.

`capture-connect` has its own live `getUser` verification on authenticated POST actions. Gateway JWT verification is disabled solely to allow signed-state provider callbacks; no authenticated action relies on that setting. Callback failures return no codes, tokens or provider body. HTTP errors contain safe codes. Provider API hosts/paths are fixed; source identifiers are encoded, redirects refused and response bodies bounded. The Console cannot access these private tables or Vault payloads.

Google revocation can affect another Google connection for the same app; confirmation warns about this. Microsoft disconnect discards Vimbre's saved tokens; removing Microsoft app consent additionally happens in the user's Microsoft account permissions. Existing captures remain private under Capture's current rules after disconnection.

## Support placement

Headset icon in sidebar and Help and support heading. Removed top-right Help and its duplicate contact dialog. Support page now contains support@vimbre.com for account/workspace support and hello@vimbre.com for general enquiries. Mailto links open the user's mail client; no message is sent by this change.

## Validation

Provider requests are intercepted in unit/browser checks. Hosted rollback fixtures cover service-only grants, active membership, cross-user/company denial, metadata/token separation, encrypted storage, single-use state, refresh lease and Vault cleanup. Capture's existing policy, AI and My day regression tests remain required. No real email, external account connection or paid AI request is created by tests.

Primary references: https://developers.google.com/identity/protocols/oauth2/web-server ; https://learn.microsoft.com/en-us/graph/api/chat-list-messages?view=graph-rest-1.0 ; https://docs.slack.dev/authentication/installing-with-oauth/ ; https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/ ; https://supabase.com/docs/guides/database/vault

## Branded Google callback — 25 October 2026

Google Gmail/Drive now start new consent requests with `https://vimbre.com/api/capture/callback`. Add this exact URI to the Google OAuth web client before reconnecting. Retain the old Supabase URI while earlier ten minute consent attempts finish. No Cloudflare DNS record, Supabase custom-domain add-on or new server credential is needed. Microsoft Outlook/Teams also use this branded callback as recorded below. Slack also uses the branded callback as recorded below. Trello also uses the branded callback as recorded below.

The Vercel Node function forwards only bounded OAuth parameters to the fixed Supabase callback server-side, refuses automatic redirects, and accepts only the existing trusted Capture fragment destinations. It never exchanges provider tokens, stores secrets or logs query parameters. Invalid state, duplicate parameters, unexpected redirects and upstream failures return a generic failure without codes. The original browser nonce and authenticated, single-use user/company grant checks remain required. Each new grant stores its exact redirect URI encrypted alongside PKCE material, so exchange uses the URI that began consent and existing old grants still work.

This changes the callback domain, not Google's verification status. Google brand/scope verification and any required security assessment remain external requirements. Cloudflare DNS, payment settings and My day are unchanged.

## Branded Microsoft callback — 26 October 2026

Outlook and Teams now start new consent requests with `https://vimbre.com/api/capture/callback`. Register this exact URI under Microsoft Entra > Vimbre Capture > Authentication > Web before connecting. Client ID and secret stay in Supabase. Existing pending grants retain their original URI, and the browser nonce, PKCE, authenticated owner/company and single-use checks are unchanged. No additional permissions or access grants are introduced.

Deployed capture-connect version 12. Callback/provider tests (20) and Edge TypeScript checks pass. The Microsoft publisher association is publicly hosted as JSON for application 6786dd5e-575f-4158-866b-8a22f039e4a3. Publisher domain ownership is separate from verified publisher status. Real Microsoft consent and selected-source import remain to be tested by the operator after registering the URI.

## Branded Slack callback — 26 October 2026

Slack new consent uses `https://vimbre.com/api/capture/callback`. Add this exact Redirect URL under OAuth & Permissions and save it before connecting from Vimbre. Client ID and Client Secret stay in Supabase; the integration uses the consenting user's token, not a manually copied bot token. Keep the eight read/history user scopes documented above. Existing pending grants retain their original URI and single-use state/browser/account binding remain unchanged. capture-connect version 14 is deployed; 21 provider/relay tests and Edge type checks pass. Real workspace consent and selected conversation import still require operator testing. Cross-workspace availability requires Slack distribution setup and workspace-admin policy approval where applicable.

## Branded Trello callback — 26 October 2026

Trello new OAuth1 consent signs `https://vimbre.com/api/capture/callback?state=<per-attempt state>` as the callback. Add `https://vimbre.com` to the API key's Allowed origins. Use the Trello Auth API key and application secret in the existing server-only CAPTURE_TRELLO_CLIENT_ID and CAPTURE_TRELLO_CLIENT_SECRET settings; OAuth 2.0 client credentials are not interchangeable with these. The per-attempt request token/verifier check, signed provider requests, authenticated owner/company binding and single-use browser state are retained. Existing pending grants still accept their original callback.

capture-connect version 16 deployed. All 22 provider/relay tests and Edge type checks pass, including signed branded callback/state and rejection of a mismatched request token. Real Trello consent and selected-board/card import must still be tested by the operator; credential presence is not proof of successful consent or public provider approval.
