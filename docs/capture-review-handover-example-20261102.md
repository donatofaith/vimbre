# Capture acceptance and Handover example — 2 November 2026

## Report and investigation

The owner reported lag while accepting tasks extracted from a conversation. Read-only inspection found that each Capture draft acceptance performed an edit, reloaded options/history/detail/duplicates, and dispatched a global work-changed event. The revision key also removed the current review page while detail was loading. That fan-out is a confirmed implementation issue; it is not proof of the exact cause of every earlier slowdown.

Hosted cumulative query statistics included capture_pipeline mean 106.07ms/max 5190.52ms and capture_workspace mean 96.66ms/max 3410.33ms for their respective observed signatures. These are accumulated database execution statistics, not the user’s individual request trace or total browser latency. The selected 06:00–14:00 UTC log window returned successful Capture workspace/pipeline calls in the narrow endpoint query. No source text, customer task content or credentials were read. Performance advisors were inspected; unrelated index/policy recommendations were not changed.

## Capture correction

Accepting or editing a draft still uses the existing guarded capture_change operation, then reads the authoritative capture detail and duplicate warnings. It updates the current page in place. It does not reload options/history or send the global work-changed event. The version returned must equal the expected increment, so a concurrent unseen edit cannot become accepted. Failures keep acceptance off and use the existing reload/error path. Existing owner/company guards and explicit final Save behavior are untouched.

The review operation has an immediate duplicate-submit guard. AI drafting no longer dispatches its successful refresh twice. No new database functions, schemas, policies, grants, credentials or provider calls were introduced.

## Handover example

The in-app “See what a handover looks like” link now opens a complete fictional Operations handover. It includes owner, cover person, manager, dates, Summary, three ranked priorities with reasons and escalation steps, My work, dated open tasks, decisions and their reasons, contacts, document references, deadlines, watch-outs, notes and included records.

The example and actual saved handovers share HandoverMeta and HandoverSections, keeping field labels, order and text rendering aligned. Real handover approval, cover, edit, PDF, sharing, private manager note and question controls remain in their existing authenticated component. The example performs no handover RPC, has no working approval buttons or fake document links, and its Start handover action opens the ordinary new-handover flow.

## Validation

336 unit tests passed, including authoritative-version checks, rejection of stale/foreign responses and shared section/fallback rendering. Production TypeScript and build checks passed. Browser QA uses actual CapturePage and HandoversPage with sample data and a visible request counter. Five successive accepts produced five edits, five detail reads, five duplicate checks, zero options/history reads and zero global work-changed events. Explicit Save then produced five saved task records. The full capture remained mounted while accepts completed.

The example passed card, text-section and page overflow checks at 15 viewport widths from 320 to 1920px. A desktop screenshot shows the populated priorities and supporting work sections. Cloud browser checks are not a physical-device timing guarantee. GitHub Actions stay skipped; no paid AI call, real source extraction or email send is used for verification.
