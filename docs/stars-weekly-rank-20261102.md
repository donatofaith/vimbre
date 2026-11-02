# Earned weekly positions, 2 November 2026

The personal rank query included opted in members with zero weekly stars, so an empty team tied at rank 1 while the earned top three query returned no people. This was a zero score tie, not a previous week's position being reused.

Personal positions and top three now require a positive current week total. Weekly queries have both a start and end boundary. The frontend also hides the position when the personal weekly total is zero or the positive leaderboard is empty. Zero team averages remain valid and are still displayed. Company/team scope, personal consent, privacy, lifetime level progress and history are preserved.

Validation: 323 unit tests, production build and targeted lint pass. Hosted rollback fixtures cover empty, zero point, previous week, next week, positive, voided and opted out cases. No real awards or customer records were changed. Publish only this fix with [skip ci].
