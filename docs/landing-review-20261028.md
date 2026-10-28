# Landing page client review, 28 October 2026

Integrates PR 9 onto development 0cafb6af56750c8ab0dd840d99f1f4ec695df920. Only public landing files, their tests and this document change; workspace, legal content and backend remain from production.

Fixes the higher-specificity flex rule that stacked the desktop hero. Explicit grid layout keeps the product beside concise copy; mobile stacks with smaller typography. Preserves the automatic ten-second story, pause control, reduced-motion and no-script source frame. Hero action rows use the actual My Day TaskCard component with fictional data, disabled controls and no-op handlers; no customer data, provider request or model call is used. Remaining story panels are clearly labelled examples rather than screenshots of customer work.

Uses available connector labels, company permission/account consent wording, a card-free trial CTA and the client's four steps. Sections remain readable before intersection observers run. Scroll-screen selection retains all visible observer entries to prevent selecting a stale step. Motion progress uses transform, not width. Retains the deployed shared control/card sizing.

AI request ceilings were read from live public.ai_limits: Starter 500/month and 40/day; Growth 3,000/month and 200/day; Business 15,000/month and 1,000/day. Existing spend safeguards can pause AI sooner. These count AI requests across tools, not generated task cards. Pricing states proposed company bundles; checkout/paid subscriptions, per-plan connector caps, retention guarantees, SSO and audit export are not presented as delivered features. All tiers share existing manager/cover/privacy controls. Calculator uses only visitor inputs and rejects invalid/non-finite totals.

Verification: 203 tests in 39 files, lint, frontend/Edge TypeScript, production build and prerender generation passed. Chromium browser checks pass for first-screen layout, actual task rows, signup links, dates, calculator, all seven story scenes, continuous loops, pause/resume, reduced motion, no JavaScript and 14 viewport widths. Desktop and phone full-page screenshots were reviewed. Corrected the runtime page title and made the playback test return the hero to view after the browser scrolls its control; offscreen playback remains paused. No GitHub Actions run or paid AI request was made.

Release scope: public landing files and runtime homepage title only. No backend plan entitlements, retention or SSO functionality is added by this release.

## Owner correction after live review

The owner rejected the side by side hero. This supersedes that layout: centered information first, then the wide centered automated dashboard, then the remaining sections. Restore the 22 October composition while retaining current product behavior. Keep plain, short copy; no generic marketing terms, dashes or hyphens in visible copy, unsupported claims or invented popularity. Removed the Most popular claim, vague headings and full picture wording. Walkthrough link targets the demo.

Build and lint pass. Chromium acceptance passes at fourteen widths with explicit centered copy/demo geometry, no banned terms or dashes, animation pause/resume and all scenes, reduced motion, no JavaScript, FAQ, date filtering and calculator. Desktop and phone screenshots reviewed. The owner will assess the remaining scrolling concerns after this correction.

## Remove repetition and explain Vimbre immediately

Owner requests plain opening copy explaining tasks, decisions and handovers at first glance. Keep the centered hero and automated demo. Remove the separate sources, workspace, AI control and four step sections, plus the repeated final sales pitch. Keep one interactive handover example, pricing/calculator, six FAQs covering additional practical questions, contact and legal links. Header/footer links target retained sections. The hero explains review before saving once; FAQs retain the distinct optional Watch and privacy details.

Production build/type checks, lint and focused Chromium acceptance pass: fourteen widths, centered layout, removed sections, valid navigation targets, plain copy guard, dates, pricing calculator, all hero scenes, pause/resume, reduced motion and no JavaScript. Desktop and phone screenshots reviewed. No paid AI calls or GitHub Actions runs requested.
