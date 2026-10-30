# Mobile workspace header — 31 October 2026

The owner requested a professional, compact mobile workspace header, based on the supplied My day screenshot. Reviewed Notion's official sidebar guide and Linear's January 2026 mobile navigation reference. Adapted their emphasis on concise navigation and quick utility access to Vimbre's existing full-screen menu; no new navigation system or backend calls.

- Closed logo/menu row is 60px; the page/utility row is 56px through 1024px.
- Menu has a hamburger/close icon with its existing accessible text, focus trap, Escape handling and Back to website link.
- Mobile page title replaces the duplicated company breadcrumb. The company identity and uploaded logo remain in the opened menu and desktop sidebar.
- Moved company identity CSS out of lazily loaded Settings CSS. Its unconditional display:flex overrode the former mobile hide rule, creating the tall company-name block after Settings loaded.
- Stars, Chat and Notifications keep 44px targets with aligned 20px icons and existing badge/read behavior.
- Mobile chat viewport calculation uses the new 116px chrome height. Normal document scrolling/text selection behavior is preserved.

Verification: production build passed; browser preview of the workspace layout with disposable account/service adapters and actual shared/Settings CSS verified 320px, 360px, 768px and 1366px widths. Phone/tablet header rows measured 60px + 56px; desktop stays unchanged. Opened/closed the full-screen menu and verified Back to website. Physical handset confirmation remains for the owner after refresh. No database or account data changed.
