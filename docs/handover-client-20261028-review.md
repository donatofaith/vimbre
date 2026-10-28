# Release approved — 28 October 2026

The owner explicitly approved final database validation, migrations and deployment. Final core validation passed before installation; core and helper acceptance passed against the installed schema in rollback transactions. Both migrations installed as `20261028033318` and `20261028033338`; repository filenames match hosted history. PR #10 merged. The previous pending status below records the pre-approval review and is superseded by this release note.

# Handovers review release — 28 October 2026

The client specification replaces the handover drawer with a full-page, four-step editor and review, cover and return workflow.

## Scope
- Details, Include, Draft, Send; autosave/resume, retry, unsaved-change guards, automatic titles, date validation and unknown return.
- Searchable cover/manager selection, adjacent warnings, real readiness and selected role sources. Private rows are excluded; personal notes require owner opt-in. Sudden absence excludes personal notes.
- Explicit AI with quota information and preserved manual input on failure; editable sections, priority ordering, stale-source confirmation and cover preview.
- Review queues, withdraw/resubmit, reapproval for changed dates/cover, cover tasks, take back, questions, draft deletion and Undo.
- Manager-only notes remain outside cover previews, external shares and AI. External sharing uses selected sections, expiry, revocation and view logging; company opt-in remains required.
- Company policy controls approval, notice, cover access/capacity, required sections and sharing. Pending migration enables previously gated sudden-absence, exit and PDF capabilities.
- My Day links target individual handovers and returning handovers. Phone layout uses one column, native date fields and fixed safe-area actions.

## Validation
`npm run check` passes: lint, 207 tests in 40 files, application/Edge TypeScript and production build. The mocked browser workflow passes autosave/resume, validation, explicit AI/failure retention, approval/withdraw, cover task completion, take back, questions, sharing/revocation, delete/Undo and 15 responsive widths.

Earlier rollback-only SQL acceptance passed core workflow, private-note isolation, company boundaries, source filtering, comments and delete/Undo. Automatic approval review blocked the final regenerated SQL rerun; earlier results do not establish acceptance of every final SQL change. No paid AI request or real message was used.

## Pending release approval
Neither migration nor dependent frontend is live:
1. `20261028015814_handover_client_final_20261028.sql`: metadata, private tables, access helpers and snapshots.
2. `20261028022537_handover_client_workflow_20261028.sql`: dispatcher, approval/cover workflow, reminders, AI filtering and My Day projections.

Automatic approval review rejected live schema/authorization changes and the final rollback-only test because live transactions can take locks and affect permissions/workflow. Approval is required for final database validation, these migrations and the dependent deployment. Validate in staging where available, then rerun SQL acceptance before production release. Check installed grants, sharing isolation, reminder deduplication and cover completion. Reminders are not scheduled by this review branch alone.
