import { lazy, Suspense, useEffect } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { FeaturePage } from '../components/ui/FeaturePage'
import { AuthPage, AuthCallback } from '../features/auth/AuthPage'
import { RequireAuth } from '../features/auth/AuthProvider'
import { CompanySettings } from '../features/team/CompanySettings'

const ChatPage = lazy(() => import('../features/chat/ChatPage').then(module => ({ default: module.ChatPage })))

const HomePage = lazy(() =>
  import('../features/public/HomePage').then(module => ({
    default: module.HomePage,
  })),
)

const WorkspacePage = lazy(() =>
  import('../features/workspace/WorkspacePage').then(module => ({
    default: module.WorkspacePage,
  })),
)

const CapturePage = lazy(() =>
  import('../features/capture/CapturePage').then(module => ({
    default: module.CapturePage,
  })),
)

const TeamActivityPage = lazy(() =>
  import('../features/workspace/TeamActivityPage').then(module => ({
    default: module.TeamActivityPage,
  })),
)

const RoleRecordPage = lazy(() =>
  import('../features/records/RoleRecordPage').then(module => ({
    default: module.RoleRecordPage,
  })),
)

const TeamPage = lazy(() =>
  import('../features/team/TeamPage').then(module => ({
    default: module.TeamPage,
  })),
)

const DepartmentsPage = lazy(() =>
  import('../features/team/DepartmentsPage').then(module => ({
    default: module.DepartmentsPage,
  })),
)

const JoinPage = lazy(() =>
  import('../features/auth/JoinPage').then(module => ({
    default: module.JoinPage,
  })),
)

function PageFocus() {
  const { pathname } = useLocation()

  useEffect(() => {
    const focus = () => {
      const heading = document.querySelector('h1')

      if (!heading || heading.getClientRects().length === 0) {
        return false
      }

      document.title =
        pathname === '/'
          ? 'Vimbre | Decision Records for Teams and Handovers'
          : `${heading.textContent} | Vimbre`

      window.dispatchEvent(new Event('vimbre:ready'))
      heading.focus({ preventScroll: true })
      return true
    }

    if (focus()) return

    const observer = new MutationObserver(() => {
      if (focus()) observer.disconnect()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [pathname])

  return null
}

function AnchorScroll() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    let id: string
    try { id = decodeURIComponent(hash.slice(1)) } catch { return }
    const scroll = () => {
      const target = document.getElementById(id)
      if (!target) return false
      target.scrollIntoView({ block: 'start' })
      return true
    }
    if (scroll()) return
    const observer = new MutationObserver(() => { if (scroll()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pathname, hash])
  return null
}

export function App() {
  return (
    <>
      <PageFocus />
      <AnchorScroll />

      <Suspense
        fallback={
          <main className="standalone" role="status">
            Loading page…
          </main>
        }
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/contact" element={<Navigate to="/#contact" replace />} />
          <Route
            path="/login"
            element={<AuthPage key="login" mode="login" />}
          />
          <Route
            path="/signup"
            element={<AuthPage key="signup" mode="signup" />}
          />
          <Route
            path="/forgot"
            element={<AuthPage key="forgot" mode="forgot" />}
          />
          <Route
            path="/reset-password"
            element={<AuthPage key="reset" mode="reset" />}
          />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          <Route element={<RequireAuth />}>
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<WorkspacePage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="capture" element={<CapturePage />} />
              <Route path="role-record" element={<RoleRecordPage />} />

              <Route
                path="handovers"
                element={
                  <FeaturePage
                    title="Handovers"
                    description="Planned handover drafting, approval and publication are coming soon."
                    embedded
                  />
                }
              />

              <Route
                path="my-cover-duties"
                element={
                  <FeaturePage
                    title="Cover duties"
                    description="Temporary access, acknowledgement and progress tracking are coming soon."
                    embedded
                  />
                }
              />

              <Route path="team" element={<TeamPage />} />
              <Route
                path="team-activity"
                element={<TeamActivityPage />}
              />
              <Route
                path="departments"
                element={<DepartmentsPage />}
              />
              <Route path="settings" element={<CompanySettings />} />

              <Route
                path="*"
                element={
                  <FeaturePage
                    title="Page not found"
                    description="This workspace page does not exist."
                    embedded
                    notFound
                  />
                }
              />
            </Route>
          </Route>

          <Route
            path="*"
            element={
              <main className="standalone">
                <h1 tabIndex={-1}>Page not found</h1>
                <p>We could not find that page.</p>
                <Link to="/">Go to the homepage</Link>
              </main>
            }
          />
        </Routes>
      </Suspense>
    </>
  )
}