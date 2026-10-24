# Current company settings

The creator displays Super admin; database authorization remains hr_admin. Company settings saves only the name. Account and company email are read only. Team structure links to Pricing and cannot be changed through the client or its database grants. Stripe checkout and entitlements still need integration. Invitations and controlled member edits carry role responsibilities and start date into My role. See [client-role-review.md](client-role-review.md).

# Team and department setup

## Available behavior

HR Admins can create and rename departments, assign an eligible Manager or HR Admin, archive empty departments, edit member names/roles/departments, and activate or deactivate accepted accounts. The last active HR Admin cannot be demoted or deactivated. Moving or deactivating a manager clears any department manager assignments they can no longer hold. Small teams can skip departments; their HR Admin already has company-wide manager permissions.

HR Admins invite people by email with a name, one of the three PRD roles and an optional department (required for non-HR roles in department mode). Invitations expire after seven days and can be resent or cancelled. Resending has a one minute cooldown. Operational email limits are 30 requests per company per hour and 15 per administrator per hour, below or alongside the project's SMTP limits; these are abuse controls, not subscription plan limits.

Team and department screens use explicit foreign key names for embedded queries, preventing the ambiguous profiles/departments relationship bug. Lists are paginated in groups of 20; department/manager pickers search up to 20 choices. Manager and Employee read scopes still come from database policies. Members pending invitation acceptance cannot be activated by editing the Team page.

## Invitation email and acceptance

The authenticated team-invitations Edge Function verifies the caller through Auth.getUser. A caller-scoped RPC checks active, verified HR Admin membership and reserves a company-scoped invitation. No browser-supplied company identifier is accepted. The RPC may be called by an authenticated HR Admin to reserve an invitation, but reservation grants no membership and sends no mail.

The function requests an email sign-in link through Supabase Auth and the connected Brevo SMTP service. It always uses https://vimbre.vercel.app/auth/callback. This avoids needing another redirect allowlist entry and allows the recipient to use a different browser. The default Supabase email sign-in template is used; customizing its invitation wording in the Auth dashboard remains optional. Seven-day invitation validity does not extend the shorter Auth email link lifetime; an expired email link needs Resend.

The auth user trigger binds a new invited account only to a real, pending, unexpired invitation matching its email. It takes the role/name/department from the protected invitation row, not metadata, and creates an inactive profile. Existing unaccepted invitation accounts can receive another email sign-in link. Addresses belonging to an existing workspace are rejected rather than silently reassigned; account transfers between companies are not part of this stage.

For callback URLs carrying an access-token fragment, the SDK uses the supported implicit email-link flow and removes the fragment. Other signup/recovery requests continue to use PKCE. Auth.getUser verifies the session before an invitation is displayed. The recipient sets a password and explicitly accepts at /join. The acceptance RPC checks the verified email, bound user, status, expiry, company and department before activating membership. Cancellation or expiry prevents access even if an old Auth link still produces a session. Acceptance is idempotent.

Every send attempt is recorded in email_log. requested means reserved/in progress; accepted means Auth accepted the email request, not proof of inbox delivery; failed records a safe error code. Only the service role can mark delivery status. No SMTP credentials, tokens or passwords are stored in application tables or client code. Signup receipt was reported by the user; a live invitation inbox acceptance test remains to be run with a team-selected recipient. Development tests send no emails.

## Server deployment

The function is deployed on the Vimbre development project with npm:@supabase/supabase-js@2.118.0. Supabase supplies its built-in URL, anon key and service-role environment variables. The function's gateway verify_jwt setting is false because the handler itself verifies every bearer token with Auth.getUser and the database checks HR membership. There is no anonymous send path. CORS allows the canonical app and local port 5173; other origins are rejected.

supabase/config.toml preserves this configuration for CLI deployment. No service key is committed. All privileged database functions live in private; public RPCs are SECURITY INVOKER wrappers with restricted grants. Invitation helpers have no arbitrary cross-company read interface. Department and invitation changes append audit entries. Applied migrations 20261016021024_team_setup.sql and 20261016023106_archive_cancelled_invite_departments.sql must not be rewritten. The latter lets an empty department detach never-accepted inactive invite profiles after cancellation or expiry, so these profiles cannot strand an archive.

## Verification

- Live rollback-only SQL: original auth isolation suite; invitation bootstrap/acceptance/idempotency; manager and archive rules; last-admin protection; company isolation; denied employee writes and forged email status; resend cooldown; cancellation; unverified/wrong recipients; expiry and reissue. No fixture accounts remain.
- Eleven unit tests include five Edge Function boundary cases: invalid identity, non-admin access, fixed recipient/redirect, SMTP failure recording, and unsupported actions/origins.
- Browser integration covers department creation/manager assignment, member edit, invite/create/resend/cancel, acceptance in a separate browser context, read-only Employee controls and mobile layout, alongside the original authentication/countdown/password toggle checks. Auth/Data API traffic is intercepted; actual policies are checked separately in PostgreSQL.
- Deployed function rejects missing authentication with HTTP 401. No real email was sent by these tests.
- Security advisor reported leaked-password protection disabled in Auth, with no database RLS/function findings. Enable the available Auth password protection before the pilot: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. Use the required production backups/project plan before storing customer data.

## Non-developer acceptance check

1. Log in as HR Admin. Open Departments and create one, or retain small team mode.
2. Open Team. Invite an email address belonging to a person who has agreed to test.
3. That person opens the email sign-in link, checks the company/role/department, sets a password and accepts.
4. Confirm they appear as Active with the intended role. A Manager sees only their department; an Employee cannot edit team settings.
5. Test resend with a second pending invitation, then cancel it. Its recipient must be unable to join. Check an expired/reissued email link as well.
6. Assign a department manager, change their role or deactivate them, and verify the manager assignment is cleared. The last active HR Admin must remain protected.

