# Client landing, pricing and motion checklist

Source: the owner supplied the client change list directly on 28 October 2026. This resolves the earlier inability to retrieve that message. Keep the owner's centered information and centered hero demo, plain copy and avoidance of repeated context sections. The supplied checklist explicitly reinstates How it works, a short AI explanation, tools row and final CTA.

## Acceptance

| Client item | Implementation |
| --- | --- |
| AI limit: nothing breaks; drafting pauses; other work continues | Existing FAQ retained; compact AI note states manual work, records and tasks continue |
| One memorable ten second hero loop | Email thread, three extracted actions, review tick, same action rows folding into a handover sheet |
| Three owners/dates, Check before saving, What comes first | Actual My Day TaskCard rows with fictional owners/dates, animated review stamp, final sheet heading |
| One easing, about 500 ms, 60 ms stagger | Shared cubic bezier .22/1/.36/1; .5 second transitions; .06 stagger; no bounce |
| Pin one changing product screen through four steps | Single sticky screen, four scroll positions; desktop and phone layouts; stable reserved screen dimensions |
| Bring it in, Vimbre AI drafts, You check, Handover | Exact step labels |
| Real product screens, personal data blurred | Screens captured from the actual Capture/Handover UI with intercepted fictional records. Capture identity metadata blurred. No customer content, model call or provider read |
| Motion only transform/opacity, no layout shifts | Hero and screen animation use only transform/opacity. Fixed hero and pinned screen dimensions, screenshot dimensions supplied. FAQ layout transition removed |
| Reduced motion, pause/play, offscreen pause | Static meaningful email source frame with reduced motion/no JS; playback controls and offscreen gating retained |
| 2 px hover lift, press state, visible focus | Existing scoped controls retained, clear focus outline and pressed transform |
| Correct live tools claim | Public capabilities checked: Gmail, Drive, Outlook, Teams, Slack and Trello configured=true. All labelled Live, with company permission/account setup note |
| One main hero CTA, one quiet link | Start free trial to /signup, See the walkthrough to demo |
| Plain headline/supporting copy; demo below | Latest owner copy and centered layout retained |
| Date format, stale example removed | Readable November 2026 hero dates; screenshot identity/date metadata blurred where appropriate; no old 12/10/2026 |
| Nothing blank on first view | Prerendered headline, source frame, pricing and content; no reveal hiding |
| Merge context sections | One How it works story owns source/draft/review/handover; no extra workspace, cover or source sections |
| Short AI does/does not explanation | One compact note; explicit user request/review, no automatic confirmation; accurate separately opted-in Watch exception |
| Row of tools labelled truthfully | Six Live labels in one row; no invented coming soon labels for configured providers |
| Start free trial path and bottom CTA | Hero, plans and final section point to signup/workspace as appropriate |
| Pricing and value calculator | Existing prices/allowances retained; correct Starter/Growth/Business/Enterprise visual order; company and full-capacity per person prices; visitor-input calculator |

## Product limits

This is a landing release. Proposed paid subscriptions/checkout, per-plan connector caps, guaranteed retention, SSO and audit export are still disclosed as unavailable. A configured OAuth provider does not imply every customer or IT administrator has granted account consent. Optional Watch can prepare private drafts only after separate opt-in; no copy promises it cannot run under that opt-in.

## Validation

203 unit tests, lint, app/Edge TypeScript and production build pass. Focused browser acceptance covers the provided checklist, all four pinned screen states and actual assets, signature story stages, pause/resume and offscreen pause, copy, primary/quiet CTAs, final CTA, live labels, pricing math/order, calculator, scroll/navigation, fourteen widths, mobile menu, reduced motion and no JavaScript. Desktop/phone screenshots and actual product captures inspected. No GitHub Actions minutes or paid AI calls used.
