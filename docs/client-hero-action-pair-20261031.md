# Restore paired hero actions

Owner requested restoring Go to workspace beside See the walkthrough in the landing hero. This supersedes the hero-action removal in client-mobile-workspace-cta-20261031.md. Signed-in header and hero consistently say Go to workspace and link to /app. Visitors retain Get started linking to /signup. The header shortcut remains visible on phones; the lower Capture action is unchanged.

Reference: Notion's public product page repeats Get Notion free in navigation and pairs it with Request a demo in the hero (https://www.notion.com/product/notion). Linear retains app/login/signup navigation (https://linear.app/). These informed action hierarchy, not a copied site design.

Phone hero actions share one row with 44px minimum touch height, compact text/padding, no decorative arrows, and the old minimum button width explicitly cleared. Actual LandingPage signed-in preview inspected at 320px, 390px and desktop widths. 286 tests passed, including the updated signed-in header/hero consistency and visitor regression. Type checks and final build passed. Preview files removed before release. No database changes.
