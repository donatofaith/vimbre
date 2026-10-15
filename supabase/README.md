# Supabase development backend

The company/auth foundation is applied to the connected Vimbre development project. Migrations record the schema, private helpers, triggers, RLS and grants. The second migration corrects audit trigger table handling and revokes client execution of the platform DDL event handler.

Do not reapply these to the existing development database. Recorded versions match the filenames. For a fresh project, apply in order; generate new migrations with the CLI and keep applied contents immutable. Regenerate client types after schema changes.

Run tests/auth_isolation.sql with administrative SQL access in development; fixtures roll back. See ../docs/auth-setup.md for SMTP, callbacks, access design and acceptance gaps. Production must use a separate project. Storage, Edge Functions and invitations are not deployed yet.
