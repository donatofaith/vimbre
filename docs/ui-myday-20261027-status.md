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
