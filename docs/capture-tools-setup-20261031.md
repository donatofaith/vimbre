# Capture tools: setup and rollout

Gmail and Google Drive are removed from new Capture connections, marketing, rules and calendar setup. Existing captures remain. Existing Google connections appear only so their owner can disconnect them. Google Watch rules are paused. Outlook calendar remains available. Teams, Trello, Slack and Outlook keep their existing configuration.

GitHub, Notion and Asana now have server-side OAuth, token refresh, content selection, preview and import into the existing review/confirm pipeline. They need registered provider apps and secrets before connection is available. Yahoo is an approval-dependent request, not a working integration. The landing page separates existing tools from forthcoming ones. No account has been connected during implementation.

## Common setup

1. Register each provider application below under the company account.
2. Set the exact callback URL to `https://vimbre.com/api/capture/callback`.
3. Open [Vimbre Supabase Edge Function secrets](https://supabase.com/dashboard/project/ijyjrooarwoafkykvzjp/functions/secrets). Add that provider's Client ID and Client Secret using the names below. These are server settings: never add secrets to Vite/Vercel public variables, a repository or a chat message.
4. In Vimbre, open Settings → Integrations. Enable the tool for the company if needed, then Connect. Each person authorizes their own account.
5. In Capture choose the connected tool, use Filters to choose a repository or project where relevant, search, preview one item and select it. Draft tasks and decisions only when ready. Review before confirming.

Existing restricted company tool policies remain restricted. Companies with the old complete default receive the replacement default. New tools have no source write-back or Watch controls in this release; import is read-only. No new AI request happens merely by connecting, searching or previewing.

## GitHub

Go to [GitHub developer settings](https://github.com/settings/apps), then New GitHub App (not an OAuth App).

- App name: Vimbre Capture (use an available name); homepage `https://vimbre.com`.
- User authorization callback: the common callback above.
- Keep expiring user access tokens enabled. Leave “Request user authorization during installation” unchecked: Vimbre starts authorization with its bound state and PKCE.
- Webhooks are not used; disable Active.
- Repository permissions: Issues **Read-only**, Pull requests **Read-only**, Metadata **Read-only**. No repository Contents, administration, organization or write permissions are needed.
- For customer use allow installation on any account. Install the app on the intended company account and select the repositories to share. An organization owner may need to approve installation.
- Generate a Client Secret. Save the Client ID (not numeric App ID) as `CAPTURE_GITHUB_CLIENT_ID`, and the secret as `CAPTURE_GITHUB_CLIENT_SECRET` in Supabase.

Capture lists accessible repositories and imports a selected issue or pull request's title, description and issue conversation comments. Inline code review comments, source code and attachments are outside this release. Large conversations are rejected with a paste fallback rather than silently truncated. If no repositories appear, check the app installation and selected repository access.

## Notion

Open the [Notion developer portal](https://www.notion.so/profile/integrations) and create a **public connection** for OAuth, not an internal token connection.

- Website `https://vimbre.com`; use the actual public privacy and terms URLs from Vimbre's footer.
- Configure the common callback above.
- Enable **Read content** only. Disable insert/update content and user email access. No optional template is required.
- Save OAuth Client ID as `CAPTURE_NOTION_CLIENT_ID` and Client Secret as `CAPTURE_NOTION_CLIENT_SECRET` in Supabase.
- Connect from Vimbre and select pages to share on Notion's consent screen. Other users/workspaces each authorize access themselves. Complete any distribution requirements shown by Notion before inviting customers.

Capture searches shared page titles and reads the selected page's text, including bounded nested blocks. Separate child pages, embedded databases, files, media and comments are not expanded. If pages are missing, share them with the connection, reconnect if necessary, and allow Notion search indexing time.

## Asana

Open [Asana developer console](https://app.asana.com/0/my-apps), create an OAuth app, then configure the common callback above.

- Use granular permissions, not Full permissions.
- Allow only `workspaces:read`, `projects:read`, `tasks:read`, `stories:read`.
- Save Client ID as `CAPTURE_ASANA_CLIENT_ID` and Client Secret as `CAPTURE_ASANA_CLIENT_SECRET` in Supabase.
- Add test users while the app is private. Complete the distribution settings required by Asana for other customer accounts; workspace administrators may need to approve the app.
- Connect in Vimbre. In Capture → Filters, choose a workspace, then a project, then Search.

Imports include the selected task's title, notes and task comments. Project tasks are paginated; text/date filtering is applied within each page. Private tasks outside selected projects and attachments are outside this release. If no results match, use Load more or adjust dates and keywords.

## Yahoo Mail — external approval required

Yahoo no longer provides its proprietary mail REST API to new implementations. Mail access uses OAuth with standard IMAP and restricted mail scopes. Registering a normal Sign in with Yahoo app alone does not grant mailbox access.

Apply through [Yahoo Developer Access](https://senders.yahooinc.com/developer/developer-access/) for read-only mail access (`mail-r`). Prepare company details, privacy/security information and the intended mail use case. Yahoo determines approval and requirements. Do not use a shared Yahoo password or app password in Vimbre.

Yahoo is listed as **Awaiting Yahoo approval** with connection disabled. Its mailbox transport is not implemented in this release: once approval and supported credentials are available, add and test the OAuth/IMAP adapter before enabling it. Until then users can paste selected Yahoo email text into Capture.

## Acceptance after configuring each provider

- Connect with an explicitly authorized test account; confirm the provider displays only intended read permissions.
- Cancel once and verify a clean failure with no connected account.
- Connect successfully; verify private content is visible only to that Vimbre user.
- Search and preview one harmless item; check title, date, context and pagination. Previewing must not consume the AI allowance.
- Confirm that drafting requires an explicit action and creates private review items; confirmation is a separate action.
- Verify reconnect after access expires/revocation. Disconnect and confirm browsing stops while saved captures remain.
- Repeat on desktop and phone. Do not treat mocked tests or credential presence as proof of live provider consent.

## Technical changes and verification

Backend: `capture-connect/providers.ts`, new `work-tools.ts`, `search.ts`, `index.ts`, `automation.ts`; database migration `20261031221009_replace_capture_google_with_work_tools.sql`. Existing branded Vercel callback is provider-independent and unchanged. OAuth state, account/company binding, encrypted storage and refresh leases remain intact.

Frontend: Capture connection settings, source picker, place selector, vector marks, connection redirect allowlist; public landing/tools/FAQ/walkthrough; My Day Google calendar/source-write/rule choices; analytics allowlist adds the three providers without content or identifiers.

Live deployment: capture-connect version 28 and capture-worker version 9 are active; the public capability endpoint confirms the four existing tools are configured and the three new tools await secrets. Phone layout checked at 320px and 390px with no horizontal overflow.

Validation: 299 unit tests passed, frontend/Edge/billing TypeScript passed, lint completed with existing warnings, production build passed. Mocked provider tests verify confidential OAuth, PKCE where supported, read scopes, refresh rotation, selection-before-read, provider URL restrictions and oversized-content refusal. Rollback-only SQL acceptance checks encryption/metadata separation, cross-user denial, state binding/reuse, retired providers and service-only access. Live OAuth and content import acceptance still require the registrations above.
