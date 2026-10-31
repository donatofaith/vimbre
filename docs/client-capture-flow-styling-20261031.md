# Capture correction and second styling pass — 31 October 2026

Owner reported that Add manually appeared to archive a capture, reopening/editing was unclear, and mobile buttons in Capture/template selection were poorly arranged. Requested continuing the styling pass.

Read-only inspection of installed private.capture_workspace and private.capture_change confirmed: create does not archive; archived captures remain owner-readable via detail; restore is required before editing; confirmed sources are immutable. No database changes are needed for this correction.

## Behavior

- Add manually validates nonblank source text, saves the source, then opens a manual task/decision draft. The new form says Add draft; the draft is still reviewed and explicitly saved from Check drafts. No automatic archive, confirmation, or AI call added.
- Manual entry uses the existing request guard; saved captures switch to review when adding another draft. Archived captures cannot invoke manual entry from the error fallback.
- Added Save source for unconfirmed captures; a typo can be corrected without running AI. Source editing is disabled during queued drafting; confirmed-source immutability remains and is explained in place.
- Opening a capture scrolls to its content rather than keeping the user down at the history list.
- Archive errors retain the selected capture and show an error. Successful archive selects Archived history. Restore keeps that capture open and editable instead of closing it. Existing tenant/owner checks are unchanged.

## Styling

- Capture primary/manual buttons are adjacent on desktop and full-width stacked on phones, with usage information on a separate line.
- History tabs form a single horizontally scrollable row with an underline selection, avoiding the lone Archived tab wrapping to another line.
- Capture draft dialogs scroll fields independently from the fixed Add draft/Accept, Dismiss and Cancel actions, with 44px mobile targets.
- Template Add task/Edit/Delete share one compact grid row on a 320px phone, retaining 44px tap height. Edit and Delete remain owner-restricted.
- Consistent role metadata/handover row spacing and a compact mobile support conversation heading. Approved banners, product copy, permissions, billing limits, and business workflows remain intact.

## Verification

Browser preview used actual CapturePage, CaptureDraftCard, RoleDrawer and TemplatePicker with disposable auth/database adapters. No live captures, messages, users or paid AI requests were created. Verified blank source is disabled; manual editor opens; cancel retains source; source correction saves; archive/reopen requires restore; restoring keeps source editable; failed archive keeps source visible; manual draft -> Save 1 draft -> Saved with Open task. Verified Capture fixed actions visible at 360x760, all 44px high; template actions share the same row at 320px, all 44px high. Also rendered 768px and 1366px preview frames. Temporary mock files and preview-only Vite configuration removed before release.
