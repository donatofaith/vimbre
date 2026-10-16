# Architecture

React, TypeScript and Vite render the responsive client. React Router separates public account pages from a protected /app layout. Supabase Auth provides verified sessions and PKCE callbacks. The typed Supabase JavaScript client uses the REST Data API for profile and company reads and permitted company updates.

Database RLS and column grants enforce company, department, owner and active membership boundaries. Private helpers read authorization from profiles. Browser role values and editable user metadata never determine access. A database trigger creates the first company and HR Admin atomically. Audit events are created by triggers and cannot be forged through the client.

Company signup, departments and team administration are implemented. Private checked RPCs manage departments/member changes and protect the last active HR Admin. The team-invitations Edge Function verifies the caller, requests sign-in emails through Supabase/Brevo and records email request status. Verified recipients accept at /join before membership activates. Capture, AI, email forwarding and handover changes will use Edge Functions and atomic database operations as appropriate. Private Storage and cover assignment access are future features, not deployed capabilities.

Browser configuration contains only the development project's public URL and publishable key, with validated environment overrides. Server secrets are never included in the client. Separate production configuration and real email acceptance remain pending; see auth-setup.md.

Fonts are bundled locally. Colours, glass and animation tokens live in src/styles/tokens.css. The approved glass, blur and brief motion override the PRD's earlier flat surface restriction. Reduced motion and solid surface fallbacks remain supported. The PRD and later written decisions remain authoritative; Bolt code is not reused.

Team details, deployment configuration and acceptance checks are in team-setup.md. All lists are bounded; team modules load separately to keep the initial browser bundle under the build warning threshold.

Role records use role_items and decisions, with owner/company composite keys and RLS. Only the owner can write; managers and HR have scoped read access. The public landing page is separate from the protected workspace and links to account routes. Public and team/records pages load as separate chunks. See role-records.md for the data contract, limitations and acceptance checks. The UI remains a working design foundation ahead of final visual polish.

My day uses the actions table with owner/company and decision composite foreign keys. RLS uses the existing protected-profile scope helper; writes remain owner-only, timestamps are server-controlled and UI-open audit is checked. Date-based views use the browser calendar day. Shared Input hints keep labels and accessible descriptions alongside placeholders. Details and manual checks: actions-my-day.md.
