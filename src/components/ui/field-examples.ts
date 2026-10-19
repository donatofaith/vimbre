// Examples guide input; they are never values and are never saved automatically.
export const fieldExamples: Record<string, { placeholder: string; hint?: string }> = {
  'Full name': { placeholder: 'e.g. Ada Okafor' },
  'Company name': { placeholder: 'e.g. Acme Studio' },
  'Work email': { placeholder: 'e.g. ada@example.com' },
  'Email address': { placeholder: 'e.g. ada@example.com', hint: 'Use the email address this person will sign in with.' },
  'Contact email': { placeholder: 'e.g. hello@example.com' },
  'Contact phone': { placeholder: 'e.g. +234 800 123 4567' },
  'Department name': { placeholder: 'e.g. Operations or Finance' },
  'Find a manager': { placeholder: 'e.g. Ada' },
  'Find a team member': { placeholder: 'e.g. Ada' },
  'Find a workstream for this decision': { placeholder: 'e.g. Monthly reporting' },
  'Search titles': { placeholder: 'e.g. Weekly report' },
  'What was decided?': { placeholder: 'e.g. Send the weekly report every Friday' },
  'Who decided?': { placeholder: 'e.g. Ada Okafor, Operations Manager' },
  'Source web link (optional)': { placeholder: 'e.g. https://example.com/meeting-notes', hint: 'Link to the email, meeting notes or document where this was agreed.' },
  'Related task web link (optional)': { placeholder: 'e.g. https://example.com/task', hint: 'Link to the follow up in your existing work tool, if there is one.' },
}
