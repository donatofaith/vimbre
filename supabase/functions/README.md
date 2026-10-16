# Server operations

team-invitations is deployed on development. It verifies Auth sessions and HR Admin membership, reserves invitations in PostgreSQL, requests email through Supabase/Brevo and records delivery request status. Its service-role key comes only from built-in Edge Function secrets. See docs/team-setup.md and supabase/config.toml for authorization and deployment details.

AI, forwarding and handover email operations are future features. Every operation must enforce company and record permissions. No provider credentials belong in frontend variables.
