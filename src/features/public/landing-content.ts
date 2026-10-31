// Public product copy and pricing. Keep capability claims aligned with the shipped product.
export const landingTitle = 'Vimbre | Understand the why'
export const definition = 'Vimbre turns conversations into reviewed actions, keeps decisions and role records connected, and prepares handovers for the people who cover the work.'
export const heroCopy = {
  headline: 'Understand the why',
  supporting: 'Bring in conversations from your connected tools or paste them into Vimbre. Review suggested tasks and decisions, then keep the work and its context together so your team knows what happened, why and what needs attention next.',
}
export const storySummary = 'Example: paste a conversation, request task and decision drafts, accept the details, save the reviewed drafts, then select work for a handover and submit it to a manager.'
export const record = [
  ['Decision', 'Move supplier reviews to monthly'],
  ['Why', 'To reduce meeting load and focus on key updates'],
  ['Date', '9 Nov 2026'],
  ['Owner', 'Operations'],
  ['Next step', 'Share the review notes by 12 Nov 2026'],
]
export const faq = [
  ['Is Vimbre a chat or project management tool?', 'No. Vimbre is designed to work alongside your existing tools. It keeps the decisions, actions, role information and handover context behind the work connected.'],
  ['Does Vimbre confirm work automatically?', 'No. Drafts are stored privately for review; only you can confirm them. Optional Watch rules must be set up and enabled by you; they can prepare drafts, not confirmed tasks.'],
  ['What happens when I hit my AI limit?', 'AI drafting pauses until the allowance resets or your company upgrades. Your saved records, tasks and manual entry remain available.'],
  ['Which tools can I connect?', 'Pasting email text, conversations or notes is available now. You can connect Microsoft Teams, Trello, Slack and Outlook when your company allows the tool. GitHub, Notion and Asana are being prepared; Yahoo Mail requires provider approval. You choose the account and approve access. Some organisations require approval from their IT administrator.'],
  ['How is company information protected?', 'Access follows company roles and permissions. Capture sources and pending drafts remain private to their owner; confirmed records follow the company access rules. Contact support@vimbre.com for specific privacy or retention questions.'],
]
// Request ceilings checked against the live ai_limits configuration on 28 October 2026.
// These are requests across AI tools, not a promise of this many generated task cards.
export const plans = [
  { name: 'Free', price: '£0', amount: 0, seats: 3, size: 'Up to 3 people', positioning: 'Start with your tasks and a small shared AI allowance.', items: ['15 AI requests / month · up to 3 / day', '100 chat messages / month', '100 MB of uploads', 'No card required'] },
  { name: 'Starter', price: '£29', amount: 29, seats: 10, size: 'Up to 10 people', positioning: 'For a small team keeping work ready for cover.', items: ['Up to 500 AI requests / month', 'Daily ceiling: 40 AI requests', 'AI usage control', 'Tasks, role records and reviewed handovers'] },
  { name: 'Growth', price: '£99', amount: 99, seats: 50, size: 'Up to 50 people', positioning: 'More people and more room for AI drafting.', items: ['Up to 3,000 AI requests / month', 'Daily ceiling: 200 AI requests', 'AI usage control', 'Five times the Starter team capacity'] },
  { name: 'Business', price: '£249', amount: 249, seats: 250, size: 'Up to 250 people', positioning: 'A larger company allowance for wider use.', items: ['Up to 15,000 AI requests / month', 'Daily ceiling: 1,000 AI requests', 'AI usage control', 'Five times the Growth team capacity'] },
  { name: 'Enterprise', price: 'Custom', amount: null, seats: null, size: '250+ people', positioning: 'Discuss your team size, allowance and rollout.', items: ['Custom AI allowance and usage control', 'Rollout and access requirements review'] },
]
export const pricingDisclosure = 'Subscriptions bill monthly per company. AI request ceilings are subject to daily limits, AI usage control and workspace settings. Long requests can use the allowance sooner.'
export const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': 'https://vimbre.com/#organization', name: 'Vimbre', legalName: 'Genade Global Services Ltd', url: 'https://vimbre.com/', logo: 'https://vimbre.com/favicon-192.png', sameAs: ['https://x.com/Vimbrehq', 'https://www.instagram.com/vimbrehq/', 'https://www.tiktok.com/@vimbrehq'] },
    { '@type': 'WebSite', '@id': 'https://vimbre.com/#website', name: 'Vimbre', url: 'https://vimbre.com/', publisher: { '@id': 'https://vimbre.com/#organization' } },
    { '@type': 'SoftwareApplication', name: 'Vimbre', url: 'https://vimbre.com/', applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
      description: definition,
      publisher: { '@id': 'https://vimbre.com/#organization' }, offers: plans.filter(plan=>plan.amount!==null).map(plan=>({'@type':'Offer',name:plan.name,price:plan.amount,priceCurrency:'GBP',url:'https://vimbre.com/#pricing'})) },
    { '@type': 'FAQPage', mainEntity: faq.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) },
  ],
}
