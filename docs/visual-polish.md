# Vimbre visual polish — 26 October 2026

Owner scope: refine presentation across the public website and customer workspace. Preserve the approved wording, page composition, navigation, forms, permissions, provider connections, task behaviour and feature flags. Console work is separate.

## Presentation

A shared CSS layer adds a restrained blue ambient background, consistent glass edges and shadows, clearer fields and primary/secondary buttons, and coordinated surfaces for account pages, Capture, My role, Handovers, Support and Settings. Landing cards, pricing, contact surfaces and the hero demo use the same materials. The featured plan remains visually distinct.

Header and selected main panels use bounded backdrop blur with opaque fallbacks. Text-heavy repeated cards keep strong contrast. No new JavaScript dependency, continuous blurred animation or hidden-text entrance was introduced. The greeting moves into place once and its underline expands briefly. Reduced motion disables both, and reduced transparency uses opaque panels. Existing print/export rules remain.

Dark My day and My role banners retain white headings. Support keeps its approved heading colour. Landing demo text inside white cards uses dark text even when the surrounding section uses pale text. Existing client wording and screenshots remain the review baseline.

## Verification

Local lint, 136 unit tests, application/Edge type checks and production build pass. Browser checks run against intercepted fixtures, with no real provider requests, email, AI calls or customer writes. Desktop, phone and tablet screenshots are reviewed. The browser matrix covers 320–1920px, with eleven WebKit touch configurations. Greeting and role title contrast have explicit browser assertions.

Source ae52241e6cf4a48bcfdd1666b93a97daedd6d166 passed GitHub Actions run 40251671939: all 136 unit tests, lint, type checks, production build and all 13 Chromium/WebKit browser suites. Final My day, My role, Support desktop/mobile screenshots were reviewed after restoring dark-banner title contrast. Landing, Capture, role, handover, account and Settings visual/layout checks pass. The release adds this record only; application source remains the tested revision.
