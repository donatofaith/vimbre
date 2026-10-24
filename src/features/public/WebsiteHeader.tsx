import { useAuth } from '../auth/AuthProvider'
import { LandingHeader } from './LandingHeader'
export function WebsiteHeader() {
  const { session, loading } = useAuth()
  return <LandingHeader authenticated={Boolean(session)} loading={loading} />
}
