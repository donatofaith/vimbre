import {useEffect} from 'react'
import {Link} from 'react-router-dom'
import {useAuth} from '../auth/AuthProvider'
import {LandingHeader} from './LandingHeader'
import {competitionDocument, legalDocuments} from './legal-content'
import {CookieSettingsLink} from '../analytics/AnalyticsConsent'
import './landing.css'
import './legal.css'
type Page = 'privacy' | 'terms' | 'competition'
export function LegalPage({page}: {page: Page}) {
  const {session, loading} = useAuth()
  return <LegalDocumentPage page={page} authenticated={Boolean(session)} loading={loading}/>
}
export function LegalDocumentPage({page, authenticated = false, loading = false}: {page: Page; authenticated?: boolean; loading?: boolean}) {
  const content = page === 'competition' ? competitionDocument : legalDocuments[page]
  const path = page === 'competition' ? '/competition-terms' : `/${page}`
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0)
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const old = canonical?.href
    if (canonical) canonical.href = `https://vimbre.com${path}`
    return () => { if (canonical && old) canonical.href = old }
  }, [path])
  return <div className="rs-site" data-theme="light"><LandingHeader authenticated={authenticated} loading={loading}/><main className="rs-section"><article className="rs-container rs-legal">
    <h1 tabIndex={-1}>{content.title}</h1><p className="legal-version">{content.updated}</p>
    {content.introduction?.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
    <details className="legal-contents"><summary>On this page</summary><nav aria-label="Document sections">{content.sections.map((section, index) => <a key={section.heading} href={`#legal-section-${index + 1}`}>{section.heading}</a>)}</nav></details>
    {content.sections.map((section, index) => <section id={`legal-section-${index + 1}`} key={section.heading}><h2>{section.heading}</h2>
      {section.paragraphs?.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
      {section.blocks?.map((block, i) => block.kind === 'list' ? <ul key={i}>{block.items.map((item, j) => <li key={j}>{item}</li>)}</ul> : block.kind === 'subheading' ? <h3 key={i}>{block.text}</h3> : <p key={i}>{block.text}</p>)}
    </section>)}
  </article></main><footer className="rs-footer"><nav className="rs-container" aria-label="Legal"><Link to="/">Back to website</Link><Link to="/privacy">Privacy policy</Link><Link to="/terms">Terms and conditions</Link><CookieSettingsLink/></nav></footer></div>
}
