# One visible workspace entry

Owner clarified that the landing page should not repeat workspace actions in the header and hero, and that the header entry must remain visible on phones. The header retains one Go to workspace link for signed-in users. The mobile CSS rule that hid this link was removed. A compact 100px brand, 44px hamburger menu and compact 44px-high CTA fit 320px screens. Visitor Get started remains visible; Log in is available in the mobile menu rather than crowding the header. Desktop login/navigation behavior is retained.

The hero now has See the walkthrough only. The lower page action is Capture a conversation for signed-in users, linking directly to Capture; visitors see Get started linking to pricing. This supersedes the previous two-button hero instruction in client-hero-structure-20261031.md.

Validation: 286 tests passed, including rendered signed-in/visitor CTA regressions, plus AI/billing type checks and build. Actual LandingPage rendered with signed-in presentation in disposable 320px, 390px and 1366px preview frames. Header workspace entry was visible on phone; mobile menu opened correctly while retaining it. Preview-only files/config removed before release. No database changes, paid calls or real account actions.
