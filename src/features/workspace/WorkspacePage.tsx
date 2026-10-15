import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { navigation } from '../../app/navigation'
export function WorkspacePage() {
  return <><div className="page-heading"><span className="eyebrow">Project foundation</span><h1 tabIndex={-1}>My day</h1><p>Your work, decisions and cover duties in one place.</p></div><Card><EmptyState title="The foundation is ready" description="Navigation and shared UI are available. Accounts, records and workflows are not connected yet. No business data is loaded." /></Card><section className="feature-grid" aria-label="Planned workspace features">{navigation.slice(1).map(item => <Card key={item.path}><span className="badge">Coming soon</span><h2>{item.label}</h2><Link to={item.path}>View build status</Link></Card>)}</section></>
}
