# UI and My Day acceptance — 27 October 2026

## Release state
Frontend remains on the review branch `fix/ui-myday-20261027`. Do not describe it as deployed or fully accepted until the complete browser regression and production checks pass. Local check currently passes 194 tests in 37 files, lint, Edge Function typecheck and production build. Existing lint warnings remain.

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

## Latest edits awaiting browser acceptance
- Mobile greeting/count layout, intact compact due-time text, Capture header and sticky action spacing.
- Due-time ordering within the same due date, explicit overflow move-to-tomorrow action.
- Editable plan start times, explicit suggested due-date acceptance and client validation of hours/gaps before saving.

## Acceptance evidence
The focused My Day/Capture suite passed 14 widths (320 through 1920) and touch checks at 360/768/1440. It reported no document overflow, no undersized controls in the checked gallery and zero AI calls. It exercises failed autosave retention/retry, completion delay/Undo and Capture acceptance/confirmation. Broader Records/Handovers/Support/Team regression remains in progress; do not treat the focused checks as whole-site acceptance. The previous Records test still expected seven footer links after the requested Terms link made eight; both assertions are now corrected.

## Remaining brief gaps
- Calendar busy-time ingestion (the Basic planner has tested busy-slot support but no connected meeting source yet).
- Three-consecutive-day skipped-task prompt and morning digest plan link.
- Full website/Console component parity and final visual inspection at 360/768/1440.

## Production blockers
1. Automatic approval review rejected production kudos/challenge tables and star-award behavior twice. It requires trusted user-authored text explicitly authorizing those side effects; assistant transcription of the screenshot was not accepted. Do not retry through another execution path. `TeamStars.tsx` and the SQL proposal remain prepared but unimported/uninstalled.
2. The integer credit-unit scoring migration returned `Invalid or expired requestState` through long SQL and migration calls. Read-only checks found no credit_units column or migration history row. Split-safe arithmetic was checked separately, but installed migration tests have not passed. `starsScoringReady=false` keeps competition enable disabled. No company was opted in by this work.

Never claim the entire client brief is complete while these gaps remain.
