# Verification

Run npm ci and npm run check. Lint, six unit tests, TypeScript and the production build must pass. Install Chromium (`npx playwright install chromium`) and run npm run test:browser for browser integration with intercepted Auth/Data API responses. These browser fixtures are never inserted into Supabase.

Run supabase/tests/auth_isolation.sql against a development database with administrator SQL access. It creates temporary fixtures inside a transaction and rolls everything back. Verify no test users/companies remain. The tests cover company isolation, HR Admin/Manager/Employee scope, denied role escalation, company reassignment, audit forgery, inactive members and anonymous access. Run security advisors after schema changes.

For live email acceptance, follow docs/auth-setup.md. SMTP, allowed callback URLs and a team-owned inbox are required; email receipt and delivery remain unverified.

Review at 360 pixels: account forms, validation messages, navigation menu, company settings and no horizontal scrolling. Use Tab to navigate with visible focus. With reduced motion enabled, entrance animations must stop. Check unknown routes and direct /app links while logged out. Unfinished product features must keep honest availability messages.

Recorded local checks: all six unit tests, lint, typecheck and production build passed. Browser integration passed account signup metadata/validation, login, profile/company loading, settings save/reload, logout, recovery request, PKCE callback/password update, missing-session reset handling and mobile layout; no page exceptions. Live SQL policy sections passed and the security advisor returned no findings. No real email delivery or production deployment is claimed.
