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
