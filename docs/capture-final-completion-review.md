# Capture final implementation — 26 October 2026

Authority: client-capture-final-20261026.md. The approved My Day workflows and explicit source-write consent remain intact.

## Implemented

- Add → Check → Saved, exact introduction and paste example, source logos/chips, one primary action, optional title/date/label, manual fallback, conditional character counter and automatic email cleanup.
- Connected account controls and company tool permissions in Settings. Bound OAuth callback verification and branded redirect are preserved. Capture uses read permissions; My Day's separately granted write permissions are preserved.
- Native provider search, 20 metadata records per page, five-minute private search cache, owned opaque pagination, named place pickers, grouped email conversations, date/person/place/type/read/attachment/action-hint filters and default captured-item exclusion. Bodies are read after selection. Up to ten selected conversations can be queued; the cost is visible beforehand. Keyboard selection/preview/draft controls and mobile preview stacking are implemented.
- PDF selection from Drive uses the existing bounded browser extractor. Google Sheets exports CSV; Docs/text and the existing PDF/DOCX/TXT/VTT/SRT uploads remain supported. Provider source IDs and text fingerprints protect retries; confirmed originals remain immutable.
- Task/Decision review cards, verified source quotations, sender/date, missing-details flags, edit/accept/dismiss, accept all, duplicate warnings and merged repeated proposals. Legacy summaries/contacts remain readable. The final confirmation remains atomic and keeps assignment acceptance.
- Flat capture history with outcome filters, per-type counts, archive/restore, meaningful read errors and retry/manual fallback.
- Owner-private Watch rules with chosen words/people, mention conditions, frequency, daily cap, pause/resume and visible allowance/reconnect states. Watch and future verified forwards create private drafts, never confirmed tasks. Checked metadata versions and owned provider cursors prevent repeated work from blocking later matches.
- A separately authenticated Capture worker uses the existing scheduler capability without enabling reminder emails. Company AI controls, shared reservations, existing small-model routing, cache reuse and draft-attempt limits remain authoritative.

## Operational limits

Provider consent determines account access. Existing Slack accounts may require fresh consent for search:read and users:read; Teams channels require the delegated channel read permissions and may require tenant administrator approval. Capture never requests provider write access by default.

A Drive PDF selected by a person is extracted in the browser. Background Watch reports PDF matches as requiring manual preview and continues checking supported text documents. Overlong/unreadable conversations retain an actionable manual-preview error. No mailbox is downloaded in full.

## Verification

- Unit tests include native queries, metadata-only Gmail search, provider page sizes, date validation, fixed-host Graph pagination, selected thread cleanup, quotation verification, proposal merging, scheduler authentication, allowance pauses and progression beyond previously checked Watch results.
- Rollback-only database checks cover private history, cross-company access, preview/cursor ownership, expired searches, source/text duplicate reuse, queue idempotency, Watch leases/caps/allowance pause, and review-before-confirmation. Existing Capture confirmation/cache/privacy/redraft tests are also run.
- Browser checks use mocked providers and database responses; no customer email or paid AI generation is used. They cover the full flow, failed confirmation, manual fallback, selection/preview, pagination, cost, Watch pause, connection failures/callback binding, and Chromium/WebKit responsiveness.

Installed migration: `20261026191631_capture_final_selected_sources_and_watch`. Active Edge functions: capture-connect v19, capture-worker v1 and ai-run v19. The small-model Capture route remains enabled. Database verification passed for the new Capture flow, the existing lifecycle/privacy/confirmation suite, the original cache/redraft pipeline, and My Day suite regressions. Live unauthenticated requests to capture-connect and capture-worker both return 401. Anonymous workspace access and authenticated access to worker/search-service RPCs and private queue rows are denied. Final release and CI evidence follow publication.
