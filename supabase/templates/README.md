# Vimbre account emails

Status: **all 13 subjects and HTML templates applied to hosted Supabase Auth on 20 October 2026** through the owner-authorized dashboard session. Every HTML template was reloaded and matched the repository source. Purpose-specific subjects were checked; privacy-redacted subject fields were checked visually in the dashboard. GitHub/Vercel deployment alone does not apply hosted Auth settings.

Use `manifest.json` for each subject, HTML path and the exact Management API keys. Apply only those subject/content keys. Preserve existing SMTP credentials, sender, redirect allowlist, token expiry, security notification enablement and Auth settings. Do not replace the whole Auth configuration from local defaults.

## Design

All 13 templates use Vimbre navy #102a43 and blue #2f80ed, a white content panel, an email-compatible table layout, inline styling and a width that fits mobile. Buttons and fallback links retain Supabase’s exact ConfirmationURL. No external images, tracking or JavaScript are required. Code-based verification uses Token instead of a link. Subjects and content identify the requested action. Notification templates do not enable notifications by themselves.

Invitation wording: “Hi [name], [inviter] has invited you to join [company] on Vimbre with the role of [role]. Confirm your email address, set your password and accept the invitation to join your team.” The action is “Confirm and join team”. Invitation context is included in both confirmation and magic-link templates because Supabase may use either when sending the invitation OTP. Their subjects use the same purpose condition. Ordinary confirmation, sign-in, reset and security mail retain their own purpose.

The server reads company, inviter and role from protected database rows. It never trusts display details supplied in the request, and metadata never grants membership. Pending existing recipients get refreshed metadata before resend. When an invitation becomes accepted/cancelled/expired, the database clears only the email personalization fields. Editable names are escaped with the Go template html function. Existing link expiry and seven-day invitation eligibility are distinct; templates do not invent a token expiry duration.

## Verification and remaining setup

Unit tests check invitation context, authorization, metadata refresh, failed delivery, link variables, branding and separate reset purpose. Browser tests assert actual red computed colors for duplicate invitations and server-reported duplicate signups. Rollback-only SQL verifies metadata cleanup without changing membership or unrelated fields. No real invitation or test email has been sent by this change.

The password-change template was visually checked in the hosted Preview panel. Template validation initially hit a temporary ThrottlerException rate limit; remaining templates were retried after other verification and all were saved successfully. Nine email/invitation unit tests pass. No real email was sent; invitation personalization and delivery still need an owner-authorized inbox test. Dashboard previews do not substitute actual recipient metadata for all Go-template conditionals.

Brevo custom SMTP remains enabled at smtp-relay.brevo.com:587 with sender display name Vimbre. Credentials and sender address were preserved. Existing security notification switches were preserved: password changed is enabled; the other six security notifications remain disabled. Their designs are saved for when those notifications are enabled. Auth link expiry, allowed redirects and Site URL were not changed.

Remaining: configure and verify the no-reply sender/domain with Brevo; support@vimbre.com and hello@vimbre.com routing/reply behavior must be checked separately. Cloudflare forwarding alone is not outbound SMTP. A separate automatic welcome email after verification/accepted membership is not implemented by Auth templates and needs a transactional sender credential and a reliable post-verification delivery flow. No Brevo API key or SMTP secret is available in the coding environment; do not expose credentials or imply welcome delivery is active.


## Customer support links

Every Auth/security template includes a Contact support link to mailto:support@vimbre.com. This opens the recipient's email app; it does not change SMTP sender, Reply-To, security notification switches or mail routing. The public /contact page also lists hello@vimbre.com for general enquiries; workspace Help provides the support address and a link to the full contact page. No support form or automatic acknowledgement is implemented.
