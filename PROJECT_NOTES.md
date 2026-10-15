# Vimbre project notes

Authority: fresh build from the PRD dated 15 October 2026 and subsequent written decisions. No Bolt implementation is reused.

## Implemented

Responsive project foundation, approved glass/blur/brief motion, reduced motion, shared UI, navigation, public configuration validation and automated checks. Account signup, confirmation callback/resend, login/logout, recovery and protected workspace routes now use Supabase. A server trigger creates the first company and HR Admin. Company settings are persisted. companies, departments, profiles and activity_log have RLS, restricted grants, indexes and foreign keys. Generated database types are committed.

## Pending

Real email acceptance needs Brevo SMTP and final Auth callback URLs. Invitations, department administration, role records, decisions, actions, Capture/AI, email forwarding, planned handovers and cover permissions remain unimplemented. The schema supports role/department isolation but has no frontend membership administration yet. No public deployment has been created.

## Security and configuration

Use the Vimbre connection's development project only. Public URL/publishable key are intentionally committed in src/lib/public-project.ts and can be overridden with validated VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. Never commit server credentials. Use a separate production project.

Roles come from protected profiles, not user_metadata. Only HR Admins can change company settings. Clients cannot change roles, membership or audit history. One company per user. Bootstrap is atomic. Future invitations must not reuse company signup. New privileged operations need explicit authorization and company checks.

## Verification and next milestone

Six unit tests, lint, typecheck, build, intercepted browser checks and rollback-only live policy checks passed. Database security advisors returned no findings. Email delivery is not verified; see docs/auth-setup.md. Next: configure and verify email, then controlled team invitations and department management. Keep feature status honest.

Continue on development; review the open PR before merging main. Applied migration contents are immutable; add follow-up migrations for changes. See docs/auth-setup.md and docs/manual-checks.md for setup and checks.
