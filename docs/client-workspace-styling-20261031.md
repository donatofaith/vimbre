# Workspace styling refinement — 31 October 2026

Owner approved starting the styling recommendations after reviewing the audit. This first pass standardises spacing, readable metadata, responsive controls and editor actions. Keep the previously approved banners and product wording; use Notion/Linear references as navigation/density guidance rather than duplicating their branding.

- Shared workspace stylesheet uses quiet solid cards, consistent borders and 12px corners; removes decorative workspace background gradients. Public landing presentation, desktop/mobile navigation and approved greeting/handover banners remain intact.
- Plain page titles and Settings heading use consistent 28px desktop / 24px phone sizing.
- Settings categories share card/fieldset spacing and Save placement, full-width submit buttons on mobile, wrapping secondary controls and 16px mobile/tablet text fields. Existing permissions and submission behavior are preserved.
- Capture source metadata, dates and small channel labels use at least 12px; relevant action labels use 13px.
- My day mobile toolbar explicitly places search, filter/actions and view controls without horizontal overflow; 44px add/tools targets and compact More filters. Existing filters, counts, tabs and handlers remain unchanged.
- Billing uses 3 columns above 1100px, 2 up to 1100px, and 1 up to 760px, avoiding squeezed narrow-tablet cards. Plans, prices, entitlements and actions are unchanged.
- Role-item and decision editors separate scrolling fields from their fixed Save/Cancel footer. Both retain the same form and FormData ownership; errors stay outside the scroll region. Other dialogs, task editors, print views and handover flows retain their existing structure.

Verification: browser preview with actual CompanySettings, RoleDrawer, ItemForm and DecisionForm; disposable auth/database adapters only. At 320px and 360px, visible 44px Save actions, successful role-contact/decision fixture saves, Cancel, and no toolbar overflow. At 700px pricing stacks, at 1366px three columns. Actual card CSS with representative pricing content checked at these widths. No live account/database changes or AI calls made. Preview-only files/configuration removed before release. Physical handset check remains for owner after refresh.
