// Approved homepage copy, 20 October 2026. Keep schema and visible FAQs in sync.
export const landingTitle = 'Vimbre | Decision Records for Teams and Handovers'
export const definition = 'Vimbre is a shared decision log for teams. It keeps each decision with its reason, date, owner and next step, so whoever covers for a colleague, joins a team or takes over a role can see what happened and what to do first. It works next to the tools you already use.'
export const storySummary = 'Example: a meeting note and an email become one decision record, and a colleague covering for someone who is away can see it.'
export const record = [
  ['Decision', 'Move supplier reviews to monthly'],
  ['Why', 'To reduce meeting load and focus on key updates'],
  ['Date', '12 October'],
  ['Owner', 'Operations'],
  ['Next step', 'Share the review notes'],
]
export const faq = [
  ['What is Vimbre?', 'Vimbre is a shared record of team decisions. It keeps what was decided, when, why, who owns it and what happens next, so the reasons stay with the work when people are away or roles change.'],
  ['Who is Vimbre for?', 'Vimbre is for HR managers, team leads and directors. It helps when someone is on leave, leaves the company, joins a team or changes role, because the person stepping in can see recent decisions, open work and who to speak to.'],
  ['How does Vimbre work?', 'Add a decision from an email, a meeting or your own notes. Vimbre keeps it with its reason, date, owner and next step. When someone needs to cover or take over, they open the record and start from the facts.'],
  ['Does Vimbre replace our existing tools?', 'No. Vimbre works next to your email, notes, calendar and documents. Your team keeps working where it works now, and Vimbre keeps the decisions and reasons that those tools do not hold together.'],
  ['What does Vimbre cost?', 'Plans start at £29 a month for up to 10 people. Larger teams can choose a bigger plan, and organisations over 250 people can talk to us about a custom plan.'],
]
export const plans = [
  { name: 'Starter', price: '£29', amount: 29, size: 'Up to 10 people', items: ['Decision records', 'Tasks and dates', 'Role records', 'Team chat'] },
  { name: 'Growth', price: '£99', amount: 99, size: 'Up to 50 people', items: ['Decision records', 'Tasks and dates', 'Role records', 'Team chat'] },
  { name: 'Business', price: '£249', amount: 249, size: 'Up to 250 people', items: ['Decision records', 'Tasks and dates', 'Role records', 'Team chat'] },
  { name: 'Enterprise', price: 'Custom', amount: null, size: '250 plus', items: ['Decision records', 'Tasks and dates', 'Role records', 'Team chat'] },
]
export const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'SoftwareApplication', name: 'Vimbre', url: 'https://vimbre.com/', applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
      description: 'Vimbre is a shared decision log for teams. It keeps each decision with its reason, date, owner and next step, so whoever covers, joins or takes over a role can see what happened and what to do first.',
      offers: { '@type': 'AggregateOffer', priceCurrency: 'GBP', lowPrice: String(Math.min(...plans.flatMap(p => p.amount === null ? [] : [p.amount]))), highPrice: String(Math.max(...plans.flatMap(p => p.amount === null ? [] : [p.amount]))), offerCount: String(plans.filter(p => p.amount !== null).length) },
      publisher: { '@type': 'Organization', name: 'Genade Global Services Ltd', url: 'https://vimbre.com/' } },
    { '@type': 'FAQPage', mainEntity: faq.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) },
  ],
}
