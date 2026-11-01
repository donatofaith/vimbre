# Support layout correction

The owner reported that Help and support was too small and Console's Send action fell below the visible screen. The customer Help page now uses the full available workspace with independently scrolling request/message lists, an always-visible reply footer and a separately scrolling new-request form above its Send footer. Labels, ticket ownership, requests, customer approval, rate limits and existing RPC handlers remain intact.

The Console has the corresponding layout and sidebar correction in its own repository. See its docs/console-completion-audit-20261101.md for the remaining PRD work.

Verified locally: production builds, 299 customer unit tests and 23 Console unit tests. A local browser preview exercised actual support components with in-memory replies/requests at 1366×600, 1440×900, 1024×768, 768×1024, 390×740 and 320×568. Customer checks use actual workspace CSS with a fixture shell; Console checks use its actual App. These are UI/geometry checks, not proof of real email delivery or live authorization. No real message or paid AI request was sent. GitHub Actions is not used; release commits use [skip ci].

The development server allows the exact terminal.local preview hostname for local browser checks. Test-only fixture pages are excluded from this release. No database, provider credentials, payment rules or customer content permissions change.
