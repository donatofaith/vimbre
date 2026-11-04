# Public website review — preview only

This release is for a Vercel preview. Do not merge or promote it automatically. The previous production branch and Supabase backend remain unchanged.

## Implemented

- Exact requested definition in the first 100 words, homepage description and SoftwareApplication description. One H1 includes the full visually hidden sentence; animated text is hidden from assistive technology. Hero word and screenshot share the same state; pause and reduced motion are supported.
- One Log in and one Get started link in the visitor header, including mobile. Updated account copy and account-type links.
- Pricing, FAQ, how-it-works, integrations, three use-case pages and individual/founder/company pages. Plain-text Vimbre in brief and crawlable server-rendered HTML. Native FAQ details work without JavaScript.
- Organization, WebSite, SoftwareApplication and real FAQPage JSON-LD. Plan prices and features share the visible pricing source. Enterprise remains custom, without an invented numeric price. No ratings or reviews.
- Canonicals, page-specific titles/descriptions, sitemap, llms.txt, and a 1200 × 630 Open Graph/Twitter image. Public crawling is allowed; private account/workspace routes stay excluded.
- Six-step, signup-free product tour and walkthrough from walkthrough.config.ts. Twelve current-app screenshots use only fictional Demo workspace records.
- Consented dataLayer events: cta_click, account_type_selected, hero_role_selected, hero_demo_run, tour_start, tour_complete, walkthrough_view and faq_open. Signup includes email method and account_type, uses the existing single-use server receipt, and cannot fire from a button or ordinary page load. GTM is responsible for downstream conversion delivery; direct Ads conversion invocation is removed to avoid a second conversion path.
- Local-only Demo workspace adapter reuses the actual app components and sign-in state. It never seeds customer tables or calls a paid AI provider. Its entry is not included in the production build.

## Verification

- Lint completes with pre-existing warnings; no lint errors.
- Unit tests, application/AI/billing type checks and production build run locally; final counts recorded in the PR.
- Browser checks cover all 14 reviewed routes at 320, 390, 768, 1024, 1440 and 1920 widths: one H1, no horizontal overflow. No app console errors observed.
- Google Rich Results Test code input: one valid SoftwareApplication item; non-critical notices. Result: https://search.google.com/test/rich-results/result?id=recPoU9BriV5v7pr04Bk-A . No rating/review data was added.
- Static output contains meaningful text, canonical metadata and schema without executing JavaScript. Account pages are prerendered as well.

## Incomplete acceptance checks / TODOs

1. Native 2× walkthrough captures are not available. Full-resolution browser export repeatedly timed out; the standalone Playwright browser download failed. The preview uses standard browser screenshots, with the 1× image as a transparent 2× fallback. No upscaled image is passed off as a native high-density capture. Desktop exports are at the browser's available size (mostly 1363 × 936), rather than all being 1440 × 900. Mobile crops are 390 × 844. Run the capture command below in a working local Playwright environment before treating the capture-size requirement as passed.
2. Automated pixel/screenshot assertions were added but the standalone Playwright suite could not run here because the browser installation failed. Live browser geometry checks at all six widths passed; they are not a claim that pixel baselines passed.
3. No verified improvement to AI generation latency is included. The existing smaller-model route and record permission checks are retained; no live model, gateway, database or allowance change is made by this public-site preview. A speed-up should be benchmarked against real retrieval/generation timings separately.
4. The code emits the requested events, but the external GTM/GA/Ads container configuration was not changed or inspected. Verify in GTM Preview that only sign_up feeds conversion tags/key events.
5. Yahoo Mail's direct connection is not shipped. It is identified as pasted-text only; the other seven tools remain subject to provider configuration and company permission.
6. No additional banned-word list was supplied in this brief. The existing documented copy restrictions were followed. No copy placeholders or TODO text appear in the product.
7. The Google check used code input. Repeat URL testing after production publication; a protected preview may not be reachable by Google.

## Repeatable captures

Start the development server, then run:

```sh
WALKTHROUGH_BASE_URL=http://localhost:5173 npm run walkthrough:capture
```

The command signs into the isolated Demo workspace, visits every configured step, captures desktop 1440 × 900 and mobile 390 × 844 at device scale factors 1 and 2, and updates lastVerified only when every step succeeds. Install the project-matched Chromium with `npx playwright install chromium` first. The capture command is deliberately restricted to a local development host, so it cannot accidentally photograph customer workspaces.

To run public screenshot checks against a deployed review build:

```sh
PUBLIC_PREVIEW_URL=https://YOUR-PREVIEW.vercel.app npm run test:public
```

The PR template requires recapture whenever a walkthrough app page changes.

## Promotion

In Vercel, open the completed preview deployment and choose **Promote to Production** after review. Vercel may rebuild it with production environment variables. This release needs no database migration or Supabase function deployment. Keep the production Git branch aligned before the next normal production push, so a later push cannot replace the approved site with older source.

## Files changed

Public pages: `LandingPage.tsx`, `LandingHeader.tsx`, `HeroHeadline.tsx`, `landing-content.ts`, `public-content.ts`, `PublicFrame.tsx`, `PublicSections.tsx`, `PublicPage.tsx`, `Walkthrough.tsx`, `walkthrough.config.ts`, `public-pages.css`, `marketing-analytics.ts`, `prerender.tsx`, `App.tsx`, `index.html`, `vercel.json`.

Accounts/tracking: `AuthPage.tsx`, `AuthProvider.tsx`, `signup-analytics.ts`, `analytics.ts`, analytics tests. Tiny-header fit: `people.css` and generated theme coverage.

Build/verification: `package.json`, `scripts/prerender.mjs`, `scripts/walkthrough-capture.mjs`, `scripts/check-public-preview.mjs`, `scripts/build-social-image.py`, public-content/hero/header tests, marketing event tests, PR template, this review note.

Assets: `public/llms.txt`, `public/sitemap.xml`, `public/vimbre-work-context-og-1200.png`, twelve `public/walkthrough/*.png` screenshots. Local capture source: `demo/index.html`, `demo/main.tsx`.

No files deleted.
