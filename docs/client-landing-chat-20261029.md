# Landing, role selector and chat corrections

Client request supersedes the old public AI explanation, per-person pricing and tool availability badges. Remove that section and the Live badges, reuse the existing integration vector marks with accessible names, remove per-person prices, and use AI usage control. Preserve actual company prices and allowances; explain paid tiers through their real team and AI capacity rather than inventing premium features.

Replace the outdated folding-task animation and screenshot walkthrough with an explicitly labelled sample of the current Capture workflow: pasted text, task/decision draft review, Accept/Edit/Dismiss, Save drafts, then handover Details/Include/Draft/Send and Submit to manager. The example is an illustration, not customer data or a claim of automatically approved handovers. Retain the 10-second loop, pause, visibility suspension and reduced-motion fallback. Both hero and scroll/mobile walkthrough share the same presentation.

My role's Viewing selector shows holder names only. Stored job descriptions, roles and permission checks are unchanged.

The new-chat dialog shared `chat-new` with the 44px plus button. Give the dialog its own class so its content and buttons fit; keep the plus button compact. Pass the company creator into this presentation component for role labelling; chat RPC authorization is unchanged.

Chat receipt refreshes no longer scroll repeatedly when no message arrived, and new messages do not interrupt an active text selection or someone reading history. Scroll only the message container, not its workspace ancestors. Keep native text selection and add a Copy action using clipboard write with an accessible failure fallback. No clipboard reads. Paxa is a separate application and has not been inspected or changed.

Validation: 228 unit tests across 46 files, including receipt-only refresh, new-message following, history reading and selection preservation. TypeScript/production build and prerender passed. Lint has no errors (existing unrelated warnings remain). Public desktop/mobile preview inspected; real NewChat component tested with isolated mock chat RPC responses at 320px: open, select teammate, enabled Create chat, completion; dialog had no internal horizontal overflow. No production messages or paid AI calls. Native Android long-press and the separate Paxa password issue still require device/project verification.
