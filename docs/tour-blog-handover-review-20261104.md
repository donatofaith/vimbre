# Tour, blog and handover controls — 4 November 2026

Tour links now target the existing #product-demo on the landing page. An explicit click starts from Conversations and plays the six configured steps, with Play/Pause and Restart controls beside the preview. Reduced-motion users do not get automatic motion but can explicitly play. Completed user-started cycles retain the tour_complete analytics event. /tour is a legacy redirect to /#product-demo; it is no longer listed in the sitemap or prerendered as a separate tour page. No files deleted.

Removed the shared promotional signup section containing Get started with Vimbre from all six blog articles; article content, downloads, related guides and header navigation remain.

Handover Delete draft is now a rounded red button with a trash icon inside the handover card footer. Undo is a styled secondary button in a recovery status banner. Both use the shared button styles, have 44px targets on mobile, and disable while a draft action is running. Existing soft-delete/restore RPCs and authorization remain unchanged. QA uses fictional local fixtures, with no customer records changed.

Verification: 389 tests, lint (existing warnings), TypeScript and production build; six-width delete/restore and layout checks; landing anchor/playback and legacy route checks; all six prerendered blog articles checked for the removed CTA. No backend migration or function deployment.
