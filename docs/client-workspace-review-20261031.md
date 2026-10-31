# Workspace review — 31 October 2026

Department creation is behind a compact Add control; duplicate workspace page labels are visually hidden while accessible headings remain. My day's greeting is retained. Pending captured decisions have a separate review group, a version-checked review comment and an explicit Add to record action. Task drafts, incoming assignments and waiting-on-others statuses remain distinct. Review comments are retained in the captured item and displayed with saved Capture results; this is not a new shared decision-comment permission.

Multi-person and department assignment uses individual acceptance requests, deduplicates overlapping recipients, validates every source and recipient before writing, and uses stable request IDs to prevent retry duplicates. Shared notes are entered explicitly; original private task notes and source are not copied. Existing Super admin and manager/report permissions are preserved. Automatic approval review rejected expanding assignment permission to every employee; that expansion is excluded pending explicit approval. This is a request per recipient, not one jointly owned task.

Stars now separates lifetime qualifying completed-task levels from weighted weekly star points. Starter/Steady/Sharp/Trusted/Anchor thresholds are 0/10/25/40/60 qualifying tasks. It displays current/next badge, remaining tasks and progress. Kudos is labelled Cheer up a teammate. Details moved into Stars terms. Competition consent and visibility are unchanged.

Native chat selection is constrained to the message where it began; navigation and message controls are not selectable. No Copy button was added. Browser verification copied exactly one message and excluded the other message and composer. Android long-press still needs a real-device check.

Device push uses a monochrome Vimbre badge, bounded title/body length, per-account/conversation grouping and an Open chat or View update action. Native notification layout belongs to the operating system/browser. Existing account binding is preserved and tested. Physical-device receipt and appearance were not asserted by this change.

Organization structured data now includes the supplied X, Instagram and TikTok handles. LinkedIn is pending the exact company-page URL; none was guessed. This does not change GA4 event delivery.

Database migration 20261031121544 replaces only existing private.myday_suite and private.myday_stars; the underlying assignment authorization function and public grants remain unchanged. Rollback-only SQL acceptance covered deduplication, idempotency, review versions, owner rejection, unowned source rejection and level counts. Security advisor findings were unchanged. No real messages, paid AI requests or load tests were sent. Preview fixtures were removed before release. Full lint/test/AI and billing typecheck/production build passed; existing lint warnings remain. Stars boundaries and device push isolation/grouping have dedicated regression tests.
