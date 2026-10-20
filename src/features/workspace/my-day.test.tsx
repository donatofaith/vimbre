import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { CaptureSummary, RoleChecklist } from './MyDayOverview'
import { parseMyDaySummary } from './useMyDaySummary'
import type { MyDaySummary } from './useMyDaySummary'
const empty: MyDaySummary = { pending_drafts: 0, completed_sections: [], forwarding_address: null }
const render = (element: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>)
describe('My day summary', () => {
  it('rejects malformed API data instead of displaying an invented count', () => {
    expect(parseMyDaySummary({})).toBeNull()
    expect(parseMyDaySummary({ ...empty, pending_drafts: -1 })).toBeNull()
    expect(parseMyDaySummary(empty)).toEqual(empty)
  })
  it('does not invent a forwarding address or draft count', () => {
    expect(render(<CaptureSummary data={null} />)).toBe('')
    expect(render(<CaptureSummary data={empty} />)).toBe('')
  })
  it('shows the real draft count and Capture destination', () => {
    const html = render(<CaptureSummary data={{ ...empty, pending_drafts: 2 }} />)
    expect(html).toContain('2 drafts to review')
    expect(html).toContain('href="/app/capture"')
    expect(render(<CaptureSummary data={{ ...empty, pending_drafts: 1 }} />)).toContain('1 draft to review')
  })
  it('only offers copying for an address supplied by the backend', () => {
    const html = render(<CaptureSummary data={{ ...empty, forwarding_address: 'verified-fixture@example.invalid' }} />)
    expect(html).toContain('Forward emails to your Vimbre address')
    expect(html).toContain('verified-fixture@example.invalid')
    expect(html).toContain('Copy address')
  })
  it('does not claim zero progress while loading or on failure', () => {
    expect(render(<RoleChecklist data={null} error={false} retry={() => {}} />)).toContain('Loading progress')
    const html = render(<RoleChecklist data={null} error retry={() => {}} />)
    expect(html).toContain('Retry progress')
    expect(html).not.toContain('0 of 5 done')
  })
  it('counts completed categories and links each one to the correct section', () => {
    const html = render(<RoleChecklist data={{ ...empty, completed_sections: ['responsibility', 'document'] }} error={false} retry={() => {}} />)
    expect(html).toContain('2 of 5 done')
    expect(html).toContain('Responsibilities, done')
    expect(html).toContain('Projects you handle, not done')
    for (const kind of ['responsibility', 'workstream', 'external_contact', 'document', 'recurring_deadline']) expect(html).toContain(`/app/role-record?section=${kind}`)
    expect(html).not.toContain('Open role record')
  })
})
