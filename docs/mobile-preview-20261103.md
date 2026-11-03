# Mobile preview refinement

The public-site review remains preview-only on preview/public-positioning-20261103. Production and the backend are unchanged.

## Changes

- Compact 64px phone header, restrained menu control and readable Log in/Get started links.
- Mobile headline 30–38px, with navy fixed text and blue rotating word. Exact definition is preserved at 14–15px with 1.65 line height; the former 18px !important mobile rule no longer controls this hero.
- Three account choices form a single segmented row at 320px and above.
- Main hero CTA spans the content width; the secondary tour link is centred below it.
- Less vertical space before the app preview; the hero's screenshot window is cropped to 360px height while the tour retains the complete screenshot.
- Mobile section spacing, integration rows, FAQ text and walkthrough tabs are aligned with the compact hero.

## Checks

Build, lint and 386 unit tests pass (lint has existing warnings). The longest headline and single-row controls were checked at 320/390/768/1024/1440/1920px. All other public/account routes were checked at 320 and 390px: no horizontal overflow or app console errors observed.

## Client access

The owner explicitly requested a client-shareable Vercel preview without Vercel login. Use a deployment-scoped share link, not a global change to project protection. It does not promote the site. Future client links can be copied from the preview deployment's Share controls in Vercel.

Existing review limitations in public-preview-20261103.md are unchanged by this styling update.

Files: src/features/public/public-pages.css and this note. No files deleted.
