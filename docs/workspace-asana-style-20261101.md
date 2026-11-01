# Workspace styling — 1 November 2026

Owner reference: the supplied Asana dashboard screenshot, image(20261101-015223).png. Apply its compact navigation, clear hierarchy, restrained surfaces and aligned controls to Vimbre. Keep Vimbre's branding and existing feature behavior.

The desktop sidebar is now a full-height, flat navy panel with compact navigation rows, subtle active highlighting, grouped management links and quieter account/utility areas. The header uses small icon controls and a single company label. Existing navigation filtering and company/role access are unchanged.

Phone and tablet use one 64px header containing the menu trigger, brand mark, company label and existing Stars/chat/notification/account items. The menu opens full screen with scroll locking and focus trapping; Escape and Close return focus to the trigger. Desktop collapse preference is retained. Phone chat fills the space below the single header.

My Day retains the approved greeting banner and task section order. Its work panel has white surfaces, light borders, consistent spacing, compact desktop search/filter/view/action controls, restrained menus and clean task rows. Phone fields remain 16px and 44px high. No dummy dashboard widgets, global search, new tasks, paid AI calls or database changes were introduced.

Removed competing workspace gradient/active/sidebar/topbar/card styles from global polish.css; workspace-product.css owns the new treatment. Public pages are unaffected.

Verification: actual AppLayout/MyDay/Chat components were rendered with mock account/RPC data at 320px, 390px, 768px, 1024px and 1363px. No horizontal document overflow at the checked phone/tablet widths. The phone header measured 64px; phone chat measured 780px in an 844px viewport. Menu pointer/keyboard opening, modal/inert state, Escape focus return, desktop collapse/expand and centered Add task/Save were checked. The local HTTP fixture used a test-only randomUUID shim; it and all preview files were removed before release. Existing unit/TypeScript/build checks remain required. This is UI verification with synthetic data, not a real-user database acceptance test.

Release checks: all 299 tests passed across 63 files; frontend, Edge and billing TypeScript checks passed; production build passed. Lint completed with pre-existing warnings.
