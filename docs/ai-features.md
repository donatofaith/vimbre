# AI feature integration

## Available controls

| Location | Task | User control |
| --- | --- | --- |
| Capture, saved source | capture_extract | Draft with Vimbre AI; Review suggestion; editable draft form; Save draft; explicit Confirm |
| My role | tidy_text | Use Vimbre AI; source and result review; Use this draft prefills the normal form; Save remains required |
| My role text fields | tidy_text | Tidy with AI; editable revision; Use this draft updates only the form field |
| Below My day tasks | weekly_summary | Weekly summary; Use my records or paste notes; editable result; copy or discard |
| Handovers | handover_draft | Use my records or paste notes; editable draft; copy or discard |

Company AI allowances are not enabled. Controls are integrated, but the gateway refuses paid calls until an operator configures the agreed daily/monthly request and USD spend caps. The owner says ANTHROPIC_API_KEY has been saved in Supabase; no secret value was inspected. A live paid provider acceptance test has not been performed.

Handover drafting does not implement handover approval, publishing, temporary cover access or notifications about those states. Weekly summaries and handover drafts are transient previews, not saved reports; copy before closing. Neither feature sends email. Capture suggestions are transient until Save draft; saved pending drafts persist privately through existing RPCs. AI origin is informational, not proof or authorization. Generated content needs review.

## Data and validation

The only outbound gateway fields are task and text. Company identity remains server derived. Records are loaded only on explicit request, from the signed-in user's active role records, confirmed live decisions and tasks. Queries use existing RLS plus owner/company filters and select only required work fields. No original sources, pending drafts, personal responsibility notes, signed document links or document file contents are loaded for summaries. Sources remain visible and editable before Generate draft. Each category selects at most 100 latest entries; the scope is stated in the input. Weekly summaries are instructed to use dated work within seven days and treat other records as context.

Gateway input stays bounded at 16,000 UTF8 bytes. Longer sources produce an actionable error, never silent truncation. Capture extraction accepts only bounded arrays of typed fields. Bad JSON or invalid field types fail before saving; incomplete/invalid dates remain blank. Source and generated text are React text/textarea values, never evaluated or injected as HTML. The extraction prompt requests corrected grammar, sentence case and complete supported dates without invented facts. Route/model/cost enforcement stays unchanged.

The capture_ai_review migration preserves next_step through the existing edit/confirm flow. It preserves the original private SECURITY DEFINER function with the same auth.uid/company/source-owner/draft-owner/version checks and ACL; no new public privilege or RLS policy is added. Public wrapper remains SECURITY INVOKER. Migration version matches hosted history.

## Verification

- npm run check: lint, unit tests, gateway and app types, Vite build and homepage prerender.
- Unit extraction tests: valid mapping, missing dates, invalid shapes, oversized fields, code fences, plain markup, empty findings and UTF8 input limits.
- Existing gateway tests cover identity, reservations, count/spend caps, retry references, fallback, safe errors, accounting and key isolation.
- scripts/check-capture-browser.cjs adds mocked gateway cap/error and successful extraction checks, editable suggestions, no automatic save, missing dates, private pending save and remaining-suggestion preservation.
- scripts/check-ai-browser.cjs verifies weekly summary context, text revision before save, handover preview, limit/manual fallback, task-only calls, owner/company filters and responsive widths. No paid request is made.
- Append supabase/tests/capture-ai.sql to supabase/tests/team-fixtures.sql for rollback-only DB checks of AI provenance, next-step retention, explicit confirmation, cross-member denial and duplicate confirmation.
- Actual Claude generation and accounting require an agreed test allowance, an authenticated test account and provider account credit. No allowance is silently invented or enabled.

## Client requirements before the next phase

1. AI allowances: daily and monthly requests plus daily and monthly USD spend per company, including test allowance and whether allowances differ by paid plan. Confirm the Anthropic account has API credit/billing enabled.
2. Customer payments: confirm the payment provider. Anthropic supplies AI, not subscription collection. For Stripe, configure test server credentials and webhook signing secret securely, provide approved prices/currency, billing interval, trial and upgrade/cancellation rules. Never paste keys in messages or commit them.
3. Email capture: approve the receiving-address format/domain and inbound mail provider. Outbound Brevo SMTP alone does not implement incoming email capture. Confirm permitted file inputs and processing limits.
4. Handovers and cover: confirm who requests, approves, receives and ends access, plus leave dates, handback behavior and required notifications.
5. Launch content: provide final Privacy and Terms text and confirm support/hello inbox routing and verified no-reply sender.

These inputs do not block wiring the current AI controls. Agreed allowances are required to activate and perform the paid end-to-end test.
