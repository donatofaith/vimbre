import { useAuth } from '../auth/AuthProvider'
import { LandingPage } from './LandingPage'
export function HomePage() {
  const { session, loading } = useAuth()
  return <LandingPage authenticated={Boolean(session)} loading={loading} />
}
