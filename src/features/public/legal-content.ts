// Transcribed verbatim from the owner-supplied documents on 30 October 2026.
export type LegalBlock = {kind: 'paragraph' | 'subheading'; text: string} | {kind: 'list'; items: string[]}
export type LegalDocument = {title: string; updated: string; introduction?: string[]; sections: {heading: string; paragraphs?: string[]; blocks?: LegalBlock[]}[]}
export const competitionDocument: LegalDocument = {
    title: 'Stars and competition terms',
    updated: '27 October 2026',
    sections: [
      {heading:'Purpose and limits',paragraphs:['Stars recognise selected activity recorded in Vimbre. They are not a performance score and should not be used in employee reviews, pay decisions or ratings. They do not measure the quality, difficulty or full value of someone’s work.']},
      {heading:'Your choice and visibility',paragraphs:['Competition is off until a company administrator enables it. Each person separately chooses whether to appear. Individual rankings are limited to opted-in people in the same team. Private task titles, conversations and decision content are not shown in rankings. You can hide yourself in Settings.']},
      {heading:'What is measured',paragraphs:['Eligible dated tasks must exist for at least ten minutes before completion. Task credit is weighted by priority and estimated time. Approved cover tasks earn double credit. The daily cap is 15 stars. Undo removes an award, and completing the same task again earns no additional credit. Splitting work into smaller tasks must not be used to increase credit.']},
      {heading:'Responsible use',paragraphs:['Companies should explain the measurements and audience to their people. Stars must not disadvantage people who do slow, difficult or less visible work. Leave and absence must not be treated as poor performance.']},
    ],
  }
export const legalDocuments: Record<'privacy' | 'terms', LegalDocument> = {
  "privacy": {
    "title": "Vimbre Privacy Policy",
    "updated": "Version 1.0 · Effective from 1 November 2026 · Drafted Oct 28, 2026",
    "introduction": [
      "This policy explains how Genade Global Services Ltd handles personal information in Vimbre. It applies from 1 November 2026."
    ],
    "sections": [
      {
        "heading": "1. Who we are",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "Vimbre is a service operated by Genade Global Services Ltd, a company registered in England and Wales with company number 15149519, whose registered office is at Office 10568 High Street North, London, England, E6 2JA (\"we\", \"us\", \"our\")."
          },
          {
            "kind": "paragraph",
            "text": "We are registered with the Information Commissioner's Office (ICO) under registration number ZB665494."
          },
          {
            "kind": "paragraph",
            "text": "You can contact us about this policy at support@vimbre.com or by post at the address above. Our data protection contact is the Data Protection Lead at Genade Global Services Ltd, reachable at the same email address."
          }
        ]
      },
      {
        "heading": "2. What this policy covers",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "This policy explains how we collect, use, share and protect personal information when you visit our website, create an account, or use Vimbre (the \"Service\"). It applies to visitors, account holders and people whose details appear in content that customers add to Vimbre."
          },
          {
            "kind": "paragraph",
            "text": "We act in two different roles:"
          },
          {
            "kind": "list",
            "items": [
              "As a controller. For information about you as a visitor, account holder, or customer contact (for example your name, email address, billing details and how you use the Service), we decide how and why the information is used.",
              "As a processor. For the notes, emails, chat messages, documents and other content that a customer or its team members add to Vimbre (\"Customer Content\"), the customer's organisation decides how and why it is used, and we process it on its behalf under our Terms and Conditions and our data processing terms. If you are a member of an organisation that uses Vimbre, your employer or organisation is the controller of Customer Content and you should read its privacy notice as well."
            ]
          }
        ]
      },
      {
        "heading": "3. Information we collect",
        "blocks": [
          {
            "kind": "subheading",
            "text": "Information you give us"
          },
          {
            "kind": "list",
            "items": [
              "Account details: name, work email address, password (stored in protected form), job title and organisation name.",
              "Profile and workspace details: team names, roles, handover recipients and settings you choose.",
              "Customer Content: text, notes, emails, chat messages and files you paste, type or upload, and the actions, decisions, tasks and handovers created from them.",
              "Messages you send us: support requests, feedback and survey replies.",
              "Billing details: billing name, address, VAT number and subscription choices. Card details are collected and held by our payment provider, not by us."
            ]
          },
          {
            "kind": "subheading",
            "text": "Information we collect automatically"
          },
          {
            "kind": "list",
            "items": [
              "Usage and activity data: pages and features used, actions taken, timestamps, and event records that show how the Service is used and help us keep it secure.",
              "Device and connection data: IP address, browser type, device type, operating system, language and approximate location based on IP address.",
              "Cookies and similar technologies, described in section 11."
            ]
          },
          {
            "kind": "subheading",
            "text": "Information from others"
          },
          {
            "kind": "list",
            "items": [
              "From your organisation: an administrator may invite you, create your account or add you to a team.",
              "From other users: a colleague may mention you in a note, task or handover.",
              "From service providers: for example payment confirmation from our payment provider."
            ]
          },
          {
            "kind": "paragraph",
            "text": "We do not knowingly ask you to give us special category data (such as health, religion or trade union membership) or criminal offence data. Please do not add this kind of information to Vimbre unless your organisation has a lawful reason to do so and has told us in advance."
          }
        ]
      },
      {
        "heading": "4. How we use information and our legal bases",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "Under UK data protection law we must have a lawful basis for each use of your personal information. We rely on the following."
          },
          {
            "kind": "list",
            "items": [
              "To provide the Service (contract). Creating and managing accounts, storing Customer Content, producing drafts and handovers, sending service messages, and providing support. Lawful basis: performance of a contract with you or your organisation. Where we act as a processor, we follow the customer's instructions.",
              "To take payment and keep financial records (contract and legal obligation).",
              "To keep the Service secure and prevent misuse (legitimate interests, and legal obligation where it applies). Monitoring for fraud, abuse, spam and security incidents.",
              "To improve and develop the Service (legitimate interests). Understanding which features are used so that we can fix problems and make Vimbre better. We use aggregated or de identified information wherever we can.",
              "To communicate with you (contract and legitimate interests). Service notices, security alerts, changes to our terms and replies to your questions.",
              "To send marketing (consent, or legitimate interests for business contacts where the law allows). You can opt out at any time.",
              "To comply with the law and respond to lawful requests (legal obligation)."
            ]
          },
          {
            "kind": "paragraph",
            "text": "We do not sell personal information. We do not use Customer Content for advertising."
          }
        ]
      },
      {
        "heading": "5. Artificial intelligence features",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "Vimbre uses artificial intelligence to draft actions, decisions, summaries and handovers from content you provide. This is how it works in practice:"
          },
          {
            "kind": "list",
            "items": [
              "Drafts only. AI output is a suggestion. Nothing created by AI is saved to your workspace until a person has checked it and chosen to keep it.",
              "On request. AI processing runs when you or a team member asks for it, and it counts against your organisation's plan allowance.",
              "Service providers. To produce drafts, the relevant text is sent securely to our AI service providers listed in section 6. They process it only to return the result to us. Under the commercial terms we have agreed with our AI provider, Customer Content sent to it is not used to train its models. We do not use Customer Content to train any models of our own.",
              "Accuracy. AI can make mistakes. You are responsible for checking drafts before relying on them or handing them over.",
              "No solely automated decisions. We do not make decisions about individuals that have legal or similarly significant effects using automated processing alone.",
              "Privacy controls. Items marked private are not included in handovers or shared views."
            ]
          }
        ]
      },
      {
        "heading": "6. Who we share information with",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "We share personal information only as needed and only with:"
          },
          {
            "kind": "list",
            "items": [
              "Your organisation. Administrators and other team members can see content, handovers and activity according to the permissions set in your workspace.",
              "Service providers (processors) that help us run Vimbre, under written contracts that require them to protect your information:",
              "Cloud hosting and database providers: the infrastructure providers that host and store the Service on our behalf. Details are available on request.",
              "AI service providers: Anthropic, PBC (United States), which produces AI drafts from content sent to it.",
              "Payment processing: Stripe Payments Europe Ltd and its affiliates.",
              "Email delivery and messaging: Brevo (Sendinblue SAS, France). Customer support and website analytics tools: only providers that are bound by written data protection terms.",
              "Professional advisers such as lawyers, accountants and insurers, where necessary.",
              "Authorities, where we are legally required to disclose information or need to protect rights, safety or property.",
              "A buyer or investor, if our business or assets are sold, merged or financed. We will tell you and the new owner must honour this policy."
            ]
          },
          {
            "kind": "paragraph",
            "text": "A current list of our sub processors is available on request at support@vimbre.com."
          },
          {
            "kind": "paragraph",
            "text": "Third party links. Our website and the Service may link to third party websites or services. We are not responsible for their privacy practices, and we encourage you to read their privacy policies."
          }
        ]
      },
      {
        "heading": "7. International transfers",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "Some of our providers are located, or process information, outside the United Kingdom. When we transfer personal information out of the UK, we make sure it is protected by an appropriate safeguard, such as a UK adequacy regulation, the UK International Data Transfer Agreement or the UK Addendum to the EU Standard Contractual Clauses, together with additional measures where needed. Our AI service provider, Anthropic, is based in the United States, and we rely on an appropriate transfer safeguard for that processing. You can ask us for details of the safeguards used."
          }
        ]
      },
      {
        "heading": "8. How long we keep information",
        "blocks": [
          {
            "kind": "list",
            "items": [
              "Account information: for as long as your account is active, and for a limited period afterwards to meet legal, tax and dispute resolution needs.",
              "Customer Content: for as long as the customer's account is active. When something is deleted in Vimbre it is first held in a recoverable state for 30 days and is then permanently deleted from live systems. After an account closes, we delete or return Customer Content within 30 days unless the law requires us to keep it. Backups are overwritten on a rolling cycle of up to 35 days.",
              "Billing records: for six years to meet tax and accounting requirements.",
              "Support messages: for two years after the matter is closed.",
              "Usage and security logs: for up to 12 months."
            ]
          },
          {
            "kind": "paragraph",
            "text": "When we no longer need information, we delete or irreversibly de identify it."
          }
        ]
      },
      {
        "heading": "9. Security",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "We use technical and organisational measures designed to protect personal information, including encryption in transit, access controls based on need, separation of customer workspaces, activity logging, and regular review of our systems and suppliers. No system is perfectly secure. If a personal data breach affects your rights and freedoms, we will notify you and the ICO as the law requires. You can help by keeping your password private and telling us quickly if you suspect misuse of your account."
          }
        ]
      },
      {
        "heading": "10. Your rights",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "Under UK data protection law you have the right to:"
          },
          {
            "kind": "list",
            "items": [
              "be informed about how your information is used;",
              "access a copy of your personal information;",
              "correct information that is wrong or incomplete;",
              "ask us to erase your information in certain situations;",
              "ask us to restrict how we use your information in certain situations;",
              "receive your information in a portable format and ask us to send it to another organisation, where this applies;",
              "object to uses based on legitimate interests and to direct marketing at any time;",
              "withdraw consent at any time, where we rely on consent, without affecting earlier use; and",
              "not be subject to decisions based solely on automated processing that significantly affect you."
            ]
          },
          {
            "kind": "paragraph",
            "text": "To use any of these rights, email support@vimbre.com. We may need to confirm your identity. We will respond within one month, and we may extend this by up to two further months for complex requests, telling you why. There is usually no charge."
          },
          {
            "kind": "paragraph",
            "text": "If your request relates to Customer Content, we may pass it to the controller (your organisation) because it decides how that content is used."
          }
        ]
      },
      {
        "heading": "11. Cookies and similar technologies",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "We use cookies and similar technologies for three purposes:"
          },
          {
            "kind": "list",
            "items": [
              "Strictly necessary: to sign you in, keep your session secure and remember essential settings. These do not need consent.",
              "Preferences: to remember choices such as display settings.",
              "Analytics: to understand how the website and Service are used. We only use these if you accept them through our cookie banner."
            ]
          },
          {
            "kind": "paragraph",
            "text": "You can change your choices at any time using the cookie settings link in our footer or through your browser settings. You can ask us for a list of the cookies we use at support@vimbre.com."
          }
        ]
      },
      {
        "heading": "12. Children",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "Vimbre is for business use and is not intended for anyone under 18. We do not knowingly collect personal information from children. If you believe a child has given us information, contact us and we will delete it."
          }
        ]
      },
      {
        "heading": "13. Marketing",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "We may email you about Vimbre if you have agreed to receive it, or, where the law allows, if you are a business contact and the message is relevant to you. Every marketing email includes an unsubscribe link. You will still receive service messages that we need to send, such as security alerts and billing notices. Our social media accounts are run by us. When you interact with them, the relevant platform's privacy policy also applies."
          }
        ]
      },
      {
        "heading": "14. Changes to this policy",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "We may update this policy from time to time. If we make a material change, we will tell you by email or in the Service before it takes effect. The date at the top shows when it was last updated."
          }
        ]
      },
      {
        "heading": "15. Complaints and contact",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "If you have a concern, please contact us first at support@vimbre.com and we will do our best to put it right. You also have the right to complain to the Information Commissioner's Office:"
          },
          {
            "kind": "paragraph",
            "text": "Information Commissioner's Office, Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF. Helpline: 0303 123 1113. Website: ico.org.uk."
          },
          {
            "kind": "paragraph",
            "text": "Genade Global Services Ltd · Company number 15149519 · Registered in England and Wales · Registered office: Office 10568 High Street North, London, England, E6 2JA"
          }
        ]
      }
    ]
  },
  "terms": {
    "title": "Vimbre Terms and Conditions",
    "updated": "Version 1.0 · Effective from 1 November 2026 · Drafted Oct 28, 2026",
    "introduction": [
      "Please read these Terms carefully. They apply from 1 November 2026."
    ],
    "sections": [
      {
        "heading": "1. About these terms",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "1.1 These terms (the \"Terms\") are an agreement between Genade Global Services Ltd, a company registered in England and Wales with company number 15149519 and registered office at Office 10568 High Street North, London, England, E6 2JA (\"we\", \"us\", \"our\"), and the person or organisation that creates an account or uses Vimbre (\"you\", \"Customer\")."
          },
          {
            "kind": "paragraph",
            "text": "1.2 Vimbre is a work continuity service that helps teams turn notes, messages and other content into clear actions, decisions and handovers (the \"Service\"). It includes our website, web application and any related features."
          },
          {
            "kind": "paragraph",
            "text": "1.3 By creating an account, clicking to accept, or using the Service, you agree to these Terms. If you accept on behalf of an organisation, you confirm that you have authority to bind it, and \"you\" includes that organisation. If you do not agree, do not use the Service."
          },
          {
            "kind": "paragraph",
            "text": "1.4 The Service is for business and professional use only and is not intended for consumers or anyone under 18."
          },
          {
            "kind": "paragraph",
            "text": "1.5 These Terms include our Privacy Policy, our Acceptable Use rules in section 6, and, where Customer Content contains personal information, our data processing terms in Schedule 1 (together with the Terms, the \"Agreement\")."
          }
        ]
      },
      {
        "heading": "2. Your account",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "2.1 You must give accurate information when you register and keep it up to date."
          },
          {
            "kind": "paragraph",
            "text": "2.2 You are responsible for activity under your account, for keeping your login details confidential, and for the people you invite. Tell us promptly at support@vimbre.com if you think your account has been accessed without permission."
          },
          {
            "kind": "paragraph",
            "text": "2.3 Where an organisation owns the workspace, its administrators control membership, roles and settings, and can see and manage content in the workspace in line with those settings. People you invite must also follow these Terms."
          },
          {
            "kind": "paragraph",
            "text": "2.4 Each account is for one named person. Do not share logins."
          }
        ]
      },
      {
        "heading": "3. Plans, free use and trials",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "3.1 We offer a free plan and paid plans. Features, allowances and prices are described on our website pricing page and in your order or checkout screen. Allowances include any limits on AI requests, workspace members or storage."
          },
          {
            "kind": "paragraph",
            "text": "3.2 If we offer a free trial or promotional offer, its length and conditions will be shown when you sign up. Unless we say otherwise, a trial converts to a paid plan only if you choose to subscribe."
          },
          {
            "kind": "paragraph",
            "text": "3.3 We may change free plan features and allowances on reasonable notice. We will not remove access to your Customer Content as a result."
          }
        ]
      },
      {
        "heading": "4. Payment",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "4.1 Paid plans are charged in advance for each billing period (monthly or annually, as selected) in the currency shown at checkout."
          },
          {
            "kind": "paragraph",
            "text": "4.2 Payments are handled by our payment provider, Stripe. You authorise us and Stripe to charge your chosen payment method. We do not store full card details."
          },
          {
            "kind": "paragraph",
            "text": "4.3 Prices are exclusive of VAT and other applicable taxes unless stated. You will pay any tax that applies. You agree to give us accurate billing and tax details."
          },
          {
            "kind": "paragraph",
            "text": "4.4 Subscriptions renew automatically at the end of each billing period at the then current price, unless you cancel before the renewal date. We will give you at least 30 days notice of any price increase to take effect at your next renewal."
          },
          {
            "kind": "paragraph",
            "text": "4.5 You can cancel at any time in your account settings. Cancellation takes effect at the end of the current billing period. Except where these Terms or the law say otherwise, fees already paid are not refundable, and we do not give partial refunds for unused time."
          },
          {
            "kind": "paragraph",
            "text": "4.6 If a payment fails, we may retry it and may suspend or downgrade your account after we have given you reasonable notice. Overdue amounts may carry interest under the Late Payment of Commercial Debts (Interest) Act 1998."
          },
          {
            "kind": "paragraph",
            "text": "4.7 Nothing in this section affects any right you have under the law that cannot be excluded."
          }
        ]
      },
      {
        "heading": "5. Using the Service",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "5.1 We give you a limited right to use the Service during the term of the Agreement for your own internal business purposes. This right is not exclusive, cannot be transferred, and is subject to these Terms."
          },
          {
            "kind": "paragraph",
            "text": "5.2 You are responsible for having the necessary rights, permissions and notices in place for any Customer Content you add, including any personal information about colleagues, clients or others."
          },
          {
            "kind": "paragraph",
            "text": "5.3 You are responsible for your equipment and internet connection and for complying with the laws that apply to your use of the Service."
          }
        ]
      },
      {
        "heading": "6. Acceptable use",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "6.1 You must not, and must not allow anyone else to:"
          },
          {
            "kind": "list",
            "items": [
              "break the law, or infringe or misuse anyone's rights, including privacy and intellectual property rights;",
              "upload material that is unlawful, defamatory, abusive, discriminatory or harmful;",
              "add special category personal data, payment card numbers, or health or criminal records unless we have agreed in writing that your use case allows it;",
              "try to gain unauthorised access to the Service, other accounts, or our systems or networks;",
              "introduce malware, or interfere with or overload the Service;",
              "test the security of the Service without our written permission;",
              "copy, resell, sublicense or provide the Service to others as a competing product, or use it to build a competing product;",
              "reverse engineer or extract source code, except where the law allows it;",
              "use automated means, such as scraping, bots or scripts, to access the Service except through interfaces we provide for that purpose;",
              "use the Service in a way that is intended to mislead people about who wrote or approved something; or",
              "use outputs or the Service in breach of the terms of any AI provider we make available to you."
            ]
          },
          {
            "kind": "paragraph",
            "text": "6.2 We may investigate suspected breaches and may remove content or suspend access to protect the Service or other users."
          }
        ]
      },
      {
        "heading": "7. Customer Content",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "7.1 You keep ownership of everything you add to the Service, and everything you create from it (\"Customer Content\"). We do not claim ownership of it."
          },
          {
            "kind": "paragraph",
            "text": "7.2 You give us a licence to host, copy, process, transmit and display Customer Content only as needed to provide, secure, support and improve the Service for you, and to meet our legal obligations. This licence ends when your Customer Content is deleted, apart from backups that are overwritten in the ordinary cycle and copies we must keep by law."
          },
          {
            "kind": "paragraph",
            "text": "7.3 Items you mark as private are not included in handovers or shared views. You are responsible for choosing what is shared and with whom."
          },
          {
            "kind": "paragraph",
            "text": "7.4 You can export or delete your Customer Content using the tools in the Service. When you delete something, it may remain recoverable for a short period before it is permanently removed. After your account closes we will delete or return Customer Content as described in our Privacy Policy and data processing terms."
          },
          {
            "kind": "paragraph",
            "text": "7.5 We may use aggregated and de identified data about how the Service is used, which does not identify you, your organisation or any individual, to operate and improve the Service."
          }
        ]
      },
      {
        "heading": "8. Artificial intelligence features",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "8.1 The Service uses artificial intelligence to draft actions, decisions, summaries and handovers from content you provide."
          },
          {
            "kind": "paragraph",
            "text": "8.2 AI output is a draft for a person to review. Nothing generated by AI is saved to your workspace until a person has checked it and chosen to keep it."
          },
          {
            "kind": "paragraph",
            "text": "8.3 AI output can be incomplete, out of date or wrong. You are responsible for checking it before you rely on it, hand it over, or share it. AI output is not legal, financial, medical, HR or other professional advice."
          },
          {
            "kind": "paragraph",
            "text": "8.4 AI requests are made on demand and count against your plan allowance. We may limit or pause AI features where use is excessive or abusive."
          },
          {
            "kind": "paragraph",
            "text": "8.5 To produce drafts, we send relevant Customer Content to carefully selected AI service providers. We require them to protect it and to use it only to provide the result to us. Under the commercial terms we have agreed with our AI provider, Customer Content sent to it is not used to train its models, and we do not use Customer Content to train any models of our own."
          },
          {
            "kind": "paragraph",
            "text": "8.6 Similar outputs may be produced for different users. You do not receive exclusive rights in output that is not original to you. As between you and us, you may use the output for your business, subject to these Terms."
          }
        ]
      },
      {
        "heading": "9. Our intellectual property",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "9.1 We and our licensors own the Service, including its software, design, brand, text and graphics. The Agreement does not transfer any of those rights to you."
          },
          {
            "kind": "paragraph",
            "text": "9.2 Vimbre and our logos are our trade marks. You may not use them without our written permission, except to refer to the Service accurately."
          },
          {
            "kind": "paragraph",
            "text": "9.3 If you give us feedback or suggestions, you allow us to use them freely without obligation to you."
          }
        ]
      },
      {
        "heading": "10. Data protection",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "10.1 Each of us will comply with the data protection laws that apply, including the UK GDPR and the Data Protection Act 2018."
          },
          {
            "kind": "paragraph",
            "text": "10.2 For personal information in Customer Content, you are the controller (or processor for your own client) and we are your processor, and the data processing terms apply. For account and billing information, we are a controller as explained in our Privacy Policy."
          },
          {
            "kind": "paragraph",
            "text": "10.3 You confirm that you have a lawful basis and have given the notices needed to add personal information to the Service."
          }
        ]
      },
      {
        "heading": "11. Confidentiality",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "11.1 Each party will keep the other's confidential information secret, use it only for the Agreement, and disclose it only to those who need to know and are bound to keep it confidential, or where the law requires."
          },
          {
            "kind": "paragraph",
            "text": "11.2 Confidential information does not include information that is public without breach, was lawfully known to the recipient before, or is independently developed."
          },
          {
            "kind": "paragraph",
            "text": "11.3 Your Customer Content is your confidential information."
          }
        ]
      },
      {
        "heading": "12. Availability, support and changes",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "12.1 We will use reasonable skill and care to provide the Service and aim to keep it available, but we do not promise it will be uninterrupted or free of errors. We may suspend it for planned maintenance, and will try to give notice where we can."
          },
          {
            "kind": "paragraph",
            "text": "12.2 Support is available at support@vimbre.com during Monday to Friday, 9am to 5pm UK time, excluding public holidays. We aim to respond within two working days."
          },
          {
            "kind": "paragraph",
            "text": "12.3 We may improve and change the Service. If we make a change that materially reduces the core functions you pay for, we will give you reasonable notice and, where you cannot reasonably accept the change, you may cancel and receive a refund for the unused part of your paid period."
          },
          {
            "kind": "paragraph",
            "text": "12.4 We may update these Terms. We will give you at least 30 days notice of a material change by email or in the Service. If you keep using the Service after the effective date, you accept the new Terms. If you do not agree, you may cancel before that date."
          }
        ]
      },
      {
        "heading": "13. Suspension and ending the Agreement",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "13.1 You may stop using the Service and close your account at any time."
          },
          {
            "kind": "paragraph",
            "text": "13.2 We may suspend or end your access immediately by written notice if you materially breach these Terms and do not fix it within 7 days of being told (or immediately where it cannot be fixed or the breach puts the Service or others at risk), if you do not pay when due, or if we are required to by law."
          },
          {
            "kind": "paragraph",
            "text": "13.3 Either of us may end the Agreement by giving 30 days written notice before the end of a billing period."
          },
          {
            "kind": "paragraph",
            "text": "13.4 When the Agreement ends, your right to use the Service stops, and you remain responsible for fees due up to that date. You should export what you need before closing. Sections that by their nature should continue will continue, including sections 7, 9, 11, 14, 15, 16 and 17."
          }
        ]
      },
      {
        "heading": "14. Warranties and disclaimer",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "14.1 We confirm that we have the right to provide the Service and will provide it with reasonable skill and care."
          },
          {
            "kind": "paragraph",
            "text": "14.2 You confirm that you have authority to enter into the Agreement and the rights needed for your Customer Content."
          },
          {
            "kind": "paragraph",
            "text": "14.3 Except as set out in these Terms, and to the fullest extent the law allows, we give no other warranties or conditions, whether express or implied, including about fitness for a particular purpose, uninterrupted use, or that output will be accurate or complete. The Service is provided on an \"as is\" and \"as available\" basis for matters not covered by our express commitments."
          }
        ]
      },
      {
        "heading": "15. Limitation of liability",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "15.1 Nothing in these Terms limits or excludes liability for death or personal injury caused by negligence, for fraud or fraudulent misrepresentation, or for anything else that cannot lawfully be limited or excluded."
          },
          {
            "kind": "paragraph",
            "text": "15.2 Subject to 15.1, we are not liable for any of the following, whether in contract, tort (including negligence), breach of statutory duty or otherwise: loss of profit, revenue, business, goodwill or anticipated savings; loss or corruption of data caused by you or events outside our control; or indirect or consequential loss."
          },
          {
            "kind": "paragraph",
            "text": "15.3 Subject to 15.1, our total liability to you arising out of or in connection with the Agreement in any twelve month period will not exceed the greater of the fees you paid to us in that period and £500."
          },
          {
            "kind": "paragraph",
            "text": "15.4 You are responsible for how you use AI output and for decisions you make using the Service."
          }
        ]
      },
      {
        "heading": "16. Indemnity",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "You will cover our reasonable losses and costs arising from a third party claim that your Customer Content or your use of the Service in breach of these Terms infringes the law or the rights of others. We will tell you promptly of the claim, let you control the defence (we may join with our own counsel at our cost), and give reasonable help at your cost."
          }
        ]
      },
      {
        "heading": "17. General",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "17.1 Entire agreement. The Agreement is the whole agreement between us about the Service and replaces earlier discussions. Neither of us relies on a statement that is not set out in it, except in cases of fraud."
          },
          {
            "kind": "paragraph",
            "text": "17.2 Changes and waiver. A failure or delay in enforcing a right is not a waiver of it."
          },
          {
            "kind": "paragraph",
            "text": "17.3 Severance. If any part of the Agreement is found unenforceable, the rest continues, and the part will be replaced with a valid one that is as close as possible in effect."
          },
          {
            "kind": "paragraph",
            "text": "17.4 Assignment. You may not transfer your rights without our written consent. We may transfer ours to a successor of our business, or to a group company, on notice."
          },
          {
            "kind": "paragraph",
            "text": "17.5 Force majeure. Neither of us is liable for delay or failure caused by events beyond reasonable control, including power or network failure, third party service outages, extreme weather, war, terrorism, strikes or government action. Payment obligations are not excused."
          },
          {
            "kind": "paragraph",
            "text": "17.6 Third party rights. Only you and we may enforce the Agreement. Nobody else may enforce it."
          },
          {
            "kind": "paragraph",
            "text": "17.7 Notices. We may give notice by email to the address on your account or through the Service. You must send notices to hello@vimbre.com and by post to our registered office."
          },
          {
            "kind": "paragraph",
            "text": "17.8 Publicity. We will not name you as a customer in marketing without your written permission."
          },
          {
            "kind": "paragraph",
            "text": "17.9 Relationship. We are independent contractors. Nothing in the Agreement creates a partnership, agency or employment relationship."
          }
        ]
      },
      {
        "heading": "18. Governing law and disputes",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "18.1 The Agreement and any dispute or claim arising from it, including non contractual disputes, is governed by the law of England and Wales."
          },
          {
            "kind": "paragraph",
            "text": "18.2 The courts of England and Wales have exclusive jurisdiction, except that either party may seek urgent relief from any court of competent jurisdiction to protect its intellectual property or confidential information."
          },
          {
            "kind": "paragraph",
            "text": "18.3 Before starting formal proceedings, each of us will try in good faith to settle the dispute by speaking first. Please contact hello@vimbre.com."
          }
        ]
      },
      {
        "heading": "19. Contact",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "Genade Global Services Ltd · Company number 15149519 · Registered in England and Wales · Registered office: Office 10568 High Street North, London, England, E6 2JA · Support and privacy requests: support@vimbre.com · General enquiries and legal notices: hello@vimbre.com"
          }
        ]
      },
      {
        "heading": "Schedule 1: Data Processing Terms",
        "blocks": [
          {
            "kind": "paragraph",
            "text": "This Schedule applies where we process personal information in Customer Content on your behalf. It forms part of the Agreement and meets the requirements of Article 28 of the UK GDPR. In this Schedule, \"controller\", \"processor\", \"personal data\", \"data subject\", \"personal data breach\" and \"processing\" have the meanings given in the UK GDPR."
          },
          {
            "kind": "paragraph",
            "text": "1. Roles. You are the controller of the personal data in Customer Content (or the processor for your own client, in which case we act as your sub processor). We are the processor."
          },
          {
            "kind": "paragraph",
            "text": "2. Details of processing. The subject matter is the provision of the Service. The duration is the term of the Agreement plus the deletion period in section 7.4. The nature of processing is storing, organising, analysing with AI on request, displaying and deleting. The purpose is to provide the Service to you. The personal data is the content you add to the Service, which may include names, work contact details, job roles and any information about work activity in notes, messages and tasks. The data subjects are your staff, clients, suppliers and other people mentioned in Customer Content."
          },
          {
            "kind": "paragraph",
            "text": "3. Our obligations. We will:"
          },
          {
            "kind": "list",
            "items": [
              "process personal data only on your documented instructions, which are the Agreement and your use of the Service, unless the law requires otherwise (and we will tell you first, unless the law forbids it);",
              "make sure that people authorised to process the data are bound by confidentiality;",
              "keep the data secure with the measures in paragraph 8;",
              "respect the conditions in paragraph 4 for sub processors;",
              "help you respond to requests from data subjects, taking into account the nature of the processing;",
              "help you meet your security, breach notification, impact assessment and prior consultation duties, taking into account the information available to us;",
              "at your choice, delete or return personal data when the Agreement ends, and delete existing copies unless the law requires us to keep them; and",
              "give you the information reasonably needed to show that we comply with this Schedule, and allow audits as set out in paragraph 7."
            ]
          },
          {
            "kind": "paragraph",
            "text": "4. Sub processors. You give us general authority to use sub processors. At the date of these Terms they include Anthropic, PBC (AI processing), Brevo (email delivery), Stripe (payments, as an independent controller for payment data) and our infrastructure and hosting providers. We will bind each sub processor by a written contract with data protection obligations no less protective than this Schedule, and we remain responsible for their performance. We will give you at least 14 days notice of a new sub processor by email or in the Service. You may object on reasonable data protection grounds within that time. If we cannot resolve the objection, you may end the affected part of the Service and receive a refund for the unused part of the paid period."
          },
          {
            "kind": "paragraph",
            "text": "5. International transfers. We will transfer personal data outside the United Kingdom only with an appropriate safeguard under UK law, such as an adequacy regulation, the UK International Data Transfer Agreement or the UK Addendum to the EU Standard Contractual Clauses."
          },
          {
            "kind": "paragraph",
            "text": "6. Personal data breaches. We will tell you without undue delay, and where possible within 48 hours, after we become aware of a personal data breach affecting your personal data, and give you the information you reasonably need to meet your own duties."
          },
          {
            "kind": "paragraph",
            "text": "7. Audit. On reasonable written notice, no more than once a year (unless a breach has occurred or a regulator requires it), we will answer your reasonable security and data protection questionnaires and give you the relevant documents. An on site audit may be carried out only where that information is not enough, in working hours, under confidentiality, and at your cost."
          },
          {
            "kind": "paragraph",
            "text": "8. Security measures. We use: encryption of data in transit and at rest where supported by our providers; role based access controls and separation of customer workspaces; authentication controls; activity and event logging; staff confidentiality and need to know access; regular review of suppliers; backups; and a process to find, contain and report security incidents."
          },
          {
            "kind": "paragraph",
            "text": "9. Your responsibilities. You will make sure that you have a lawful basis and have given the required notices for the personal data you add, that your instructions comply with data protection law, and that you do not add data excluded by section 6 of the Terms."
          },
          {
            "kind": "paragraph",
            "text": "10. Liability. Each party's liability under this Schedule is subject to section 15 of the Terms. Nothing in it limits liability that cannot lawfully be limited."
          }
        ]
      }
    ]
  }
}
