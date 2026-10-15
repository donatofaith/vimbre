import { Link } from 'react-router-dom'
import { Card } from './Card'
import { EmptyState } from './EmptyState'
export function FeaturePage({ title, description, embedded = false, notFound = false }: { title: string; description: string; embedded?: boolean; notFound?: boolean }) {
  return <div className={embedded ? '' : 'standalone'}><div className="page-heading"><span className="eyebrow">{notFound ? 'Navigation' : 'Coming soon'}</span><h1 tabIndex={-1}>{title}</h1></div><Card><EmptyState title={notFound ? 'Choose another page' : 'This feature is not available yet'} description={description} action={<Link to={embedded ? '/app' : '/'}>{embedded ? 'Back to My day' : 'Back to homepage'}</Link>} /></Card></div>
}
