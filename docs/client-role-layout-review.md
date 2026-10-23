# My role layout review, 23 October 2026

The owner authorizes the applicable changes in the supplied role review screenshot and visual consistency with My day. This adds to `client-role-review.md`; responsibility editing restrictions, private notes, approved suggestions and side panels remain authoritative.

## Implemented in this pass

- My role title and exact subtitle; compact navy header and progress from five active areas. Decisions opens first. Tabs: Decisions, What I handle, External contacts, Documents, Deadlines.
- What I handle queries existing responsibility/workstream kinds as one paginated list, with Responsibility/Project badges and All/Responsibilities/Projects filters. No stored category, ID, relationship or database schema changes. Old section links remain supported, including individual record links.
- One contextual Add entry per tab, a secondary Add from an email or notes link to Capture, and the existing explicit AI drafting control. The combined Add/AI panels offer responsibility/project selection where permitted. Employees can create projects, never responsibilities; per-row edit/archive permissions remain distinct.
- One searchable Viewing dropdown for leaders, no owner controls for employees. It follows company/profile RLS; keyboard selection, Escape, focus return and search retain access restrictions.
- Search/archive controls appear only when the tab has saved records, including archived-only records, or a filter is active. This preserves access to restored items and empty search recovery.
- Exact purpose line and progress label. Empty sections link to Capture. No duplicate add/footer/explainer cards.
- Contacts support Paste an email signature, reviewing extracted name/email/phone and preserving already entered fields. Nothing saves until Save. Contacts require a name and email or phone in this form.
- Brand tokens, navy/blue palette and fonts match My day. Larger tabs/body text, 44px controls, rounded cards, responsive widths and reduced motion. Private notes and review UI are retained. The completed-task notes viewer is compact and below the records; the privacy control sits beside the purpose line.

## Boundaries and conflicts

The brief also says not to change the database. Existing constraints require a decision reason/date/owner, a document file/link and a recurrence on recurring deadlines. Those checks are retained; title-only saving for these categories is not implemented and no fabricated defaults replace missing facts. Other descriptive fields remain optional.

Capture already reviews extracted contacts as drafts before confirmation and saves decisions/tasks to their respective lists. A new post-confirmation suggestion for every mentioned person and attachment-to-document flow is not implemented by this role layout change. Capture currently has no general attachment-upload flow. These require a separately verified Capture extension rather than a misleading active control.

The handover approval/publishing/cover lifecycle remains unfinished. Existing role record IDs and kind values are unchanged, and AI handover source loading still reads both responsibility and workstream kinds. There are no older published handovers to migrate or claim as tested. Full published-handover compatibility must be tested when that lifecycle exists.

## Verification

Local check: unit tests, lint, app/Edge type checks and prerender build. GitHub browser regression: five tabs, combined list/filter/pagination, old section links, archive-only restoration, signature review, failed edits, leader member selection, employee restrictions, notes/approvals, AI drafts and responsive screenshots at 360/768/1024/1440. All external calls are intercepted; no real email, provider charge or customer record is created.
