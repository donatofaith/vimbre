import type {BlogImage} from '../../lib/blog-image.mjs'

export type BlogPost = {
 slug: string; title: string; description: string; published: string; author: string
 featuredImage?: BlogImage
 sections: {heading:string; paragraphs:string[];image?:BlogImage}[]
 modified?:string
 template?: string
 faq?: {question:string;answer:string}[]
}
// Public guides approved in the client’s 30 October brief.
export const blogPosts: BlogPost[] = [
  {
    "slug": "employee-handover-template",
    "title": "Employee handover template",
    "description": "A practical employee handover template covering priorities, decisions, deadlines, contacts and access.",
    "published": "2026-10-30",
    "author": "Vimbre",
    "sections": [
      {
        "heading": "What a useful employee handover contains",
        "paragraphs": [
          "A handover should let another person continue the work without reconstructing it from messages. Start with what needs attention next, then explain the decisions and constraints behind it. A folder of links alone does not tell a colleague what to do.",
          "Use the template below for a permanent move, a change of role or temporary cover. Replace each bracketed prompt, remove sections that do not apply and give the recipient access to the linked records."
        ]
      },
      {
        "heading": "Fill it in around real work",
        "paragraphs": [
          "List each open item with a current status, next action, named owner and due date. Separate an agreed deadline from an estimate. Record the reason for important decisions and who agreed them so your cover does not accidentally undo them.",
          "For example: Supplier review — waiting for revised insurance certificate; next step: ask the supplier on Tuesday; owner: [cover]; deadline: [date]. Keep the approved supplier in place until the certificate is checked."
        ]
      },
      {
        "heading": "Check that someone else can use it",
        "paragraphs": [
          "Ask the recipient to open the links and explain back the first two actions. Resolve missing permissions before the handover begins. Agree where new decisions and changes will be recorded, and set a review date.",
          "Keep passwords and recovery codes out of the document. Request access through your approved administrator or password manager. Limit personal and customer information to what the recipient needs."
        ]
      },
      {
        "heading": "Keep the handover connected",
        "paragraphs": [
          "Use Vimbre to maintain role records, decisions, tasks and reviewed handovers together. The template remains useful on its own: keep one current version and update it when the work changes."
        ]
      }
    ],
    "template": "EMPLOYEE HANDOVER\nRole / team: [ ]\nPrepared by: [ ]   Cover / successor: [ ]\nHandover dates: [ ]   Last updated: [ ]\nManager / escalation contact: [ ]\n\n1. START HERE\nPurpose of the role: [ ]\nThree immediate priorities: [ ]\n\n2. OPEN WORK (repeat for each item)\nItem: [ ]\nStatus / last completed step: [ ]\nNext action: [ ]   Owner: [ ]   Due date: [ ]\nSource / document link: [ ]\nBlocker and escalation point: [ ]\n\n3. DECISIONS AND GUARDRAILS\nDecision: [ ]   Reason: [ ]\nAgreed by / date: [ ]   Evidence link: [ ]\nWhat must not change without approval: [ ]\n\n4. ROUTINE WORK\nActivity: [ ]   Frequency / next occurrence: [ ]\nSteps / checklist link: [ ]   Backup owner: [ ]\n\n5. CONTACTS, FILES AND ACCESS\nContact / purpose / approved contact channel: [ ]\nRecord / location / access confirmed: [ ]\nAccess requests still needed (no passwords): [ ]\n\n6. ACCEPTANCE\nRecipient reviewed links on: [ ]\nQuestions / gaps / owner / resolve by: [ ]\nManager sign-off if required: [ ]\nNext review: [ ]",
    "faq": [
      {
        "question": "What should an employee handover include?",
        "answer": "Include open work, next actions, owners, deadlines, decision reasons, recurring duties, relevant contacts and document links. Confirm access and record any unresolved gaps."
      },
      {
        "question": "How long should a handover document be?",
        "answer": "Make the first page a short summary of immediate priorities. Use linked records for detail and include enough instructions for the recipient to carry out the work safely."
      }
    ]
  },
  {
    "slug": "how-to-write-a-handover-document",
    "title": "How to write a handover document",
    "description": "A step-by-step handover writing guide with a fill-in document and a worked example.",
    "published": "2026-10-30",
    "author": "Vimbre",
    "sections": [
      {
        "heading": "Start with the recipient’s first day",
        "paragraphs": [
          "Write for a person who understands the business but has not followed every conversation. Answer four questions first: what is happening, what happens next, who owns it and why the current approach was chosen.",
          "Choose a single document owner and a clear date range. Agree whether the document is for temporary cover or a permanent transfer; that changes which decisions the recipient can make."
        ]
      },
      {
        "heading": "Step 1: collect the current facts",
        "paragraphs": [
          "Review your active tasks, recurring duties, recent decisions and upcoming deadlines. Check each item against the actual source. Do not copy an old task list and assume its status is still correct.",
          "Group the work by project or responsibility. Mark completed work separately so it does not look like a new action."
        ]
      },
      {
        "heading": "Step 2: turn notes into instructions",
        "paragraphs": [
          "Replace vague entries such as “sort reporting” with an action, owner and date. Add where the inputs are stored, the approval needed and the outcome that counts as finished.",
          "Worked example: “Prepare the monthly report using [source]. Ask [reviewer] to approve the figures by [date], then upload to [location]. The reporting period follows the finance calendar, not the calendar month.”"
        ]
      },
      {
        "heading": "Step 3: explain the decisions and risks",
        "paragraphs": [
          "Describe the reason behind a decision, the people who agreed it and any condition that would make it worth reviewing. List blockers with an escalation contact rather than leaving the recipient to guess.",
          "For sensitive matters, link to an appropriately restricted record instead of copying its contents into a widely shared handover."
        ]
      },
      {
        "heading": "Step 4: test and maintain the document",
        "paragraphs": [
          "Walk through one task with the recipient. Confirm they can open the files, find the latest version and identify the next deadline. Record questions and assign someone to close each gap.",
          "Keep one current version. Vimbre can connect the tasks and decisions used in a handover so updates do not depend on remembering which document to edit."
        ]
      }
    ],
    "template": "HANDOVER DOCUMENT WORKSHEET\nPurpose: [temporary cover / permanent transfer]\nRole / workstream: [ ]   Dates: [ ]\nDocument owner: [ ]   Recipient: [ ]\nLast checked: [ ]\n\nOVERVIEW (five lines maximum)\nWhat this work achieves: [ ]\nCurrent position: [ ]\nImmediate next step: [ ]\nMost important deadline: [ ]\nMain risk: [ ]\n\nWORK INSTRUCTIONS (repeat)\nOutcome required: [ ]\nInputs and approved file locations: [ ]\nSteps: 1. [ ]  2. [ ]  3. [ ]\nOwner / reviewer: [ ]\nDeadline / time zone: [ ]\nCompletion check: [ ]\nIf blocked, contact: [ ]\n\nDECISION RECORD\nDecision / reason / agreed by / date: [ ]\nEvidence: [ ]   Review trigger: [ ]\n\nRECIPIENT CHECK\nLinks opened: [ ]   Permissions confirmed: [ ]\nExample task walked through: [ ]\nUnresolved question / owner / due date: [ ]\nNext document review: [ ]",
    "faq": [
      {
        "question": "What is the best way to structure a handover document?",
        "answer": "Begin with immediate priorities, then group open work, routine duties, decisions, risks and access. Finish with a recipient check and unresolved questions."
      },
      {
        "question": "Who should review a handover?",
        "answer": "The receiving colleague should review the instructions and links. Involve the manager or relevant approver when ownership, sensitive information or approval authority changes."
      }
    ]
  },
  {
    "slug": "handover-checklist-for-managers",
    "title": "Handover checklist for managers",
    "description": "A manager’s checklist for ownership, access, risk, acceptance and follow-up during a team handover.",
    "published": "2026-10-30",
    "author": "Vimbre",
    "sections": [
      {
        "heading": "Manage the transfer, not just the document",
        "paragraphs": [
          "A completed document does not by itself mean responsibility has transferred. A manager needs to confirm who owns each commitment, whether the cover person has capacity and what decisions require approval.",
          "Use this checklist before leave, a role change or an employee departure. Set the handover scope first and agree what will pause rather than silently allocating everything to one colleague."
        ]
      },
      {
        "heading": "Before the transfer",
        "paragraphs": [
          "Check the next two weeks of deadlines, key customer or supplier commitments and routine work that could otherwise stop. Name a backup for time-sensitive work. Review which tasks can be deferred with the relevant stakeholder.",
          "Verify access through normal approval channels. Do not ask the outgoing person to share a password or use a personal account as a workaround."
        ]
      },
      {
        "heading": "At the handover review",
        "paragraphs": [
          "Ask the recipient to describe the next action for each critical item. Review decision reasons and escalation thresholds. Distinguish outstanding questions from agreed instructions and assign an owner and date to resolve each question.",
          "For example, a payment deadline may need cover immediately while a research task can wait. Document the decision to defer work so it does not become an invisible missed commitment."
        ]
      },
      {
        "heading": "After the transfer",
        "paragraphs": [
          "Check the first completed cycle of important routine work. Review new blockers with the cover person and rebalance workload if required. When temporary cover ends, explicitly take back ownership and review what changed.",
          "Vimbre’s reviewed handovers can support this process alongside connected role records and tasks. Keep the acceptance check even when the document is generated from existing records."
        ]
      }
    ],
    "template": "MANAGER HANDOVER CHECKLIST\nEmployee / role: [ ]   Recipient: [ ]\nManager: [ ]   Transfer date: [ ]\n\nSCOPE AND CAPACITY\n[ ] Coverage dates and responsibilities agreed\n[ ] Recipient capacity checked\n[ ] Work to pause agreed with stakeholders\n[ ] Backup and escalation owner named\n\nWORK AND RISK\n[ ] Critical deadlines have an owner\n[ ] Customer / supplier commitments recorded\n[ ] Recurring duties have instructions and next dates\n[ ] Decision reasons and approval limits documented\n[ ] Known risks have mitigation and escalation steps\n\nACCESS AND RECORDS\n[ ] Recipient can open the current files\n[ ] Approved access requests completed\n[ ] Sensitive information shared only where needed\n[ ] No passwords or recovery codes in handover notes\n\nACCEPTANCE\n[ ] Recipient walked through critical items\n[ ] Open question / owner / due date recorded\n[ ] Required approvals completed\n[ ] Relevant stakeholders informed\n\nFOLLOW-UP\nFirst review date: [ ]\nTemporary cover take-back date: [ ]\nOutstanding gap / owner / resolve by: [ ]\nManager acceptance / date: [ ]",
    "faq": [
      {
        "question": "What should a manager check before accepting a handover?",
        "answer": "Check ownership, recipient capacity, deadlines, access, risks and unresolved questions. Confirm that the recipient can carry out the next critical actions."
      },
      {
        "question": "Should every handover need manager approval?",
        "answer": "Use the approval process appropriate to your company and the risk involved. Make approval explicit where responsibilities, access or important commitments change."
      }
    ]
  },
  {
    "slug": "what-to-do-when-an-employee-leaves-suddenly",
    "title": "What to do when an employee leaves suddenly",
    "description": "A practical continuity plan and triage template for an unexpected employee departure.",
    "published": "2026-10-30",
    "author": "Vimbre",
    "sections": [
      {
        "heading": "Stabilise the work before rebuilding the history",
        "paragraphs": [
          "An unexpected departure creates two immediate problems: keeping important work moving and establishing what is actually known. Appoint a continuity owner and record verified facts separately from assumptions.",
          "Coordinate with HR, IT and the appropriate manager using your company’s approved departure process. The continuity checklist below covers operational work; it does not replace employment advice or your organisation’s access and retention policies."
        ]
      },
      {
        "heading": "First: identify urgent commitments",
        "paragraphs": [
          "Check the shared calendar, authorised task records and approved team files for deadlines, customer commitments and recurring duties. Ask the relevant stakeholders to confirm the next action and consequence of delay.",
          "Create one triage list with urgency, a temporary owner and the next check-in. Do not assume that the absence of a task in a system means no commitment exists."
        ]
      },
      {
        "heading": "Next: preserve access and evidence appropriately",
        "paragraphs": [
          "Ask authorised administrators to manage account access, business records and any retention requirements. Use approved shared access rather than signing in with the departing employee’s credentials.",
          "Avoid copying private communications into a general handover. Limit access to people who need it, and record the source of recovered work context so colleagues can distinguish evidence from recollection."
        ]
      },
      {
        "heading": "Then: reconstruct decisions and allocate cover",
        "paragraphs": [
          "For each priority, find the most recent agreed decision, the reason and the stakeholder who can confirm it. Mark missing context as a gap with a named owner. Agree which work can pause while the team recovers.",
          "Review the triage list daily until urgent work has stable ownership. Once continuity is restored, update role records and recurring duties. Vimbre can help keep this context connected before the next absence."
        ]
      }
    ],
    "template": "UNEXPECTED DEPARTURE — CONTINUITY TRIAGE\nRole / team: [ ]   Continuity owner: [ ]\nDate / time prepared: [ ]\nHR contact: [ ]   Authorised IT contact: [ ]\n\nIMMEDIATE COMMITMENTS (repeat)\nCommitment / deadline: [ ]\nImpact if missed: [ ]\nVerified source / person confirming: [ ]\nTemporary owner / backup: [ ]\nNext action / check-in: [ ]\n\nACCESS AND RECORDS\nSystem / business record needed: [ ]\nAuthorised administrator: [ ]\nApproved access / retention action: [ ]\nStatus / completion date: [ ]\n\nCONTEXT GAPS\nQuestion: [ ]\nKnown facts and source: [ ]\nUnverified assumption (label clearly): [ ]\nWho can confirm / by when: [ ]\n\nCOVER DECISIONS\nWork continuing / owner: [ ]\nWork paused / stakeholder agreement: [ ]\nEscalation threshold / contact: [ ]\n\nRECOVERY REVIEW\nNext review date: [ ]\nRemaining operational risk: [ ]\nRole records / routine instructions updated by: [ ]",
    "faq": [
      {
        "question": "What should we do first when an employee leaves unexpectedly?",
        "answer": "Appoint a continuity owner, identify urgent commitments and coordinate with HR and authorised IT administrators. Separate verified information from assumptions and allocate temporary task owners."
      },
      {
        "question": "How can we recover missing work context?",
        "answer": "Review authorised business records and ask relevant stakeholders to confirm decisions and next steps. Record the source, flag uncertainty and give every unresolved gap an owner."
      }
    ]
  },
  {
    "slug": "annual-leave-handover-notes",
    "title": "Annual leave handover notes",
    "description": "A concise annual leave handover template for dates, cover, recurring work and a smooth return.",
    "published": "2026-10-30",
    "author": "Vimbre",
    "sections": [
      {
        "heading": "Make cover easy to pick up",
        "paragraphs": [
          "Annual leave notes should explain what needs attention while you are away, what can wait and who can make decisions. Begin with the dates and cover arrangement rather than a history of every project.",
          "Agree the cover with your manager and colleague before sharing the notes. State the return date and time zone where relevant. Avoid promising availability while on leave unless that has been explicitly agreed."
        ]
      },
      {
        "heading": "Prioritise the work that falls inside your leave",
        "paragraphs": [
          "Check deadlines and routine duties for the actual absence period. Give each item a next action, owner and source link. Include the expected response if a dependency slips.",
          "Example: “The weekly supplier check is due Thursday. Use [checklist], log exceptions in [record], and escalate a missing certificate to [manager]. The monthly review can wait until I return.”"
        ]
      },
      {
        "heading": "Set boundaries and escalation routes",
        "paragraphs": [
          "Explain which decisions your cover can make and which need approval. List a manager or backup contact for urgent issues. Confirm that the cover person can access the records before your leave starts.",
          "Keep the notes in the normal shared work location. Do not include passwords, personal travel details or customer information that the cover person does not need."
        ]
      },
      {
        "heading": "Close the loop on return",
        "paragraphs": [
          "Ask your cover to record what changed, new decisions and any work still outstanding. Review the notes together and explicitly take back ongoing tasks.",
          "Vimbre can connect temporary cover, tasks and decision context. Whether you use Vimbre or a document, the return update is part of the handover, not an optional extra."
        ]
      }
    ],
    "template": "ANNUAL LEAVE HANDOVER\nName / role: [ ]\nAway from: [ ]   Return date / time zone: [ ]\nPrimary cover: [ ]   Backup: [ ]\nManager / urgent escalation: [ ]\nLast updated: [ ]\n\nDURING MY LEAVE (repeat)\nTask / recurring duty: [ ]\nDue date: [ ]   Cover owner: [ ]\nCurrent status: [ ]\nNext action / instructions: [ ]\nSource / file link: [ ]\nIf blocked: [ ]\n\nCAN WAIT UNTIL I RETURN\nItem / reason / next review date: [ ]\n\nDECISIONS AND LIMITS\nCover can decide: [ ]\nApproval needed for: [ ]\nExisting decision / reason / evidence: [ ]\n\nBEFORE LEAVE\n[ ] Cover agreed and capacity confirmed\n[ ] Links and permissions tested\n[ ] Stakeholders told who to contact\n[ ] Routine deadlines checked\n\nCOVER RETURN NOTES\nWhat changed / date / record link: [ ]\nNew decision / agreed by / reason: [ ]\nOutstanding task / owner / due date: [ ]\nOwnership returned on: [ ]",
    "faq": [
      {
        "question": "What should annual leave handover notes include?",
        "answer": "Include absence and return dates, the cover person, work due during leave, instructions, access links, escalation contacts and decisions that require approval."
      },
      {
        "question": "Should handover notes include tasks that can wait?",
        "answer": "Yes. Label work that can wait and agree its next review date so the cover person can focus on the commitments that fall during the absence."
      }
    ]
  },
  {
    "slug": "knowledge-loss-when-staff-leave",
    "title": "Knowledge loss when staff leave",
    "description": "A practical knowledge risk register and capture plan for decisions, recurring work and key relationships.",
    "published": "2026-10-30",
    "author": "Vimbre",
    "sections": [
      {
        "heading": "Find the knowledge that only one person holds",
        "paragraphs": [
          "Knowledge loss is not just a missing file. Teams can lose the reason a decision was made, the warning signs in a process, the history of a relationship or the sequence needed to finish routine work.",
          "Start with work that would stall if its owner were unavailable tomorrow. Ask what another colleague would need to understand and carry it out without relying on that person’s memory."
        ]
      },
      {
        "heading": "Build a small knowledge risk register",
        "paragraphs": [
          "For each important responsibility, record the current owner, the consequence of losing the context, where the instructions live and whether someone else has tested them. Prioritise high-impact work with no verified backup.",
          "For example: “Supplier renewal — only one person knows the approval sequence; renewal is next month; capture the steps and decision history this week, then ask the backup to walk through them.”"
        ]
      },
      {
        "heading": "Capture reasons as well as steps",
        "paragraphs": [
          "A checklist explains how to act, but a decision record explains when to change course. Record the decision, reason, who agreed it, date, supporting evidence and the condition that should trigger a review.",
          "For relationships, document the business purpose and approved contact route. Keep personal commentary and unnecessary sensitive details out of shared records."
        ]
      },
      {
        "heading": "Test the backup before you need it",
        "paragraphs": [
          "Ask the backup to complete a representative task using the record. Note where they needed help and improve those instructions. Set a review date tied to a work cycle or a material change.",
          "Vimbre keeps discussions, decisions and actions connected with role records and handovers. That can reduce the effort of rebuilding context, but a named owner and regular review still matter."
        ]
      }
    ],
    "template": "KNOWLEDGE CONTINUITY REGISTER\nTeam: [ ]   Register owner: [ ]\nReview date: [ ]\n\nKNOWLEDGE RISK (repeat)\nResponsibility / process: [ ]\nCurrent knowledge owner: [ ]\nBusiness impact if unavailable: [ ]\nNext critical date: [ ]\nRisk priority / reason: [ ]\nExisting record / location: [ ]\nNamed backup: [ ]\nLast backup walkthrough / result: [ ]\nGap to close / owner / due date: [ ]\n\nDECISION CAPTURE\nDecision: [ ]   Reason: [ ]\nAgreed by / date: [ ]\nEvidence / source link: [ ]\nWhen to review: [ ]\n\nPROCESS CAPTURE\nInputs / location: [ ]\nSteps / approval points: [ ]\nWarning signs / escalation route: [ ]\nOutput / completion check: [ ]\n\nCONTINUITY CHECK\n[ ] Backup can find the latest record\n[ ] Access tested through approved channels\n[ ] Representative task completed from instructions\n[ ] Missing context assigned to an owner\nNext review / owner: [ ]",
    "faq": [
      {
        "question": "What knowledge is most at risk when staff leave?",
        "answer": "Decision reasons, undocumented process steps, upcoming commitments and relationship history are often vulnerable when only one person can explain them. Start with responsibilities that have no tested backup."
      },
      {
        "question": "How do we check whether knowledge has really transferred?",
        "answer": "Ask another person to find the current record and carry out a representative task. Record where they need help, improve the instructions and repeat the check."
      }
    ]
  }
]
