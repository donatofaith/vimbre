# Vimbre development instructions

Read `PROJECT_NOTES.md` and the relevant feature documentation before changing the app.

## User-facing copy

- Write concise, professional copy for end users doing their work. Do not explain the build to the project implementer inside the interface.
- Remove redundant permissions reminders, obvious control definitions, repeated page introductions and generic filler.
- Keep useful examples/placeholders, actionable empty states, errors, requested access/privacy information, and material consequences or limitations. Never imply unfinished functionality works.
- Preserve the client’s explicit wording and behaviors in `docs/client-my-day-review.md` and `docs/client-team-activity-review.md` and `docs/client-capture-review.md`, including the My day labels, empty state, tabs, Capture entry, checklist and “What my manager can see” link. Do not change these during general copy cleanup without explicit authorization.
- Copy edits must preserve functionality, accessibility and authorization rules.


- Preserve `docs/client-role-review.md`: employee responsibilities are read only, notes are private, suggested changes require approval, and role forms use side panels. Founder display is Super admin; invited HR Admin remains a separate label. Settings changes cannot bypass subscription controls.

- The 22 October client My day brief in docs/client-my-day-v2.md supersedes the earlier My day layout, filters and primary controls. Keep all earlier privacy, team visibility and role permissions. Use the new three-status workflow and explicit Save for context.

- The 23 October role layout review in docs/client-role-layout-review.md supersedes the prior role tab order and duplicate owner controls. Decisions first; responsibilities/projects share What I handle in the interface only. Preserve stored kinds, legacy links, per-row responsibility restrictions, private notes, approvals and required database validation. Match My day visual styling.

- The 23 October ranked My day brief in docs/client-my-day-ranked-review.md supersedes My day v2 defaults and layout. List first on every device; pins, timezone filters/counts, explicit context saves, collapsed Done, one Capture entry and sidebar Weekly summary. Preserve owner-only task content and the limited team projection. Approved cover only, scoped reviewer, no implicit role access grants.

- The 23 October final Capture brief in docs/client-capture-final-review.md supersedes prior Capture layout/copy. Explicit AI only, private drafts, accept then confirm, truthful channel flags, shared pipeline, cached duplicate reuse and two redrafts. Keep the ranked My day behavior unchanged.

- The final My role phase 1/2 brief in docs/client-role-final-review.md supersedes prior role restrictions and layout: What I handle first, holder-maintained manual records, other-role views read only, stable role identity, retained replacement history and private author notes. Phase 2 is built behind server flags. Preserve approved My day and Capture behavior.

- The 24 October final Handovers brief in docs/client-handover-final-review.md supersedes the earlier handover UI: four steps, explicit manager review, selected-task cover access, take back, version history and gated phase 2. No duplicate sidebar navigation in Handovers or Settings; keep precise record links, requested wording and actionable errors.

- The 24 October device review in docs/responsive-review.md requires full-width tablet content and a collapsible workspace Menu through 1024px. Preserve desktop collapse preferences without hiding the tablet menu. Safari native controls must fit their fields; never mask clipped controls with document overflow rules.

- The 24 October owner request in docs/capture-connections.md adds user-selected external sources through the existing Capture review/confirm pipeline. My day stays unchanged. Never claim provider connection availability without registered OAuth apps, server secrets and verified consent. Tokens remain owner-private in Vault; no Console access. Keep Support's headset icon and contact emails on that page, with no header Help duplicate.

- The 26 October screenshots in docs/client-my-day-approved.md supersede the ranked My Day presentation and pin/priority defaults. Preserve private data boundaries. Do not treat the acceptance checklist as proof of implementation.

- The 26 October Capture final specification in docs/client-capture-final-20261026.md supersedes earlier Capture layout, picker, statuses and Watch behavior. Provider-native search, read-only Capture consent, explicit source selection, scoped Watch opt-in and review before confirmation are required. Preserve approved My Day source-update consent and task workflows.

- The 27 October My role screenshots in docs/client-role-20261027.md supersede all previous role layout/phase wording: counted collapsible sections, real readiness, inclusion/private boundaries, autosaved individual notes, rule suggestions, explicit reviewed five-line AI summary, manager review, role guides/templates/successor drafts. Core repeating tasks and freshness no longer require the earlier phase-two flags. Preserve My Day task operations and Capture consent.

- The 27 October shared UI and My Day screenshots supersede prior visual sizing: 36px buttons (44px on touch), 1120px content, 24/16px insets, flat 16px-padded cards. Finish UI before new My Day planning/stars. Competition must be company opt-in and individually opt-in; stars are not performance scores.

- The owner's 27 October layout correction in docs/client-centred-forms-20261027.md supersedes compact greeting height and side/bottom form positioning: shared forms are centred on every device; My Day uses the spacious Handovers-style header. Remove competing geometry rules and verify actual dialog centring, not only no-overflow.

- The 28 October Handovers specification in docs/client-handover-20261028.md supersedes earlier handover UI and phase gating. Preserve private manager notes, owner-only note opt-in, company boundaries, explicit AI and approval before cover access. Owner approved the release; database migrations are installed and final SQL acceptance passed; see docs/handover-client-20261028-review.md.
