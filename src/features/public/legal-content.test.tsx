import {expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {StaticRouter} from 'react-router-dom'
import {LegalDocumentPage} from './LegalPage'
import {legalDocuments,competitionDocument} from './legal-content'
const render=(page:'privacy'|'terms'|'competition')=>renderToStaticMarkup(<StaticRouter location={'/'+page}><LegalDocumentPage page={page}/></StaticRouter>)
it('publishes the complete supplied legal documents with their effective date and processing schedule',()=>{
 expect(legalDocuments.privacy.sections).toHaveLength(15)
 expect(legalDocuments.terms.sections).toHaveLength(20)
 for(const page of ['privacy','terms'] as const)expect(legalDocuments[page].updated).toContain('Effective from 1 November 2026')
 const html=render('terms')
 expect(html).toContain('Vimbre Terms and Conditions')
 expect(html).toContain('Schedule 1: Data Processing Terms')
 expect(html).toContain('15149519')
 expect(html.match(/<section id="legal-section-/g)).toHaveLength(20)
 expect(html).toContain('Cookie settings')
})
it('keeps competition-specific terms separate from the company terms and privacy policy',()=>{
 expect(competitionDocument.title).toBe('Stars and competition terms')
 expect(render('competition')).toContain('They are not a performance score')
 expect(render('privacy')).toContain('We only load these tools if you accept optional analytics through our cookie banner.')
})
