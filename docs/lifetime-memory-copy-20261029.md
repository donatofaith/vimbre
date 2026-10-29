# Lifetime access, memory and text selection

A single-use, company-bound lifetime Business access code was issued to Vimbre Ltd for launch continuity. The code is delivered directly to the company owner and is not stored in this repository. Lifetime access removes subscription expiry for that company; it does not remove Business AI usage/cost controls or grant access to other companies. Redeeming the code does not cancel a Stripe subscription.

Supabase's connected diagnostics showed a 36 MB database and mostly idle connections. The available tools do not expose host RAM/swap charts, so this snapshot cannot establish available RAM or capacity for 120–300 concurrent users. Review Supabase's host metrics and run a controlled load test before making a capacity claim. Recent diagnostics found no logged out-of-memory or too-many-clients errors.

The chat mobile layout was adjusted to avoid nested fixed-height/overflow containers collapsing content during native selection. It is a mitigation; the reported Android blank-screen-on-copy issue still needs confirmation on the affected phone. No Copy button was added.
