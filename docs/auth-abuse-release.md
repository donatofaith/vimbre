# Auth abuse protection release checks

The web application can send a Turnstile token on password sign-in, signup, confirmation resend and password reset requests. With no public site key, it continues using the existing Supabase Auth flows. Supabase is responsible for enforcing the challenge.

## Before enabling enforcement

1. Confirm which applications and automations use the same Supabase project. Vimbre Console is a separate client and needs compatible sign-in, staff invitation and recovery flows before the shared CAPTCHA setting is enabled.
2. Create a Turnstile widget with the intended hostnames. Set the public site key as `VITE_TURNSTILE_SITE_KEY` in Vercel. Keep the secret in Supabase Auth Bot and Abuse Protection settings. Use Cloudflare test keys only in an isolated test project.
3. Verify the production Auth rate-limit settings without changing them. In an isolated project with a test account, confirm that repeated incorrect passwords eventually return HTTP 429 and ordinary sign-in and token refresh still work. Confirm the production project settings match the tested limits before changing them. Never test repeated attempts on customer accounts.
4. In the isolated project, compare the direct signup API response for a fresh email and an existing one. The web app displays a neutral response for known duplicate errors. Direct API account disclosure depends on Supabase Auth configuration.
5. Verify sign-in, signup, resend and password recovery in every affected client. Send controlled requests directly to Supabase with missing, invalid and reused challenge tokens to confirm that the backend rejects them. Verify valid confirmation and reset links still work. Check both mobile and desktop.
6. Deploy the compatible clients before enabling the Supabase CAPTCHA setting. Verify both clients immediately after activation. If either client cannot complete an Auth flow, disable enforcement in Supabase before reverting a client build.
7. Check leaked-password screening separately. The Vimbre organization was on the Supabase Free plan at review time. Screening requires an eligible paid plan.

References

- https://supabase.com/docs/guides/auth/auth-captcha
- https://supabase.com/docs/guides/auth/rate-limits
- https://supabase.com/docs/guides/auth/password-security
- https://developers.cloudflare.com/turnstile/troubleshooting/testing/
