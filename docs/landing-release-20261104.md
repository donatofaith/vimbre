# Landing review — 4 November 2026

Owner explicitly authorized production release of the reviewed public site with these corrections.

Restored the previous hero paragraph from the supplied photo. Retained the rotating headline and account choices. Removed home-page pricing footnotes (the pricing page retains the trial terms), Vimbre in brief, and Follow the work through the current app. Compare plans remains.

Replaced soft screenshot presentation with the actual current app components in a separate seeded demo build. Demo uses fictional people and records, MemoryRouter, a non-persistent isolated Supabase client, mocked operations and connect-src none. No real account required; no backend writes or paid AI calls. The main application client remains unchanged. Live demo dimensions follow their container; the six manifest steps drive both displays. Screenshot assets remain as no-JavaScript fallback. Capture-density limits recorded in the earlier preview note still apply only to those fallback images.

Validation: 386 tests, lint (existing warnings), app typecheck/build; six-width browser overflow check and all six demo steps at every width (36 combinations); explicit built-bundle isolation check. No files deleted. No backend changes.
