// Public product copy and pricing. Keep capability claims aligned with the shipped product.
export {definition,landingTitle} from './public-content'
import {definition,features,searchTagline} from './public-content'
export const heroCopy = {
  headline: searchTagline,
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
  ['Can I use Vimbre on my own?', 'Yes. Choose As an Individual or As a sole founder when you create your account. Company accounts are available for teams.'],
  ['Which tools can I connect?', 'Pasting email text, conversations or notes is available now. Connection options cover Microsoft Teams, Trello, Slack, Outlook, GitHub, Notion and Asana, subject to provider setup and company permission. Yahoo Mail does not currently have a direct connection. You choose the account and approve access. Some organisations require approval from their IT administrator.'],
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
export const socialProfiles = [
  {label: 'LinkedIn', url: 'https://www.linkedin.com/company/vimbrehq/', icon: 'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 10h4v11H3zm6 0h4v1.6c.7-1.1 1.9-1.9 3.7-1.9 3.4 0 4.3 2.2 4.3 5V21h-4v-5.6c0-1.5-.3-2.5-1.8-2.5-1.6 0-2.2 1.2-2.2 2.5V21H9z'},
  {label: 'X', url: 'https://x.com/Vimbrehq', icon: 'M18.9 2H22l-6.8 7.8L23.2 22H17l-4.9-7.3L5.7 22H2.5l7.3-8.4L2 2h6.4l4.4 6.6L18.9 2ZM17.8 20h1.7L7.5 4H5.7z'},
  {label: 'Instagram', url: 'https://www.instagram.com/vimbrehq/', icon: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.5-3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z'},
  {label: 'TikTok', url: 'https://www.tiktok.com/@vimbrehq', icon: 'M14 2h3c.2 2.4 1.6 4 4 4.3v3.1a8 8 0 0 1-4-1.3v7.6A6.3 6.3 0 1 1 11 9.4v3.2a3.2 3.2 0 1 0 3 3.1V2Z'},
] as const

export const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': 'https://vimbre.com/#organization', name: 'Vimbre', legalName: 'Genade Global Services Ltd', url: 'https://vimbre.com/', logo: 'https://vimbre.com/favicon-192.png', sameAs: socialProfiles.map(profile => profile.url) },
    { '@type': 'WebSite', '@id': 'https://vimbre.com/#website', name: 'Vimbre', url: 'https://vimbre.com/', publisher: { '@id': 'https://vimbre.com/#organization' } },
    { '@type': 'SoftwareApplication', name: 'Vimbre', url: 'https://vimbre.com/', featureList:features, applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
      description: definition,
      publisher: { '@id': 'https://vimbre.com/#organization' }, offers: plans.map(plan=>({'@type':'Offer',name:plan.name,...(plan.amount===null?{description:'Custom pricing for 250+ people'}:{price:plan.amount,priceCurrency:'GBP',priceSpecification:{'@type':'UnitPriceSpecification',price:plan.amount,priceCurrency:'GBP',unitText:'month'}}),url:'https://vimbre.com/pricing#plan-'+plan.name.toLowerCase()})) },
    { '@type': 'FAQPage', mainEntity: faq.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) },
  ],
}
