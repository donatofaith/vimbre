# Stars mobile and copy correction — 2 November 2026

The owner supplied a phone screenshot showing the week date input overflowing the Weekly summary card. The previous preview mounted StarsPanel directly and omitted this container, so its no-page-overflow result missed the actual composition.

The corrected preview mounts WeeklySummaryPage with its tabs inside the real authenticated AppLayout. It remains an untracked sample-data fixture and is not published.

## Changes

- Week navigation uses two 44px arrow buttons and a native date input bounded by a minmax(0, 1fr) grid column. The label and input both have explicit width and minimum-width constraints. No document overflow rule masks the fault.
- The displayed date range is human-readable. This week appears as a return action when browsing history. The terms link is at the end of the panel.
- The weekly heading, badge and controls use compact phone sizing. Badge progress reads, for example, Next badge / Starter / 6 of 50 tasks, without qualifying-task terminology or a repeated explanation.
- My Day removes the feature introduction and snapshot implementation text. It uses Decisions to approve, Completed and Unfinished. Day summaries and the support chat keep only concise action-relevant text, including quiet-hour and chat expiry/privacy information.
- No SQL, grant, entitlement, badge threshold, consent, task action or notification delivery behavior changes.

## References reviewed

[Todoist Productivity](https://www.todoist.com/help/todoist/features/use-the-productivity-view-in-todoist-6S63uAa9) separates daily/weekly task counts and progress views. [Linear Insights](https://linear.app/docs/insights) places concise controls around filtered results and provides supporting guidance separately. These informed the shorter labels and simpler hierarchy; no proprietary UI was copied.

## Verification

The actual weekly page was checked at 15 configured viewport widths: 320, 360, 390, 393, 430, 640, 768, 820, 834, 1024, 1180, 1280, 1366, 1440 and 1920px. The native date field stayed inside both its label and the page card, the page had no horizontal overflow, and navigation targets measured 44 by 44px. The 320px view was inspected visually, with the complete native date and calendar icon visible. Previous week and This week changed the shown period and metrics. This is cloud Chromium verification, not a physical Android or Safari claim.

The existing 330 unit tests passed. The final production build is checked before publishing. GitHub Actions remain skipped. Publishing is limited to the six changed UI files and this review.
