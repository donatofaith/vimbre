// Founder revision, 21 October 2026. Visible FAQ and schema share one source.
export const landingTitle = 'Vimbre | Handover and Knowledge Retention for Teams'
export const definition = "Vimbre keeps each person's tasks, decisions and contacts as they work, so when someone leaves or is away, whoever steps in knows what happened and what to do first."
export const storySummary = 'Example: a meeting note and an email become one decision record, and a colleague covering for someone who is away can see it.'
export const record = [
  ['Decision', 'Move supplier reviews to monthly'],
  ['Why', 'To reduce meeting load and focus on key updates'],
  ['Date', '12 October'],
  ['Owner', 'Operations'],
  ['Next step', 'Share the review notes'],
]
export const faq = [
  ['What is Vimbre?', "Vimbre keeps each person's tasks, decisions and contacts as they work, so when someone leaves or is away, whoever steps in knows what happened and what to do first. It is a shared decision log and role record for teams."],
  ['Who is Vimbre for?', 'Teams where people cover for each other. Employees keep their day and finished work in one place, managers see who is covering and what is open, and HR can see which roles are ready if someone leaves.'],
  ['How does Vimbre work?', 'Add a task or a decision as you work, from an email, a meeting or your own notes. When a task is finished, add it to context so what you did and decided is kept. When someone needs to cover or take over, they open the record and start from the facts.'],
  ['Does Vimbre replace our existing tools?', 'No. Vimbre works next to your email, notes, calendar and documents. Your team keeps working where it works now.'],
  ['How is Vimbre different from Notion, ClickUp or Trello?', 'Those tools help you manage work. Vimbre keeps what each person knows about their role, so when someone leaves or is away, the next person starts with the facts. Many teams use Vimbre next to the tool they already have.'],
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
      description: definition,
      offers: { '@type': 'AggregateOffer', priceCurrency: 'GBP', lowPrice: String(Math.min(...plans.flatMap(p => p.amount === null ? [] : [p.amount]))), highPrice: String(Math.max(...plans.flatMap(p => p.amount === null ? [] : [p.amount]))), offerCount: String(plans.filter(p => p.amount !== null).length) },
      publisher: { '@type': 'Organization', name: 'Genade Global Services Ltd', url: 'https://vimbre.com/' } },
    { '@type': 'FAQPage', mainEntity: faq.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) },
  ],
}

