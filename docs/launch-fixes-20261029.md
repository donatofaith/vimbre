# Launch fixes — 29 October 2026

## Changes

- New invitation emails request `https://vimbre.com/auth/callback` instead of the free Vercel hostname. The existing authentication, invitation and rate-limit checks remain in place. Supabase `team-invitations` version 20 is active with this correction. No real invitation was sent during verification; verify the next invitation's destination in an inbox, including the hosted Auth redirect allowlist.
- Add a host-specific 307 redirect from `vimbre.vercel.app` to `vimbre.com`, preserving paths. This redirect requires the next frontend deployment and does not rewrite emails already delivered.
- Fix the hero animation's narrow column at tablet/desktop-mode phone widths. Keep task titles, owners and dates readable on narrow screens.
- Replace task-edit autosave with explicit Save changes and Cancel actions. Preserve unsaved edits after a failed request, support retry, and confirm before discarding edits. Existing optimistic concurrency and offline queue behavior remain.
- Replace the task form's native time popup with validated inline 24-hour fields, avoiding Android dialog overflow.
- Add Chat to sidebar navigation. Typing `@` filters active conversation participants; selecting a name inserts it and sends the participant ID to the existing mention/notification backend. Exact full-name mentions also resolve; ambiguous duplicate names require selection.
- Run independent invitation/profile reads in parallel at workspace entry. Avoid reloading identity solely because the session token refreshed. Share the My day summary between navigation and page instead of requesting it separately.

## Performance evidence and limits

Vercel reported no runtime errors in the inspected 24-hour window. This does not measure the client's browser or direct Supabase request latency. Historical database statistics included several-second outliers for My day RPCs; those aggregate statistics do not identify the cause of one client's slow session. This release removes identifiable duplicate requests and one sequential round trip. It does not establish that all loading delays are resolved. Retest the client's device and inspect its request timings after frontend release before deciding on database changes.

## Verification

- 44 Vitest files, 218 tests passed.
- Production TypeScript/Vite build, prerender and offline asset generation passed.
- Lint completed with no errors; existing project warnings remain.
- Focused browser checks passed for explicit save, failed-save retention/retry, discard, inline time controls and shared summary loading. Form and hero geometry checked at 320, 390, 768, 980 and 1440 pixels (form at 320, 390, 768 and 1440).
- Chat browser suite passed mentions, notifications, groups, direct messages, replies, safe retry, access revocation and 14 responsive widths from 320 to 1920 pixels.
- Browser checks used synthetic data and mocked backend responses. No customer content, real emails or paid AI calls were used.

## Release

Merge to `development`, the production source branch. Frontend deployment is deferred because the Vercel limit has not reset; do not force or repeatedly retry deployment. Once available, deploy the merged branch and smoke-test invitation acceptance, task saving, mobile animation and chat mentions with the client. A merge does not guarantee Vercel automatically retries when its limit resets.
