import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from '../features/public/HomePage'
import { WorkspacePage } from '../features/workspace/WorkspacePage'
import { FeaturePage } from '../components/ui/FeaturePage'

import { AuthPage, AuthCallback } from '../features/auth/AuthPage'
import { RequireAuth } from '../features/auth/AuthProvider'
import { CompanySettings } from '../features/team/CompanySettings'

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
      <Route path="/login" element={<AuthPage key="login" mode="login" />} />
      <Route path="/signup" element={<AuthPage key="signup" mode="signup" />} />
      <Route path="/forgot" element={<AuthPage key="forgot" mode="forgot" />} />
      <Route path="/reset-password" element={<AuthPage key="reset" mode="reset" />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route element={<RequireAuth />}>
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<WorkspacePage />} />
        <Route path="capture" element={<FeaturePage title="Capture" description="Forward an email, paste notes or upload a file. AI review and record saving are coming soon." embedded />} />
        <Route path="role-record" element={<FeaturePage title="Role record" description="Responsibilities, workstreams, decisions and supporting records will live here." embedded />} />
        <Route path="handovers" element={<FeaturePage title="Handovers" description="Planned handover drafting, approval and publication are coming soon." embedded />} />
        <Route path="my-cover-duties" element={<FeaturePage title="Cover duties" description="Temporary access, acknowledgement and progress tracking are coming soon." embedded />} />
        <Route path="settings" element={<CompanySettings />} />
        <Route path="*" element={<FeaturePage title="Page not found" description="This workspace page does not exist." embedded notFound />} />
      </Route>
      </Route>
      <Route path="*" element={<main className="standalone"><h1 tabIndex={-1}>Page not found</h1><p>We could not find that page.</p><Link to="/">Go to the homepage</Link></main>} />
    </Routes>
  </>
}
