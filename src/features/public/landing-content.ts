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
  ['Does Vimbre save AI drafts automatically?', 'No. A normal draft stays private until you review it and confirm it. Optional Watch rules must be set up and enabled by you; they can prepare drafts, not confirmed tasks.'],
  ['What happens when I hit my AI limit?', 'AI drafting pauses until the allowance resets or your workspace admin changes it. Nothing else breaks: your saved records, tasks and manual entry continue to work.'],
  ['Which tools can I connect?', 'Pasting email text, conversations or notes is available now. Vimbre has connection adapters for Gmail, Google Drive, Outlook, Microsoft Teams, Slack and Trello, but each needs provider registration, consent and company setup before it can be used.'],
  ['How does a handover work?', 'Prepare an editable handover from your role information, confirmed work and notes. Review what is included and share a time-limited cover guide where appropriate.'],
  ['How is company information protected?', 'Access follows company roles and permissions. Capture sources and pending drafts remain private to their owner; confirmed records follow the company access rules. Contact support@vimbre.com for specific privacy or retention questions.'],
  ['Are subscriptions and plan limits active?', 'The amounts on this page are proposed monthly bundles for discussion. Checkout and plan-specific entitlements are not enabled yet, and monthly AI draft caps will be published only after the cost and allowance model is confirmed.'],
]
export const plans = [
  { name: 'Starter', price: '£29', amount: 29, seats: 10, size: 'Up to 10 people', positioning: 'Put the essential work history in one place.', items: ['My Day tasks, dates and outcomes', 'Decision and role records', 'AI drafts on request, within your allowance', 'Handover and cover guides'] },
  { name: 'Growth', price: '£99', amount: 99, seats: 50, size: 'Up to 50 people', positioning: 'Give managers a clearer view of the work they cover.', items: ['Everything in Starter', 'Manager review and approvals', 'Team readiness overview', 'Department-level context'] },
  { name: 'Business', price: '£249', amount: 249, seats: 250, size: 'Up to 250 people', positioning: 'Manage shared work across a larger organisation.', items: ['Everything in Growth', 'Company AI allowance controls', 'Connected-source permissions', 'Role change history'] },
  { name: 'Enterprise', price: 'Custom', amount: null, seats: null, size: '250+ people', positioning: 'Plan a rollout around your organisation.', items: ['Custom team size and rollout', 'Security and access review', 'Discuss advanced identity and audit needs', 'SSO and audit export are not available yet'] },
]
export const pricingDisclosure = 'These are proposed monthly bundles, not active subscriptions. Checkout, plan-specific feature limits and per-plan connection caps are not enabled yet. Paste is available now; external tool connections require provider setup and consent. AI drafting uses each workspace allowance; monthly per-plan caps will be published after costs are verified.'
export const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'SoftwareApplication', name: 'Vimbre', url: 'https://vimbre.com/', applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
      description: definition,
      publisher: { '@type': 'Organization', name: 'Genade Global Services Ltd', url: 'https://vimbre.com/' } },
    { '@type': 'FAQPage', mainEntity: faq.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) },
  ],
}
