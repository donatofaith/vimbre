# Action colours, 1 November 2026

Owner request: Delete is red, Suspend is amber and Save/general primary actions use Vimbre blue. Added explicit danger/warning variants to the shared Button and applied them to Capture, handover drafts, tasks, recurring tasks, rules, templates and team status actions. Conditional bulk actions colour only Delete red. Team Dismiss is red; Reactivate remains a normal action. Save controls previously styled as secondary now use primary blue.

Dedicated action CSS has enough specificity to override earlier feature rules, including TaskPanel's md-delete styling. Labels, confirmation steps, disabled states, handlers and permissions remain intact. The latest remote stale-task editor fix is preserved.

Verification: production build, 299 unit tests and AI/billing type checks passed. No live user data or paid AI request is used. Local browser execution is unavailable in this environment. Console navigation is changed in the separate vimbre-console repository.
