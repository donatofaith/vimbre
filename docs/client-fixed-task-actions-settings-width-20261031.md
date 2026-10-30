# Fixed task actions and Settings width — 31 October 2026

Client screenshots show the task detail screen scrolled below its Edit action, and Settings constrained by legacy layout rules. This supersedes the initial task-view action positioning and narrow Settings caps.

Task viewer and editor now use the same 880px dialog shell with a fixed header, separately scrolling body and fixed footer. The viewer retains Record and Edit task in its footer (Restore for deleted tasks). Edit retains Cancel, Delete and Save changes in its footer. No duplicate Delete in the viewer. Save/Delete are accessible without scrolling to the form bottom; 44px action targets and viewport-bound geometry apply on mobile. Existing unsaved-change, repeat-delete, permission and save/delete success handling remain.

Settings fills the available workspace up to 1440px, with a 240/200px desktop category column and flexible content. Removed obsolete 1000px layout / 650px form constraints from handover.css; selected cards no longer inherit old 640/760px caps. Company fields use two columns when space permits and one column on smaller screens. Mobile uses a labelled native category selector instead of a large button grid. Only the selected category mounts.

Verification uses the actual TaskCard, TaskTools, TaskPanel and CompanySettings with disposable auth/data adapters and all shared CSS. Desktop and 360x640 checks include long task details, expanded comments, equal 880px view/edit width, expanded edit options, last-field edits, 44px visible Save action and successful save callback. Settings company/integrations views and mobile category switching checked. Mock adapters and preview files are removed before release. No real tasks, logos, integrations or database settings changed for testing.
