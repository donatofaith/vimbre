# Chat mention and receipt correction

The owner supplied a client conversation screenshot and reported that selected mentions absorbed subsequent message text and appeared twice. The client also requested read/unread feedback and Chat immediately before Help and support.

- A selected full name ends at its following space or punctuation. Typing a later word no longer searches for a nonexistent longer name; a subsequent `@` opens a new search. The existing participant-ID validation and notification flow remain.
- Mentions render as highlighted inline text in sent messages, once. Separate composer name chips and duplicate sent-message badges are removed. Message text continues to render as React text, never HTML.
- Chat sits directly before Help and support in workspace navigation. Header access remains.
- Conversation details expose each participant's existing read position and join date only after the existing conversation-access check. Sender status is Sent, Sent · Unread, Read by N of M, or Read. No delivery/online claim is invented. Inactive participants and people joining after a message are excluded from its expected readers. Existing unread badges and read-at-visible-bottom behavior remain; receipts refresh through the existing chat refresh/poll path.

Validation: 223 tests in 45 files; production build/prerender/offline generation; focused lint. The chat browser suite reproduces selecting Bob, immediately typing a sentence, sending one inline mention, no duplicate chips/badges, progression through unread/partial/all-read, sidebar position, and existing notification/access/retry flows at fourteen widths. Database acceptance uses rollback fixtures to verify read-position progression and deny outsiders. No customer messages, emails or AI calls are sent by tests.

The previous deployment's Capture billing gate was rechecked for the specifically requested Vimbre Ltd workspace: effective plan Free, billing AI allowed, enabled, not blocked, zero daily/monthly requests. The workspace can refresh and retry Capture with the Free allowance (3/day, 15/month), subject to the existing provider and spend safeguards. Complimentary Starter access remains unapplied because the approval review required explicit authorization for that company, plan and duration. This release does not grant it.
