// Refined founder brief, 22 October 2026. Visible FAQ and schema share one source.
export const landingTitle = 'Vimbre | Work Intelligence and Handover Context'
export const definition = 'Vimbre connects conversations, decisions, actions and outcomes across supported tools, helping teams track work, build context and prepare handovers.'
export const heroCopy = { headline: 'The missing layer behind your work.', supporting: 'Vimbre connects conversations, decisions, actions and outcomes across your existing tools, building the context your business needs to keep work moving, preserve knowledge and make handovers effortless.' }
export const storySummary = 'Example: a meeting note and an email become one decision record, and a colleague covering for someone who is away can see it.'
export const record = [
  ['Decision', 'Move supplier reviews to monthly'],
  ['Why', 'To reduce meeting load and focus on key updates'],
  ['Date', '12 October'],
  ['Owner', 'Operations'],
  ['Next step', 'Share the review notes'],
]
export const faq = [
  ['What is Vimbre?', 'Vimbre is a work intelligence layer that connects conversations, decisions, actions and outcomes across supported tools, helping teams track commitments, build context and prepare handovers.'],
  ['Is Vimbre a project management tool?', 'Vimbre is not positioned as a replacement for a project management tool. It connects the context behind work across supported sources and helps track actions and decisions.'],
  ['How is Vimbre different from Notion, ClickUp or Trello?', 'Those tools can organise documents, tasks and projects. Vimbre brings tasks, decisions and role records together, with AI drafts from pasted text and notes for users to review. Direct integrations with other tools are planned.'],
  ['How does handover work?', 'You can prepare an editable AI handover draft from your own confirmed records or pasted notes. Review it and copy the result. Person, project and date range filters, approval and publishing are not available yet. The date selector on this page uses example records only.'],
  ['Does Vimbre capture everything automatically?', 'No. You paste email text or notes, then choose to generate a draft. AI must be enabled for your company. You review and confirm the draft before it becomes a work record. Vimbre does not read your email, meetings or other tools by itself.'],
  ['Can Vimbre infer every decision and outcome?', 'No. AI drafts can miss information or make mistakes. Check the wording, names and dates, edit the draft where needed, and confirm only what the source supports.'],
  ['What tools does Vimbre support?', 'Capture supports typed notes and pasted email or meeting text. You can also add tasks, decisions and role records by hand. Direct email forwarding, meeting capture and integrations with Teams and task management tools are planned.'],
  ['How is company information protected?', 'Access follows company roles and permissions. Capture notes and pending drafts are private to their owner. Confirmed work follows the company’s access rules. Contact support@vimbre.com for specific privacy or retention questions.'],
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
      publisher: { '@type': 'Organization', name: 'Genade Global Services Ltd', url: 'https://vimbre.com/' } },
    { '@type': 'FAQPage', mainEntity: faq.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) },
  ],
}

