# Supabase development backend

Authentication/company foundation and team setup are applied to the connected Vimbre development project. Migrations record companies, departments, profiles, invitations, email_log and activity_log, private helpers, triggers, RLS and restricted grants. The team-invitations Edge Function is deployed; its config and pinned dependencies are committed.

Do not reapply recorded migrations to the existing project. Filenames match migration history. Apply in order to a fresh project, keep applied contents immutable and regenerate types after schema changes. database.ts supplies nullable RPC argument overrides without editing the generated snapshot.

Run tests/auth_isolation.sql independently. For each team suite, prepend tests/team-fixtures.sql in the same request/session; all test records roll back. See docs/team-setup.md for the server contract, authorization, email request logging and real inbox acceptance. Storage, AI, forwarding and handovers remain future work. Production requires a separate appropriately backed-up project.
