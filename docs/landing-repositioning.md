# Landing repositioning, 20 October 2026

Source: the founder's Vimbre Landing Page Build Brief, pasted by the owner on 20 October. It supersedes old landing copy and the copyright-only footer instruction. Workspace client instructions are unchanged.

## Publication authorization

The owner explicitly requests completion and states that the client approved on 20 October 2026. This supersedes the earlier draft-only hold. Publish the tested homepage. Do not request approval again.

## Implementation

Uses the supplied wording, eleven-section composition, original colour logo assets and existing brand tokens. Contact stays directly above the footer, as separately requested. One H1; real HTML decision and cover examples; Example labels; five accessible FAQ buttons. Public hero tracking follows the specific -0.025em instruction; workspace tokens remain -0.01em.

Motion 12.23.24 is dynamically imported after two paint opportunities. One orchestrated hero sequence loops three times, pauses below 40 percent visibility and on hidden tabs, supports a keyboard pause button and restores the static final frame when finished. Mobile drops path dots and Daily notes. Reduced motion skips the module. Desktop problem cards scrub across 60 percent viewport height. Section reveals play once. Header, hover and accordion use CSS.

Production build prerenders the pure landing component with Vite SSR/React server rendering, without Auth or database access. Full text, final hero frame, FAQ answers and JSON LD are in dist/index.html. FAQ schema and visible answers share content; price schema derives from the pricing cards. The homepage component loads eagerly to preserve that initial content during React startup. The branded splash can finish from prerendered HTML. Fonts are self-hosted Latin variable files with swap and a heading preload.

Added a 1200 by 630 PNG share image generated from the exact official SVGs, self-hosted fonts and approved hero wording. Open Graph/Twitter image metadata, canonical, robots, sitemap and llms files are present. Vercel configuration prepares 301 redirects for both .co.uk hosts, preserving the path.

## Capability and content choices

Keep Get started because no free-trial offer has been supplied. Preserve Starter £29, Growth £99, Business £249 and Enterprise Custom capacities. Feature lists contain implemented decision records, tasks/dates, role records and team chat. Billing and tier enforcement are not implemented. Notes is the verified input shown in the tools diagram. Forwarding, file uploads, AI drafting and complete cover/handover workflows remain unfinished; illustrative scenes do not change product implementation. Do not invent security or data-location claims.

support@vimbre.com and hello@vimbre.com are the owner-approved contact routes.

## Materials still absent

The original reverse logo, Brand Guidelines and separate authoritative brand token file have not been supplied/found. Keep the exact colour SVG on a light footer surface; do not redraw or recolour it.

The client's Privacy and Terms text has not been supplied. Content-driven /privacy and /terms routes are prepared, with document types and one legal-content.ts source. Empty documents render Page not found and create no footer links; they are never presented as legal policies. Insert the actual approved documents to publish those pages and links.

## Verification

Run npm run check and npm run test:browser. Seven browser suites cover production raw HTML/schema, no-JavaScript rendering, FAQ text/keyboard parity, banned copy, responsive widths, reduced motion, hero pause/offscreen behavior, three iterations and static final-frame restoration, the social PNG dimensions and existing workspace behavior.

Production CI runs scripts/audit-public.cjs to record actual custom-domain status/redirects and pinned Lighthouse 13.0.1 results against the deployed Vercel homepage. Report actual scores, not target scores. A laboratory Lighthouse run does not establish field INP or guarantee every real device's performance. Missing brand/legal files and inaccessible DNS controls cannot be resolved through approval alone.



## Founder revision received 21 October 2026

The owner supplies Pasted text(7).txt and screenshots of misaligned connector paths. This revision supersedes the previous decision-record lead and old 8.6-second tile animation. Use the new situation headline, daily loop, Week 1/4/12 role-record visual, Employees/Managers audience cards, six FAQs including Notion/ClickUp/Trello, and updated search/social copy. The supplied hero headline plus main line is 30 words; the exact additional small line and CTA labels take the total beyond 35. Preserve the explicitly supplied copy rather than silently deleting it. At a 5/7 column split the complete 56px headline cannot fit three lines; validate readable wrapping instead of clipping it.

Use one 13.2-second desktop product window, 9 seconds on mobile, two plays and a static final cover frame, following the revised scene-specific playback rule rather than the stale three-loop checklist. The window uses the existing BrandLogo, Card, Button and WorkspaceIcon components with isolated sample data. It never submits data or reads an inbox. The AI scene keeps the required check-before-saving label and a Coming soon status because AI is not implemented. Notes is the only verified tools input: one line now connects it to the supplied mark using a shared layout and non-letterboxed SVG coordinates. No floating endpoint paths remain in the hero.

Forwarding remains absent so step 01 uses the brief's paste-only alternative. No HR audience card is shown because role readiness is not implemented. Founder-supplied FAQ wording is preserved, including its planned coverage description; this does not implement cover or readiness. Actual handovers, role readiness, AI drafting and one-click completed-task context still require product implementation before a customer launch. Get started, prices and implemented-only plan features remain. Reverse logo, actual legal text and Brand Guidelines remain absent.

Use the updated browser suite to check six FAQs/schema parity, final-frame/no-JS rendering, exactly one hero Example label, anonymous CTAs, one attached Notes connector, mobile content fit, two complete playback loops, pause/offscreen behavior and existing workspace regressions. Store sample-only screenshots as short-lived CI artifacts for visual inspection. Production audit reports measured scores, not guarantees.
