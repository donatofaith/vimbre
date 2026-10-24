import { Link } from 'react-router-dom'
import { WebsiteHeader } from './WebsiteHeader'
import { legalDocuments } from './legal-content'
import './landing.css'
export function LegalPage({ page }: { page: 'privacy' | 'terms' }) {
  const content = legalDocuments[page]
  return <div className="rs-site" data-theme="light"><WebsiteHeader /><main className="rs-section"><article className="rs-container rs-legal">
    {content ? <><h1 tabIndex={-1}>{content.title}</h1><p>{content.updated}</p>{content.sections.map(section => <section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>)}</> : <><h1 tabIndex={-1}>Page not found</h1><Link to="/">Back to website</Link></>}
  </article></main></div>
}
