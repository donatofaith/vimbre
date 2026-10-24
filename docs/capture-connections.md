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

Callback for all apps: `https://ijyjrooarwoafkykvzjp.supabase.co/functions/v1/capture-connect/callback`. Register it exactly. Trello OAuth1 sends a per-attempt state query parameter on the callback. Successful/declined consent redirects only to `https://vimbre.com/app/capture`; browser URLs never receive provider access/refresh tokens.

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

New private RLS tables, with all client table grants revoked. Tokens and short-lived OAuth grant material are encrypted in Supabase Vault. The service-only RPC checks service identity and active membership; credentials are company/user-bound. OAuth state is hashed, expires after ten minutes and is consumed once. Google/Microsoft use PKCE; Slack uses confidential OAuth plus state; Trello uses signed OAuth1. Token refresh uses a connection lease to avoid concurrent refresh-token rotation. Owner removal/disconnect deletes stored Vault secrets, including account-delete cascades. Per-user request limits apply.

`capture-connect` has its own live `getUser` verification on authenticated POST actions. Gateway JWT verification is disabled solely to allow signed-state provider callbacks; no authenticated action relies on that setting. Callback failures return no codes, tokens or provider body. HTTP errors contain safe codes. Provider API hosts/paths are fixed; source identifiers are encoded, redirects refused and response bodies bounded. The Console cannot access these private tables or Vault payloads.

Google revocation can affect another Google connection for the same app; confirmation warns about this. Microsoft disconnect discards Vimbre's saved tokens; removing Microsoft app consent additionally happens in the user's Microsoft account permissions. Existing captures remain private under Capture's current rules after disconnection.

## Support placement

Headset icon in sidebar and Help and support heading. Removed top-right Help and its duplicate contact dialog. Support page now contains support@vimbre.com for account/workspace support and hello@vimbre.com for general enquiries. Mailto links open the user's mail client; no message is sent by this change.

## Validation

Provider requests are intercepted in unit/browser checks. Hosted rollback fixtures cover service-only grants, active membership, cross-user/company denial, metadata/token separation, encrypted storage, single-use state, refresh lease and Vault cleanup. Capture's existing policy, AI and My day regression tests remain required. No real email, external account connection or paid AI request is created by tests.

Primary references: https://developers.google.com/identity/protocols/oauth2/web-server ; https://learn.microsoft.com/en-us/graph/api/chat-list-messages?view=graph-rest-1.0 ; https://docs.slack.dev/authentication/installing-with-oauth/ ; https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/ ; https://supabase.com/docs/guides/database/vault
