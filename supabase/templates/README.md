# Vimbre account emails

Status: **prepared, not yet applied to hosted Supabase Auth**. GitHub/Vercel deployment does not update hosted Auth templates. The connected Supabase tools cannot read or edit this setting, and no CLI Management API credential is available. Applying them requires approved dashboard access or an authenticated Management API session.

Use `manifest.json` for each subject, HTML path and the exact Management API keys. Apply only those subject/content keys. Preserve existing SMTP credentials, sender, redirect allowlist, token expiry, security notification enablement and Auth settings. Do not replace the whole Auth configuration from local defaults.

## Design

All 13 templates use Vimbre navy #102a43 and blue #2f80ed, a white content panel, an email-compatible table layout, inline styling and a width that fits mobile. Buttons and fallback links retain Supabase’s exact ConfirmationURL. No external images, tracking or JavaScript are required. Code-based verification uses Token instead of a link. Subjects and content identify the requested action. Notification templates do not enable notifications by themselves.

Invitation wording: “Hi [name], [inviter] has invited you to join [company] on Vimbre with the role of [role]. Confirm your email address, set your password and accept the invitation to join your team.” The action is “Confirm and join team”. Invitation context is included in both confirmation and magic-link templates because Supabase may use either when sending the invitation OTP. Their subjects use the same purpose condition. Ordinary confirmation, sign-in, reset and security mail retain their own purpose.

The server reads company, inviter and role from protected database rows. It never trusts display details supplied in the request, and metadata never grants membership. Pending existing recipients get refreshed metadata before resend. When an invitation becomes accepted/cancelled/expired, the database clears only the email personalization fields. Editable names are escaped with the Go template html function. Existing link expiry and seven-day invitation eligibility are distinct; templates do not invent a token expiry duration.

## Verification and remaining activation

Unit tests check invitation context, authorization, metadata refresh, failed delivery, link variables, branding and separate reset purpose. Browser tests assert actual red computed colors for duplicate invitations and server-reported duplicate signups. Rollback-only SQL verifies metadata cleanup without changing membership or unrelated fields. No real invitation or test email has been sent by this change.

After applying hosted subjects/content, use the dashboard template preview to validate both invitation and ordinary-account branches and check one owner-authorized inbox per active flow. Rendering in real mail clients remains unverified. The current sender/domain/Brevo configuration is unchanged. A separate automatic welcome email is not implemented by these Auth templates; it requires a post-verification/acceptance delivery flow.
