# Landing repositioning, 20 October 2026

Source: the founder's Vimbre Landing Page Build Brief, pasted by the owner on 20 October. It supersedes previous landing copy and the copyright-only footer instruction. Workspace client instructions are unchanged.

## Prepared implementation

Eleven-section composition, supplied copy and official colour assets. Contact remains an inline section directly above the footer, preserving the owner's separate contact requirement. One H1; five accessible FAQ buttons; real HTML decision and cover examples; supplied font packages limited to Latin, with heading font preload. Public hero tracking follows this brief's specific -0.025em instruction; workspace heading tokens stay at -0.01em.

The Motion dependency is pinned to 12.23.24 with exact transitive versions from the upstream release manifests. Its code is dynamically imported after two paint opportunities. One hero sequence repeats three times, pauses below 40 percent visibility and on hidden tabs, supports a manual pause control and restores the static final frame. Mobile drops path dots and the Daily notes card. Reduced motion skips the animation import. Desktop problem cards scrub across 60 percent viewport height; mobile uses static cards and section reveals. CSS handles the header, accordion and buttons.

Production build prerenders the pure landing component using Vite SSR and React server rendering, without Auth or database access. Full copy, final hero frame, FAQ answers and matching JSON LD are written into dist/index.html. FAQ schema is derived from the same content as its visible answers; price ranges derive from the same plans. Home navigation remains session aware after client initialization. The existing branded splash remains, including its no-JavaScript fallback.

## Publication gate required by brief section 12

Do not promote to development until the owner resolves the launch details below. The draft is not a completed launch.

1. Brand Guidelines, the authoritative brand token file and reverse logo are absent from the repository. Reuse the existing tokens and original colour SVGs on a white footer surface temporarily. Do not redraw or recolour a reverse logo.
2. Founder must approve the exact current input wording. Existing app supports manually entered/pasted notes and decisions, document web links; forwarding, file upload and AI drafting are not implemented. Tools diagram currently shows Notes only. The requested illustrative source and cover story is tagged Example; complete handover and cover workflows remain unfinished, so all broad marketing copy needs founder review before public release.
3. No free trial is confirmed. Keep Get started.
4. Existing plan names/prices are preserved. Feature lists contain only implemented decisions, tasks, role records and team chat. Same features are repeated honestly for each capacity tier; founder must approve entitlements and feature availability. Billing and plan enforcement are not implemented.
5. support@vimbre.com and hello@vimbre.com are already approved contact routes. Privacy and Terms documents are not supplied, so no dead legal links are published. Confirm legal company name/location from the brief.
6. No security/data-location claims are added. Existing infrastructure is not evidence of a compliance claim.
7. Supplied social sharing image vimbre-og-image-1200.png is missing. Add the real 1200px PNG before enabling its og:image metadata.
8. Verify the custom-domain permanent redirect, canonical deployment and production Lighthouse targets after publication. No Cloudflare/Vercel account changes are made here.

## Checks

Run npm run check and npm run test:browser, including the new production-preview landing suite. The landing suite checks built HTML without JavaScript, H1 count, schema/FAQ equality, banned copy, responsive widths, FAQ keyboard use, reduced motion and whole-story pause/offscreen behavior. These checks do not establish deployed Lighthouse scores or actual domain redirects.
