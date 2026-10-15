# Authentication

AuthProvider verifies the Auth user and loads an active profile/company. AuthPage implements login, company signup, confirmation resend, recovery and password reset. AuthCallback handles PKCE redirects. RequireAuth protects all workspace routes. Browser event callbacks remain synchronous; profile loading runs separately.

Company bootstrap and role assignment are enforced by database triggers and policies. See docs/auth-setup.md for configuration and outstanding live email acceptance.
