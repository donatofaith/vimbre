// Public product copy and pricing. Keep capability claims aligned with the shipped product.
export const landingTitle = 'Vimbre | Turn Conversations into Actions and Handovers'
export const definition = 'Vimbre turns conversations into reviewed actions, keeps decisions and role records connected, and prepares handovers for the people who cover the work.'
export const heroCopy = {
  headline: 'Turn conversations into work people can pick up.',
  supporting: 'Paste a conversation or connect your tools. Vimbre AI drafts the actions, you check them, and the full picture is ready the day someone covers for you.',
}
export const storySummary = 'Example: paste a conversation, review Vimbre AI draft actions, confirm what is correct, then prepare a handover showing what comes first.'
export const record = [
  ['Decision', 'Move supplier reviews to monthly'],
  ['Why', 'To reduce meeting load and focus on key updates'],
  ['Date', '9 Nov 2026'],
  ['Owner', 'Operations'],
  ['Next step', 'Share the review notes by 12 Nov 2026'],
]
export const faq = [
  ['What is Vimbre?', 'Vimbre turns conversations into reviewed actions, connects decisions with the work that follows, and helps someone covering a role understand what matters first.'],
  ['Is Vimbre a chat or project management tool?', 'No. Vimbre is designed to work alongside your existing tools. It keeps the decisions, actions, role information and handover context behind the work connected.'],
  ['How does Vimbre AI work?', 'You start a draft from text or a selected source. Vimbre AI proposes actions and context for you to review. Check names, dates and wording, then edit or confirm only what the source supports.'],
  ['Does Vimbre confirm work automatically?', 'No. Drafts are stored privately for review; only you can confirm them. Optional Watch rules must be set up and enabled by you; they can prepare drafts, not confirmed tasks.'],
  ['What happens when I hit my AI limit?', 'AI drafting pauses until the allowance resets or your workspace admin changes it. Nothing else breaks: your saved records, tasks and manual entry continue to work.'],
  ['Which tools can I connect?', 'Pasting email text, conversations or notes is available now. You can connect Gmail, Google Drive, Outlook, Microsoft Teams, Slack and Trello when your company allows the tool. You choose the account and approve access. Some organisations require approval from their IT administrator.'],
  ['How does a handover work?', 'Prepare an editable handover from your role information, confirmed work and notes. Review what is included and share a time-limited cover guide where appropriate.'],
  ['How is company information protected?', 'Access follows company roles and permissions. Capture sources and pending drafts remain private to their owner; confirmed records follow the company access rules. Contact support@vimbre.com for specific privacy or retention questions.'],
  ['Are subscriptions and plan limits active?', 'The amounts on this page are proposed monthly bundles for discussion. Checkout and plan-specific entitlements are not enabled yet, The configured monthly AI request ceilings are 500 for Starter, 3,000 for Growth and 15,000 for Business. Daily and spend safeguards can pause drafting sooner; your workspace shows its remaining allowance.'],
]
// Request ceilings checked against the live ai_limits configuration on 28 October 2026.
// These are requests across AI tools, not a promise of this many generated task cards.
export const plans = [
  { name: 'Starter', price: '£29', amount: 29, seats: 10, size: 'Up to 10 people', positioning: 'For a small team keeping work ready for cover.', items: ['Up to 500 AI requests / month', 'Daily ceiling: 40 AI requests', 'Company AI spend safeguard applies', 'Tasks, role records and reviewed handovers'] },
  { name: 'Growth', price: '£99', amount: 99, seats: 50, size: 'Up to 50 people', positioning: 'More people and more room for AI drafting.', items: ['Up to 3,000 AI requests / month', 'Daily ceiling: 200 AI requests', 'Higher company AI spend safeguard', 'The same review and cover controls'] },
  { name: 'Business', price: '£249', amount: 249, seats: 250, size: 'Up to 250 people', positioning: 'A larger company allowance for wider use.', items: ['Up to 15,000 AI requests / month', 'Daily ceiling: 1,000 AI requests', 'Higher company AI spend safeguard', 'The same source and record privacy rules'] },
  { name: 'Enterprise', price: 'Custom', amount: null, seats: null, size: '250+ people', positioning: 'Discuss your team size, allowance and rollout.', items: ['Custom AI allowance and spend safeguards', 'Rollout and access requirements review', 'SSO is not available yet', 'Audit export is not available yet'] },
]
export const pricingDisclosure = 'Prices are proposed monthly company bundles; paid subscriptions and checkout are not active yet. AI figures are configured request ceilings, subject to daily limits, spend safeguards and workspace settings. Long requests can use the allowance sooner. All plans share the six connectors, manual entry, manager review and approved cover controls; per-plan connector caps and history-retention periods are not enforced. SSO and audit export are not available. Signup starts a trial without a card.'
export const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'SoftwareApplication', name: 'Vimbre', url: 'https://vimbre.com/', applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
      description: definition,
      publisher: { '@type': 'Organization', name: 'Genade Global Services Ltd', url: 'https://vimbre.com/' } },
    { '@type': 'FAQPage', mainEntity: faq.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) },
  ],
}
