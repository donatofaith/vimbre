# Vimbre AI features

All AI requests use the authenticated ai-run gateway. Company identity comes from the protected profile. Model routing and daily/monthly request and USD limits are enforced server side. The approved allowances live in ai_limits and are already enabled; see docs/ai-gateway.md. Manual forms remain available when AI fails or an allowance is reached.

## Available

- Capture extracts decisions, tasks and external contacts into private draft review. Nothing is confirmed by the model.
- My role has a dedicated structured task for each of the six tabs: responsibilities, open work, external contacts, documents, recurring deadlines and decisions. Parsed output contains only the editable fields for that tab. Review draft opens the normal form with those fields filled, and Save is still required. Remaining suggestions stay available during this page session.
- Documents accept a pasted link with notes, PDF or plain text for AI drafting. PDFs up to 2 MB are supplied directly to the model after explicit Generate drafts; no server fetch of user supplied URLs is allowed. Token counting rejects documents over the gateway input bound before a paid request. The original selected file is retained for the normal private document upload on Save. Other supported upload formats remain available through the manual form. Pasted links are not fetched or described as read.
- Recurring deadlines use the user's local reference date to suggest the next due date and repeat rule. The user must check both; missing or ambiguous dates remain blank. Existing due date rows feed My day.
- My day drafts tasks from pasted email or notes and opens the task editor with title, details and due date. Each task requires Save task.
- Team setup drafts responsibility context from a job title or description. The reviewed text fills the invitation/member form and is saved only by Send invitation or Save member. It does not silently create responsibilities.
- Weekly summaries and handover summaries use the signed-in person's explicit selection of current role records or pasted notes. Private Capture originals, pending Capture drafts, private responsibility notes and document content are never loaded by that context helper. Handover summary is editable and can be copied; approval, publication and temporary cover access remain separate unfinished workflows.
- Shared draft review wording: Draft from Vimbre AI. Check before saving.

## Email forwarding

The capture-inbound receiver and private, idempotent receipt boundary are implemented. Real receiving remains disabled until the operator configures and verifies Brevo, the receiving subdomain and CAPTURE_INBOUND_TOKEN, then provisions verified owner addresses. No address is invented or exposed as working before that. See docs/inbound-email.md.

## Verification

Run npm run check and npm run test:browser in GitHub Actions. The structured draft browser suite verifies review before Save, task extraction, date/field prefills, quota errors, manual fallback and owner-scoped context. Supabase SQL tests combine team-fixtures.sql with structured-role-ai.sql and roll back every fixture. Mocked tests never contact Claude or send mail. Real Claude account credit/model acceptance and real inbound delivery need an operator acceptance check.
