# Database migrations

These migrations are applied to development; filenames match its migration history. Files were created with the Supabase CLI and aligned to the versions recorded when applied through the connector. Apply in order only to fresh environments. Never rewrite applied SQL; create a follow-up migration.

Keep foreign keys, indexes, RLS and grants together. Run ../tests/auth_isolation.sql and security advisors after changes. The original Bolt schema is not used.
