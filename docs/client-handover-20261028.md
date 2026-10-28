# Handovers final specification, 28 October 2026

Owner supplied three screenshots; this supersedes prior handover UI and phase gating instructions while preserving privacy and company boundaries.

HANDOVERS: FINAL SPEC
A. FIX
Handovers page

1. One name everywhere: Handovers (menu and page title).

2. The button reads Start handover on every page.

3. The empty state is a dead end. It now teaches and offers starting points (see B2).
4. The page now shows role readiness and links to My role.

Start handover form

5. Role field removed. It showed a person’s name (“Role - Favour Dimola-Joshua"), truncated. For yourself, show a plain line: “For: your role, [Role title]". If the title is missing, show “Add your role title" as a link to My role.

6. Dates. Start defaults to the next working day. The return date starts empty and required. A return date before the start date is blocked with a clear message.

7. Manager warning. It was a dead end at the bottom. It becomes an amber message beside the Manager field: “Your line manager isn't set. Choose who approves, or add your manager in My role." The approver can be any manager or admin. If you’re the top person with no manager, and the company allows it, show “No
approval needed.”

8. Reason dropdown removed (see BS).

9. Side panel removed. It's cramped, hides the page, and can’t work on a phone.

10. Stepper tabs wrapped (4. Review and submit). Replaced (see B6).

11. Close is a plain X labelled “Close”, not “Close panel”.

B. CHANGE
Handovers page

1. Header: title, one line (‘Pass your work on so nothing stops while you’re away."), and the primary Start handover button. Managers get a small filter: Mine, Team.
2. Empty state: three cards instead of one sentence.

e Going on leave: “You're back on a set date."

oe Leaving the company: “Your work moves to someone else.”

e Someone is suddenly away: “Managers and admins only.”

Below them: “Your role is 70% ready. Finish it" (a link to My role), and “See what a handover looks like" (an example, labelled Example).

3. List rows: type, dates, cover person, status chip, and last updated. A click opens the handover. Managers see “Waiting for your approval” at the top, also surfaced in To review on My Day.
4. Statuses: Draft, Submitted, Changes requested, Approved, Active, Completed, Cancelled.

Start handover

5. A full page, not a panel. It has its own route, “- Handovers” at the top, a back button, a link that can be shared, and one scroll.

6. Progress is “Step 1 of 4: Details" with a thin bar. Steps are named Details, Include, Draft, Send. Completed steps are clickable. Wide screens show the step names beside the bar.

7. Type is three large choice cards (Going on leave, Leaving the company, Someone is suddenly away), not a dropdown.

8. Title is automatic (“Going on leave, 26 Oct to 2 Nov") with a small “Rename” link. Reason becomes Note for your manager (optional), a short text box. Undemeath: “Visible to your manager only. Don't add health details.”
9. Dates use one range picker with quick chips (“1 week", “2 weeks", “Pick dates"), and a line below: “Away 26 Oct to 2 Nov, 5 working days." Phones use the native date picker.

10. Cover person and Manager are searchable lists with a photo, name, role and department. The cover is suggested from My role’s preferred cover. The manager is filled in from Team, with a “Change” link.

11. Footer is sticky: Back (steps 2 to 4), and Next: Include (it names the next step). Saving is automatic, with a small “Saved 10:15" note. Leaving with unsaved changes asks first.

9 41


C. ADD:
Step 1, Details

« Type, then For whom. Yourself: “For: your role, [Role title]". Someone else: “Who is away?" with a person search.

« When. Going on leave: start and return dates, plus a tick box “I don’t know my retum date yet". Leaving: “Last working day”.

« Who covers. Cover person (for leaving: “Who takes over?"). Manager approving.

+ Note for your manager (optional).

+ Readiness line: “Your role is 70% ready. Finish it’. It never blocks the flow.

« Warnings (amber text beside the right field): the cover is away on those dates or already covering someone, the dates overlap another of your handovers, the start is sooner than the company’s minimum notice, or the start date is in the past.

Step 2, Include

« Alist grouped by My work, Decisions, Contacts, Documents, Deadlines, Open tasks and Notes. Each item has a switch, and each group has Select all and Select none.
« Everything marked “Include in handover’ in My role is on by default. Private items never appear.

+ Open tasks from My Day are listed, with tasks due during the absence selected by default.

+ Items due for a check show “Still correct?”.

+ Copy from my last handover sits at the top.

Step 3, Draft

+ Generate draft (Vimbre Al, on tap, shows “Uses 1 of 15 today") or Write manually.

+ Sections: Summary, What comes first, Open tasks, Deadlines while away, Decisions to keep, Contacts, Documents, Watch outs, Notes.
« Vimbre Al orders “What comes first" using due dates, importance and “Do not change". You can drag to reorder.

« Everything is editable and marked “Check before submitting". Sections stack as cards (collapsible on phones).

Step 4, Send

« Achecklist (cover person set, dates set, priorities listed).
+ Preview as cover (full screen).
+ Submit to manager.

The handover page, by status

« Header: type, dates, status chip, and the cover and manager. On phones, the main action sits in a sticky bar.

« Draft: edit and continue from the last step.

+ Submitted: read only, with “Withdraw”.

+ Changes requested: the manager's comments are shown, you edit and Resubmit.

+ Approved: scheduled. The cover is notified. Edits are allowed but marked.

« Active: the owner sees “Priya is covering. 3 of $ tasks done” and can add notes. The cover sees the handover in Cover duties and the covered tasks under Covering for in My Day.
« Completed: the record, with an optional summary.

+ Cancelled: kept in the list for reference.


Approval and cover
+ Manager approval: the manager reads it in To review and chooses Approve or Request changes with a comment.
+ Cover: after approval (or on assignment, per company setting) the cover is notified. On the start date, the selected tasks appear in their My Day.
+ Questions: a comment thread on the handover. The caver aks, the owner or manager answers.
+ Edits after approval: marked “Changed since approval”, and the manager and cover are notified. Changing the caver or the dates needs approval again.
+ Take back: on retum, the owner taps Take back. Open tasks go back to them, finished tasks stay done, and the status becomes Completed.
+ Reminders: “Your leave starts in 3 days and your handover isn't submitted.” The manager is reminded if it isn't approved two days before the start. The caver is told on the start date. A “Take back” prompt appears on return day.
+ Cancel and delete: the owner can cancel before it goes Active (notifies the manager and cover). A draft can be deleted with Undo. Active and Completed handovers can't be deleted, because they're part of the record.

D.ADO:
1. Someone le euddenty away. A manager or admin picks the person, and the handover is dritfied from their role (items marked “Include in handover") and open tazks. Its labelled “Created by manager. Not reviewed by [name]. The cover is assigned straight away. Private notes are never used. On return, the person sees what was shared and with worn.
2. Share outslde. In Send, add an email address and a read only fink or PDF with an expiry (default 14 days), # revoke bution and 2 view log. Only chosen sections are shared, and only if the compiny allows extemal sharing.
‘3. “While you were away” summary (Virbre Al, on tap) on return: what the cover did, decisions made, and new iterns.
4. Export as PDF.

E. ADD:
+. Leaving the company. The same flow, with a “Last working day” and a reassign step inside Include (assign each open tazk to someone). The role can then be passed to a new starter (My role, phase 3). The person's data stays in the company record under the manager, following the company’s retention setting.
2. Templates. “Start from a template” appears above Type for roles that have one.
2. Team overview for adming. Counts only: upcoming, unapproved, or missing a cover person. Newer contents.
4. Cover capacity warming for snyone covering tov many people al once.

F. RESPONSIVE AND EASY TO READ

1. Phone (under 768 pixel): one column, 16 pixel side margins, full width buttons in the sticky footer (with space for the home bar), and “Step 1 of 4" for progress.
2. Tablet (768 to 1279): one centred column about 680 pixels wide.

3. Desktop (1280 and above): one column about 720 pixels wide, with an optional summary card at the right showing dates, cover and manager as they're chosen.

4. Reading: labels at 16 pixels and bold, helper text at 14 pixels in a darker grey, fiekis 48 pixels tall, 24 pixels between fields, group headings (Type, When, Who, Note), and good colour contrast.
5. Touch and keyboard: inputs at 16 pixels or larger (so phones don't zoom). tap targets of at least 44 pixels, vizible focus, Enter moves forward, and Excape azks before closing.

6. No horizontal scroll =t any width or at 200 percent zoom. Long names wrap or shorten with the full name an haver or tap.

7. Errore appear beside the field in plain words, never onily at the bottom. Loading shows a skeleton, and a save failure shows a retry message without losing anything.

G. RULES

Permissions: the owner and manager see everything. The cover sees it after appraval or azxignment (a Settings option). Admins can read all and start sudden absence handovers. Nobody else can see it.
‘Settings drive behaviour: whether approval is required, who can approve, minimum notice, extemal sharing, link expiry, and required sections.

+ Privacy: no health details. Private role items and notes are never included unless the owner chooses. The nate for the manager is visible to the manager only, never the caver.

+ Al coat: drafting only on tap, results cached by a fingerprint of the content, two redrafts, the allowance shown, and a clean fallback to Write manually that keeps everything entered.

+ Audit: every status change, edit, share and view is logged.
Bullt to grow: handaver types and sections are registered by configuration, so 3 new type doesnt change the page. Every action fires an event (started, drafted, submitied, approved, changes requested, activated, taken back, shared, cancelled).

Data: type, dates, retum date unknown (yes or no), owner, cover, approver, status, content by section, note for manager, created by (awner or manager), approved by and when, share fnks, version history, and links to the tasks, decisions and role items included.

H. THE WORDS
Handovers, Start handover, Details, Include, Draft, Send, Gaing on leave, Leaving the company, Someone is suddenly away, For, When, Last working day, Who covers, Who takes over, Manager, Note for your manager, Rename, Next, Back, Saved, Close, Generate draft, Write manually, Preview as caver, Submit to manager, Approve, Request changes, Resubmit, Withdraw, Take back, What comes first, Do not change, Copy from my last handover, Cancel

handover.
Remove: New handover, Close panel, Role (a= 2 field), Reason, Not specified, Expected return date, Not available yet.
