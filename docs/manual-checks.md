# Verification

Run npm ci and npm run check. Lint, eleven unit tests, TypeScript and the production build must pass. Install Chromium (`npx playwright install chromium`) and run npm run test:browser for browser integration with intercepted Auth/Data API responses. These browser fixtures are never inserted into Supabase.

Run supabase/tests/auth_isolation.sql against a development database with administrator SQL access. It creates temporary fixtures inside a transaction and rolls everything back. Verify no test users/companies remain. The tests cover company isolation, HR Admin/Manager/Employee scope, denied role escalation, company reassignment, audit forgery, inactive members and anonymous access. Run security advisors after schema changes.

For live email acceptance, follow docs/auth-setup.md. SMTP, allowed callback URLs and a team-owned inbox are required. The user has received a signup email; live recovery and invitation inbox acceptance remain pending.

Review at 360 pixels: account forms, validation messages, navigation menu, company settings and no horizontal scrolling. Use Tab to navigate with visible focus. With reduced motion enabled, entrance animations must stop. Check unknown routes and direct /app links while logged out. Unfinished product features must keep honest availability messages.

Recorded local checks: all eleven unit tests, lint, typecheck and production build passed. Browser integration passed account signup metadata/validation, login, profile/company loading, settings save/reload, logout, recovery request, PKCE callback/password update, missing-session reset handling and mobile layout; no page exceptions. Live SQL policy sections passed and the security advisor returned no findings. No real email delivery or production deployment is claimed.

## Confirmation resend and password visibility

Confirm the resend button starts at 1:00, visibly decreases each second and becomes enabled at zero. Resending must use the signup email and restart the cooldown. Browser integration uses Playwright's clock to check elapsed time without sending email. A successful resend response does not prove delivery: confirmed addresses do not need another confirmation. The confirmation screen now points users who already opened a link to login.

Every password field has an independent Show/Hide button. Toggling must preserve the entered value, avoid submitting the form and work from the keyboard. The button exposes its target and pressed state to assistive technology.

## Team setup

Follow docs/team-setup.md for the non-developer acceptance checklist. Run team-fixtures.sql followed by each team-invitation-accept.sql, team-permissions.sql, team-invitation-cancel.sql and team-invitation-rejections.sql in the same administrative SQL request/session. Every suite ends with rollback. Run auth_isolation.sql independently. Never run fixture setup without completing or rolling back its transaction. The browser command now runs both authentication and team suites. Tests send no live invitations.
