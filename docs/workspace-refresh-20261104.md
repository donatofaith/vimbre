# Workspace corrections — 4 November 2026

## My Day view switching
Board used to silently change Today to All. Changing presentation now preserves the selected filter. Today tasks remain in the status columns; Coming up remains its separate date group. Switching back to List does not change the scope or due dates. Week continues to select This week.

## Refresh timing
Before: My Day tasks, priorities, shared counts, Team activity, conversation list, work/suite/service/Capture notifications and handover list generally used independent 60-second timers. My Day extras and My role had focus/mutation or initial-load refreshes without a periodic check. Capture used a 4-second check only while extraction was pending.

Now: those core workspace reads use one shared 30-second visible/online clock and coalesced refreshes on focus, visibility return, reconnection, saved work and profile changes. My role skips background reads while an editor or panel is open; Capture skips while saving, drafting or editing manually. Draft state is retained. Hidden/offline tabs pause. In-flight async reads do not overlap; a trailing read handles changes received while loading. No page reload or automatic AI generation.

Unchanged faster/dedicated mechanisms: chat inbox uses realtime plus a 20-second fallback, member presence heartbeat 45 seconds, pending Capture extraction 4 seconds, open support conversations 15 seconds. No change to privacy, backend authorization, AI allowances or paid calls.

## Layout
Team member name, job title and availability use separate lines with a 5px gap. Chat title has its own line; job title and participant count have a 12px gap and wrap on narrow screens. Participant names and roles also have spacing. Help & Support appears once, directly after Settings in sidebar utilities.

## Validation
389 tests, TypeScript, lint and build. Tests cover one shared timer, paused hidden/offline tabs, coalesced return events, serialized slow reads and cleanup. Browser fixture checks cover 24 repeated List/Board switches at six widths, keeping Today and Coming up separate. Team activity/Chat checked at six widths. No production records changed during QA; no backend deployment or migration. No files deleted.
