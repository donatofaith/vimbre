# My role: final phase 1 and phase 2 brief

This client brief supersedes earlier role reviews: What I handle comes first; holders can maintain their manual profile; another person's role is read only. Existing My day and Capture briefs remain effective.

## Phase 1

Compact header: My role; “What someone covering you would need to know.” Role title, department, line manager, preferred cover and five-area filled count. Keep explicit manager visibility information and the read-only viewer banner.

Tabs: What I handle, Decisions, External contacts, Documents, Deadlines. Preserve exact helper text and actionable empty states. Side-panel forms retain work frequency, clients/projects, tools and steps; decision why/author/dates/scope/source/outcome/review; contact organisation/role/contact/context/date/notes; document link/tool/purpose/checked date; deadline date/repeat/needed/reminder.

Decisions have Active, Replaced and Archived states. Replacement is atomic, retains the original, and links in both directions. Search/filter only above five decisions; history remains accessible below that threshold. Existing reversed decisions retain their truthful legacy label.

Role knowledge belongs to a stable role. Personal notes stay with their author. External contacts are available only to holder, line manager and approved active cover. Other company leaders retain scoped access to non-contact role information. Manager viewing does not permit direct edits. Source Capture content remains private.

One Add action per tab. Capture from email or notes preselects the role; no separate Use Vimbre AI button. My notes is free text with “Included in your handover.” Create handover from my role assembles current role content and own notes into an editable draft, saved explicitly and approved separately. Deadlines appear on My day.

## Phase 2, implemented behind company flags

`private.role_features` defaults all flags off: ai, manager_review, reassignment, readiness, recurring. Enable deliberately through trusted administrative configuration. This follows the client's instruction to build now and switch phase 2 on by flag.

AI: Suggest from my work reads confirmed role records, runs on tap, displays allowance, uses the configured smaller role model, caches unchanged input and requires review/save. Manager suggestions target a record and are applied only when accepted by the holder; concurrent changes invalidate stale suggestions. Reassignment moves role knowledge, not old personal notes, sources or tasks. Recurring work creates current-holder tasks with cycle deduplication. Enhanced readiness requires recent review within 90 days or legitimate Nothing to add, identifies attention areas, and shows a monthly review nudge.

## Verification

Unit checks cover readiness, legacy field precedence and tab order. SQL rollback fixtures verify stable identity, decision links, private notes, manager denial, suggestions, flags, transfer, tenant isolation and task ownership. Browser fixtures exercise manual forms, failed-save retention, retry, history, archive/restore, pagination, responsive layouts, manager read-only views, handover and explicit AI acceptance/cache. All provider requests are intercepted in browser tests.
