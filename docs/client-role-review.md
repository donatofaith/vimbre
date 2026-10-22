# Client role and dashboard review, 21 October 2026

The owner requests these changes directly on GitHub for Vercel review. This replaces the earlier owner-only role editing rules, not Capture privacy or personal task permissions.

## Implemented

- Desktop Collapse sidebar / Expand sidebar uses the full workspace width and persists on the device. Mobile retains its accessible Menu control independently.
- Original compact logo reduced to 96px. Company creator displays Super admin using protected companies.created_by, without changing the database role or relabelling invited HR Admins.
- Consistent section/form spacing. Account email and company contact email are read only in Settings. Save changes only the company name. Structure changes link to public Pricing. Database grants and a trigger reject client changes to contact email/team mode.
- Tabs: Responsibilities, Open work, External contacts, Documents, Recurring deadlines, Decision log. A short helper and one add control per tab. The old database workstream kind is retained for compatibility.
- Right side modal forms have 24px headings, keyboard Escape and focus return. Per-tab client fields replace generic large forms. Decision edits preserve existing status, work links and task links. Responsibility Deadline and Supporting web link fields are removed; historical deadlines are preserved.
- Private document uploads support PDF, text, PNG/JPEG, DOCX and XLSX up to 10MB. Links remain supported. A private bucket follows role access and provides short-lived signed URLs, never public file URLs.
- HR Admins/Super admin edit company role records, Managers edit their department role records, employees edit their own other tabs. Employees cannot create/edit/archive responsibilities directly. My notes is visible only to the owner. Suggest a change creates a pending description proposal. Managers/administrators review proposals on My role, with explicit approval or decline and stale-version/duplicate guards.
- Team invitations/member edits accept responsibility context and start date. Context is copied from protected invitations only after acceptance, and displayed at the top of My role. No membership is taken from editable Auth metadata.
- Recurring deadlines due today or earlier also appear in My day, linking to their original record without duplicating tasks. Dates are formatted in readable British date style.

## External services still required

All six My role tabs now have structured AI drafts using their own fields, with editable review and explicit Save. My day can draft tasks from a pasted email; team setup can draft responsibility context. Document drafts accept PDF and plain text, or a pasted link with notes. Company AI allowances are configured and enforced. See docs/ai-features.md for input bounds and verification.

The email forwarding receiver is implemented but is not live until Brevo, receiving DNS, the webhook secret and verified addresses are configured. Handover summary drafting works; approval, publishing and temporary cover remain separate work.

Stripe checkout and paid plan entitlements are not implemented. Pricing navigation does not subscribe, take payment or unlock team mode. Complete authenticated checkout/webhook processing with the founder's Stripe configuration before enabling paid structure changes. No plan entitlement is invented.

## Verification

Run npm run check and GitHub Actions browser checks. Database suite: concatenate supabase/tests/team-fixtures.sql and supabase/tests/role-review.sql; it rolls back every fixture and sends no emails. Tests cover settings column grants/trigger, employee restrictions, manager editing, private notes, approvals, protected member context and company isolation. Browser tests use intercepted API fixtures; actual email inbox delivery is a separate acceptance test.
