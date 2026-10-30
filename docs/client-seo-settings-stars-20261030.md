# Public guides and workspace settings — 30 October 2026

Client requests: Organization, SoftwareApplication, WebSite, matching FAQ and blog Article markup; six useful handover search pages; Microsoft Clarity project z5t36wwl41; accepted invitations hidden; explicit member statuses; company logo; organised Settings; header Stars entry; shorter Stars settings; read-state badges; responsive rankings.

## Result

- Six substantive, public /blog/{slug} guides with editable, downloadable plain-text templates, visible FAQs and related guides. Listed in Blog and the public sitemap; no new top-level navigation entries. Build prerenders each guide, its own title/description/canonical and JSON-LD.
- Homepage Organization and WebSite identities connect to existing SoftwareApplication and visible FAQ markup. Software offers match visible GBP plans. BlogPosting is also typed Article; article FAQ markup matches visible questions. No fabricated ratings or social accounts. Official social profile URLs were not in supplied configuration, so sameAs remains pending the owner supplying them.
- Clarity is loaded by a head bootstrap only after optional analytics acceptance, only on the public homepage/blog. It sends analytics consent granted, ads denied. It stops before SPA transitions to private/account routes and does not restart within that document. Fresh public documents can load it again. Cookie settings and privacy text disclose Clarity. GTM was checked for an existing Clarity install and none was present. Clarity dashboard receipt requires a real consenting public visit; no private workspace recordings are intended.
- Settings categories mount only the chosen settings panel. Company admins can upload PNG/JPEG/WebP logos (2 MB input, browser re-encodes and strips metadata to max 256px / 256 KB WebP); private same-company storage and signed image URLs. Logo appears with company identity in workspace navigation.
- Accepted invitations are excluded in the server list query and counts, while retained in storage as acceptance history. Members remain visible.
- HR admins can Suspend, Mark as left, Dismiss or Reactivate another member. Existing active flag still enforces access, last-admin protection, tenant scope, accepted-invite checks and billing member limits. No employee was actually removed. Work records stay intact.
- Stars moved from the My day strip to a header star icon beside chat/bell. Rankings use distinct rank/name/score rows and labelled responsive team averages. Stars remain opt-in activity recognition, not employee performance scores. Settings explanation reduced to a short disclosure and Stars terms link.
- Reading task/role/capture/handover reminders now saves a private receipt; unread badge no longer equates those reminders with incomplete work. Existing deadline, support and chat read mechanisms remain; visible chat read acknowledgements retry after focus/visibility returns.

## Validation

Production build and public prerender passed. Unit suites, consent tests, guide escaping/schema/download tests and layout rendering checks run locally. Live SQL acceptance uses existing accounts inside a rolled-back transaction; status transitions, self/employee/cross-company denial, receipt deduplication and account isolation passed. Logo bucket is private; scoped Storage policies and column grants checked. Security advisors show no new public privileged-function warning; receipt table intentionally has no client grants or policies and is accessed only through authenticated checked functions.

Browser checks use mock data and actual ranking/settings styles at desktop and 360px, plus the public guide. No real member status, logo, message, paid AI call or notification was changed for testing. Authenticated real-device upload and notification smoke checks remain a release acceptance step. No guarantee of Google/LLM rankings or FAQ rich results.
