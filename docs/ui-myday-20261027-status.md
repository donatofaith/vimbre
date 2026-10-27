# 27 October UI and My Day work

## Local changes only
Shared workspace button baseline: 36px, 44px coarse pointer, 14px medium text, 8px radius, 16px icons, 2px focus ring. Workspace width 1120px, padding 24px/16px mobile. Shared cards 16px padding, 12px radius, no shadow.

## Not complete
Page-specific overrides, all menus and editing panels, component gallery, public website and Console parity, responsive screenshots at 360/768/1440 and undersized control report.
My Day completion delay/grouping, timezone overdue audit, scheduled AI/basic planning, settings and calendar integration, notifications, stars ledger and anti-gaming, consent/access controls and terms remain to implement. No claim of deploy or visual acceptance.

## Required stars safeguards
Company default Off; each person separately opts in to appearing. Plain disclosure in Settings and terms of measurement and audience. Stars are not a performance score and should not be used in reviews, pay or ratings. Priority/time weighting, ten minute minimum, double cover credit, daily cap and absence-aware working-day streaks require server enforcement.

## Additional local work
- My Day view picker now uses shared SegmentedControl.
- Shared Button supports explicit loading/locked state.
- Disclosure action menu lifecycle closes on outside pointer, Escape, scroll and pathname changes.
- Authenticated /app/ui component state preview added.
- Local unit suite: 186/186 passed. TypeScript passed before gallery addition; production build checks gallery as well.
- Backend audit found due_at < now() in myday_tasks and counts; requires migration to user-local date comparison before claiming compliance.
- No Actions workflow triggered and no paid provider tests made.

## Current checkpoint
- Date correction proposal in supabase/proposals/myday-local-date.sql generated from live function definitions (not old migration). Not applied.
- Rollback DB test passed: earlier-today in Today, exactly one yesterday overdue task, done excluded from overdue, counts match. Test file supabase/tests/myday-local-date.sql requires proposal inserted at marker before running pre-migration.
- Task completion five-second grouped delay implemented locally; visual regression not yet run. Undo retains existing server history path. Earlier label and completed strikethrough added.
- Typecheck passed after completion changes. No deployment and no GitHub workflow triggered.
- Authoritative development head rechecked: fa61f9fd4d6d857892d694740e303af086f0107f.
- Local browser binary search found none. Existing successful CI used /usr/bin/google-chrome but host here lacks it; no repeated Playwright download attempted.
- IMPORTANT: User requires continuing implementation without premature final replies. Entire brief remains active; do not represent these partial edits as completed.

## Planner and stars checkpoint
- day-planner.ts with 3 passing tests: meeting exclusion, 10 minute gaps, working-hour bounds, six-item cap, overdue ordering, immutable source tasks. Not yet wired to saved plans.
- star-rules.ts with 3 passing tests: 10 minute minimum, due date, deletion/split exclusions, priority/duration weighting, double cover credit, daily cap. Preview calculation only; no server awards or leaderboard exposure.
- These are building blocks, not completed product features. Server deduplication, proof of cover, consent, notifications, leave-aware streaks and plan persistence are still required.

## Latest integration checkpoint
- New private opt-in tables and security-invoker RPC proposed in myday-stars-consent.sql. Rollback tests passed: Off/hidden defaults, HR-only company setting, individual consent, cross-company isolation. Not installed.
- CompetitionSettings now connected to that proposed RPC; must install verified migration before release.
- New private saved plan table and checked RPC proposed in myday-plan.sql. Get path tested in rollback. Accept/replan concurrency and validation tests still needed. ScheduledPlan UI uses this RPC for Basic plan fallback. AI Plan retains original path; full scheduling integration not finished.
- 192 local unit tests passed before additional invalid-input test. No deployment, Actions run, email or provider call.
- Frontend currently depends on proposed RPCs; DO NOT publish until backend installed and browser verified.

## Backend acceptance results
Rollback-only plan tests passed: accepted plan persists, duplicate task IDs rejected, unknown task IDs rejected, fourth replan rejected. No rows persisted. Full local npm run check exited 0; see work/ui-myday-check.log.

## Installed backend / review branch
- Applied migration 20261027113603_myday_local_dates_plans_and_opt_in_stars. Exact SQL saved under supabase/migrations.
- Installed award/Undo/recompletion tests passed. Daily cap/opt-out/anonymous checks passed before install in combined rollback test.
- Review branch fix/ui-myday-20261027 starts at 57896d0e4e628c254fc9c87ff3a7058766537a8c; second commit adds browser startup diagnostics.
- Focused CI 40497684545: unit/check/build pass; browser could not reach greeting after fixture login. Investigating with diagnostics; no live frontend promotion yet.
- Additional proposed plan-notices SQL NOT applied; must scope test to fixture rather than process real jobs.
- Live frontend still previous release. Backend competition defaults Off and no companies are enabled by this work.

## Remaining client acceptance gaps (do not claim full completion)
- Full website/Console component parity, row truncation/show-five, native picker replacements, edit autosave and Capture draft row redesign still require work beyond shared baseline.
- Calendar busy-time source ingestion; scheduled plan drag/time edits; due-date suggestions; Not today date picker; three-day skip prompts; preserved completed plan slots; morning digest plan link.
- Plan slot/reason reminders: SQL proposal exists but not yet tested/applied.
- Stars: task awards/private ranking installed; full-plan/handover bonuses, streak/absence model, team-average competition/challenges/kudos and own-rank projection remain.
- No live frontend release until browser acceptance succeeds.

## Additional installed changes
- 20261027114608 plan retries are idempotent, completed slots preserved, six-slot cap includes completed work. Rollback and installed retry tests pass.
- 20261027114726 plan start/reason notices deduplicated through existing private scheduler; scoped rollback test passes; no real email sent in testing.
- 20261027115315 complete-plan +3 and prepared-submitted-handover +5 awards, within daily cap. Undo voids plan bonus. Rollback fixture checks pass.
- Opted-in team-average/own-rank projection installed (timestamp to record). No task content exposed.
- Focused CI 40498507330 passed across 14 widths but initial screenshots showed fixture read errors and excessive spacing; corrected fixture and tightened layout.
- Expanded CI 40499289538 passed earlier/completion transition checks, then failed on synchronous Playwright checkbox uncheck timing. Changed to click and await the async saved state; rerun still needed.

## Production blockers and safe release boundary
- Automatic approval review rejected production kudos/challenge schema twice. Second rejection states trusted user-authored text explicitly authorizing these production side effects is required; assistant transcription of the attachment was not accepted. Do not attempt other execution paths. Client source is recorded in docs/client-ui-myday-20261027.md. SQL and TeamStars are prepared but not installed/imported.
- Integer credit-unit migration myday-star-weighting.sql is NOT applied: long SQL requests and migration call return Invalid or expired requestState. Read-only checks confirm no credit_units column, no migration row, zero enabled companies and zero awards. Pure arithmetic query confirms six ten-minute tasks and one sixty-minute task each total two stars under proposed units.
- Stars company enable control is gated by starsScoringReady=false until that migration and its installed tests pass. Personal appearance and absence controls remain independently available; no company has been opted in by this work.
- Frontend currently includes compact Capture draft groups, five-row reveal, checkboxes, side-panel editing, sticky save/discard; My Day existing-task autosave with atomic owner/version guard; public action sizing. Expanded mock browser acceptance covers failed-save text retention, priority preservation, earlier label, five-second done transition, draft review/confirm and touch controls.
