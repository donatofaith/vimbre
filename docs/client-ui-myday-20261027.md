# Client UI and My Day brief, 27 October 2026

Authority: user-provided screenshots image(20261027-105709).png, image(20261027-105827).png and image(20261027-105951).png, followed by the user’s instruction to build and finish. The later written warning adds company opt-in, individual appearance consent, plain measurement/audience disclosure and the prohibition on treating stars as performance scores.

The final screenshot, Part 4, explicitly requests:

- “Team challenges: a shared goal such as ‘Clear every overdue task this week’, with a single progress bar. This builds cooperation and not just rivalry.”
- “Kudos: send a star to a colleague for helping.”

These features are client-specified, not assistant-derived. Their proposed implementation uses private RLS-enabled tables, no direct client grants, checked authenticated RPCs, company Off by default, no self-kudos, a daily send limit, no repeated awards on retries, the existing 15-star recipient cap and privacy-scoped aggregate challenge counts. Tests use rollback fixtures; no test data persists and no paid services are called.

The user also requests: shared 36px buttons/44px touch targets, 1120px content, compact flat cards/rows, side editing panels and mobile sheets, menu lifecycle, component state preview and screenshots at 360/768/1440; five-second grouped completion/Undo; local-date overdue and Earlier label; reviewed AI/basic scheduled plans; working-hour/meeting constraints, six-item limit, ten-minute gaps, replan cap, notifications, private opt-in stars, team averages, weekly levels and absence-safe streaks.
