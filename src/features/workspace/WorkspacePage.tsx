import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { useAuth } from '../auth/AuthProvider'
import { navigation } from '../../app/navigation'
export function WorkspacePage() {
  const { company } = useAuth()
  return <><div className="page-heading"><span className="eyebrow">{company?.name}</span><h1 tabIndex={-1}>My day</h1><p>Your work, decisions and cover duties in one place.</p></div><Card><EmptyState title="Your company workspace is ready" description="Account access, company settings and team setup are connected. Capture, role records and handover workflows are the next build stage." /><Link to="/app/settings">Review company settings</Link></Card><section className="feature-grid" aria-label="Planned workspace features">{navigation.slice(1).filter(item => !('available' in item)).map(item => <Card key={item.path}><span className="badge">Coming soon</span><h2>{item.label}</h2><Link to={item.path}>View build status</Link></Card>)}</section></>
}
