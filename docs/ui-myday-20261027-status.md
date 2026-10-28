# UI and My Day acceptance — 27 October 2026

## Release state
Verified UI/planner release is live on vimbre.com: production commit `328c8a565a483d67fe99831b4ab390343d88dd11`, Vercel deployment `dpl_ExZ65hNkxeSyeg7vJRan5GDaMtZf` READY. Its source tree matches tested commit `0f38f861a96dec80c175ae52b46ec5cd506fa0af`. This is the previous release; the approved Stars/skip-review follow-up below is awaiting browser acceptance. Local check currently passes 194 tests in 37 files, lint, Edge Function typecheck and production build. Existing lint warnings remain.

## Implemented
- Shared 1120px workspace, 24px/16px insets, 36px desktop/44px touch buttons, compact flat cards, segmented controls, shared menu lifecycle and authenticated component gallery.
- Compact My Day header, five-row lists, user-local date overdue rules, Earlier label, grouped five-second checked/struck completion and existing Undo.
- Existing-task autosave with an atomic owner/version guard, retained edits after failure and retry. New task creation remains explicit.
- Reviewed AI ordering with cached results and Basic plan fallback; six-task maximum, work-hour bounds, ten-minute gaps, drag/button reordering, editable minutes/reasons and explicit acceptance. Completed slots survive replanning; identical retries do not consume a replan; maximum three replans per day.
- Next planned task Start/Done, focus view and local countdown. Slot and decision-reason notices use the existing private scheduler.
- Capture collapsed draft rows, first five and reveal, grouped kinds, explicit acceptance, side-panel editing and sticky save/discard through the existing private review/confirmation pipeline.
- Opt-in stars ledger, plan/handover bonuses, Undo protection, own-team consent-filtered ranking and averages, personal working-day/absence streaks, Settings and terms disclosures. Competition enable remains gated until split-safe scoring is installed and verified.

## Installed migrations
- 20261027113603_myday_local_dates_plans_and_opt_in_stars
- 20261027114608_myday_plan_retry_and_completed_slots
- 20261027114726_myday_plan_slot_notifications
- 20261027115315_myday_plan_and_handover_star_bonuses
- 20261027115519_myday_opt_in_team_averages
- 20261027115833_myday_absence_safe_working_day_streaks
- 20261027121308_myday_atomic_owner_autosave

Rollback fixture checks cover local dates/counts, owner/company isolation, confirmation/retry boundaries, completed plans, notice deduplication, award/cap/Undo rules, consent visibility, absence streaks and stale autosave rejection. No real email or paid model call was made by these checks.

## Latest accepted edits
- Mobile greeting/count layout, intact compact due-time text, Capture header and sticky action spacing.
- Due-time ordering within the same due date, explicit overflow move-to-tomorrow action.
- Editable plan start times, explicit suggested due-date acceptance and client validation of hours/gaps before saving.

## Acceptance evidence
The focused My Day/Capture suite passed 14 widths (320 through 1920) and touch checks at 360/768/1440. It reported no document overflow, no undersized controls in the checked gallery and zero AI calls. It exercises failed autosave retention/retry, completion delay/Undo and Capture acceptance/confirmation. Records, Handovers, Support and Team regression also passed in run 40538831571. This covers mocked frontend flows and responsive layouts; no signed-in production user mutation was performed. Screenshots at 360/768/1440 were inspected. A duration-change bug that reset an edited start time was caught by browser acceptance and corrected. Both footer assertions now include the Terms link.

## Approved follow-up — database installed, browser acceptance pending
The user explicitly approved production kudos/shared challenges and capped star awards. Installed migrations:
- 20261027162234_myday_approved_kudos_and_shared_challenges
- 20261027162808_myday_split_safe_credit_foundation
- 20261027162831_myday_split_safe_completion_awards
- 20261027163318_myday_three_day_skip_review

The full scoring call continued to expire, but guarded two-stage migrations succeeded while all company modes were Off. Installed-schema rollback checks pass for split-equivalent credit, Undo rebalance, cap, plan/handover bonuses, kudos deduplication/day limits/privacy and challenge progress/consent. Private tables have RLS and no direct client grants. No company was enabled by these tests. The scoring readiness gate is now true and TeamStars is connected; company and personal opt-in remain required.

Explicit Not today choices are recorded once per task/user-local day. Three consecutive days prompt Keep, Break into steps or Delete. Keep dismisses the current review without changing the due date; steps use the existing task editor/autosave; Delete retains the existing confirmation and source protections. Rollback checks cover duplicate clicks, valid dates and owner isolation.

my-day-mail v14 is ACTIVE. Its only bundle change adds a fixed Vimbre My Day link to the existing briefing/digest text. Auth, job claims, recipient resolution, AI allowance/cache, retries and email opt-ins are unchanged. Unit checks use mocked sends; no paid generation or real email is sent.

194 local tests and the build pass. Expanded browser acceptance now covers enabling company competition, individual appearance, kudos sending, skip review and editing steps. Do not claim this follow-up is live until that browser run and production deployment pass.

## Known limits
- Connected calendar busy-time ingestion is not provided by the current read-only Capture consent. Planning uses configured work hours as the fallback; the pure planner has tested busy-slot support.
- Physical-device acceptance is separate from automated browser viewport/touch checks.
- The separate Console repository was not changed by this customer-workspace release.
