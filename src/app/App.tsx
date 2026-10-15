import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from '../features/public/HomePage'
import { WorkspacePage } from '../features/workspace/WorkspacePage'
import { FeaturePage } from '../components/ui/FeaturePage'

function PageFocus() {
  const { pathname } = useLocation()
  useEffect(() => {
    const heading = document.querySelector('h1')
    document.title = heading ? `${heading.textContent} | Vimbre` : 'Vimbre'
    heading?.focus({ preventScroll: true })
  }, [pathname])
  return null
}

export function App() {
  return <>
    <PageFocus />
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<FeaturePage title="Login" description="Account access is the next build stage. Login is not available yet." />} />
      <Route path="/signup" element={<FeaturePage title="Create your company" description="Company registration is coming soon. No account is created from this foundation." />} />
      <Route path="/forgot" element={<FeaturePage title="Reset your password" description="Password recovery will be available with authentication." />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<WorkspacePage />} />
        <Route path="capture" element={<FeaturePage title="Capture" description="Forward an email, paste notes or upload a file. AI review and record saving are coming soon." embedded />} />
        <Route path="role-record" element={<FeaturePage title="Role record" description="Responsibilities, workstreams, decisions and supporting records will live here." embedded />} />
        <Route path="handovers" element={<FeaturePage title="Handovers" description="Planned handover drafting, approval and publication are coming soon." embedded />} />
        <Route path="my-cover-duties" element={<FeaturePage title="Cover duties" description="Temporary access, acknowledgement and progress tracking are coming soon." embedded />} />
        <Route path="settings" element={<FeaturePage title="Settings" description="Company settings and account preferences will be available after authentication." embedded />} />
        <Route path="*" element={<FeaturePage title="Page not found" description="This workspace page does not exist." embedded notFound />} />
      </Route>
      <Route path="*" element={<main className="standalone"><h1 tabIndex={-1}>Page not found</h1><p>We could not find that page.</p><Link to="/">Go to the homepage</Link></main>} />
    </Routes>
  </>
}
