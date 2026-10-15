# Architecture

React, TypeScript and Vite render the responsive client. React Router separates public account pages from a protected /app layout. Supabase Auth provides verified sessions and PKCE callbacks. The typed Supabase JavaScript client uses the REST Data API for profile and company reads and permitted company updates.

Database RLS and column grants enforce company, department, owner and active membership boundaries. Private helpers read authorization from profiles. Browser role values and editable user metadata never determine access. A database trigger creates the first company and HR Admin atomically. Audit events are created by triggers and cannot be forged through the client.

Company signup is implemented. Invitations and department administration require controlled server operations in the next stage. Capture, AI, email forwarding and handover changes will use Edge Functions and atomic database operations as appropriate. Private Storage and cover assignment access are future features, not deployed capabilities.

Browser configuration contains only the development project's public URL and publishable key, with validated environment overrides. Server secrets are never included in the client. Separate production configuration and real email acceptance remain pending; see auth-setup.md.

Fonts are bundled locally. Colours, glass and animation tokens live in src/styles/tokens.css. The approved glass, blur and brief motion override the PRD's earlier flat surface restriction. Reduced motion and solid surface fallbacks remain supported. The PRD and later written decisions remain authoritative; Bolt code is not reused.
