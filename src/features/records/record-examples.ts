import type { ItemKind } from './record-utils'
export const recordExamples: Record<ItemKind, { title: string; details: string; guidance: string; url: string }> = {
  responsibility: { title: 'e.g. Prepare the weekly operations report', details: 'e.g. Collect updates from each team and send the report to the Operations Manager every Friday.', guidance: 'The work this role is responsible for.', url: 'https://example.com/guide' },
  workstream: { title: 'e.g. Monthly reporting', details: 'e.g. The reports, reviews and follow ups that keep the monthly figures up to date.', guidance: 'Work in progress and what happens next.', url: 'https://example.com/reports' },
  external_contact: { title: 'e.g. Ada Okafor at Acme Supplies', details: 'e.g. Contact Ada about delivery dates. Email is best; include the order reference.', guidance: 'People outside your team and when to contact them.', url: 'https://example.com/supplier' },
  document: { title: 'e.g. Weekly reporting guide', details: 'e.g. Explains how to prepare the report and which figures to check before sending it.', guidance: 'Documents needed to do this role.', url: 'https://example.com/guide' },
  recurring_deadline: { title: 'e.g. Submit the weekly operations report', details: 'e.g. Check the figures with Finance before sending. Allow time for corrections.', guidance: 'What repeats and when it is next due.', url: 'https://example.com/checklist' },
}

