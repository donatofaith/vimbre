# Workspace visual correction — 1 November 2026

The owner approves the compact workspace styling but requests the glass sidebar back, visible page headings and centered popup forms. This supersedes the earlier instruction to hide repeated route headings. Keep feature behavior and the approved My Day greeting intact.

Restored a translucent navy sidebar gradient, blur and subtle highlight on desktop and the mobile menu. The compact layout, active navigation, role filtering and menu focus handling remain. Removed the shared rule that visually hid content h1 headings and the associated heading-spacing suppression. Departments also loses its explicit screen-reader-only heading class. Chat retains its accessible-only page title because the conversation header remains the visible title.

Shared RoleDrawer dialogs now use fixed viewport insets and auto margins instead of percentage positioning plus a transform. Workspace visibility/notification dialogs use the same explicit centering. Existing feature sizes, scrolling fields and action footers remain. Chat and cookie dialogs already use this geometry and are unchanged. Inline page forms remain inline.

Browser verification used actual AppLayout, MyDayPage, TaskPanel, RulesPanel, PlanMyDay, AssignmentPanel, WeeklySummaryPage and HandoversPage with synthetic auth/RPC data. Capture/role-editor and native-dialog samples checked their real shared CSS structure. No production writes or AI calls were made. Across 360×800, 768×900 and 1440×900, ten dialog variants (Add task, Edit task, Rules, planning, assignment, Capture, role edit, visibility, chat, cookies) passed horizontal/vertical center, viewport bounds and horizontal-overflow checks: center deviation <=0.01px. Applicable task/assignment/record/Capture footers remained inside the dialog. This is layout verification, not end-to-end verification of every underlying business action.

Weekly summary and Handovers headings were checked on phone/tablet and desktop with no clipping. Phone glass gradient and blur were verified in computed styles after resolving an older mobile background override. Temporary fixtures and Vite preview configuration were removed before release.

Release validation: npm run check passed all 299 tests across 63 files, lint, frontend/AI/billing TypeScript checks and the production build. Existing lint warnings remain. git diff --check passed.
