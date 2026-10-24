import { useEffect, useRef, useState } from 'react'
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
} from 'react-router-dom'
import { AIAllowanceNotice } from '../../features/ai/AIAllowanceNotice'
import { Notifications } from '../../features/notifications/Notifications'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { roleLabel } from '../../features/team/team-utils'
import { navigation } from '../navigation'
import { WorkspaceIcon } from '../../components/ui/WorkspaceIcon'
import { useAuth } from '../../features/auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import './workspace.css'
import { ChatProvider, ChatLauncher } from '../../features/chat/ChatProvider'
import { useCompanyMemberCount } from '../../features/workspace/useTeamOverview'

const icons: Record<string, string> = {
  '/app': 'home',
  '/app/capture': 'capture',
  '/app/help': 'support',
  '/app/weekly-summary': 'calendar',
  '/app/role-record': 'record',
  '/app/handovers': 'handover',
  '/app/my-cover-duties': 'cover',
  '/app/team-activity': 'check',
  '/app/team': 'people',
  '/app/departments': 'departments',
}

export function AppLayout() {
  return <ChatProvider><WorkspaceLayout /></ChatProvider>
}

function WorkspaceLayout() {
  const { company, profile } = useAuth()
  const { pathname } = useLocation()
  const leader = profile?.role === 'hr_admin' || profile?.role === 'manager'
  const memberCount = useCompanyMemberCount(profile?.id ?? '', leader)

  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('vimbre:sidebar-collapsed') === 'true' } catch { return false }
  })
  function toggleSidebar() {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    try { localStorage.setItem('vimbre:sidebar-collapsed', String(next)) } catch { /* Storage may be unavailable. */ }
  }
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  const menuButton = useRef<HTMLButtonElement>(null)

  const initials =
    profile?.full_name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(word => word[0])
      .join('')
      .toUpperCase() || 'Y'

  const role = roleLabel(profile?.role ?? 'employee', company?.created_by === profile?.id)

  const items = navigation.filter(
    item =>
      item.path !== '/app/settings' &&
      (item.path !== '/app/team-activity' || memberCount !== null && memberCount >= 2) &&
      (!('leaders' in item) || profile?.role !== 'employee'),
  )

  const active = navigation.find(item => pathname === item.path)

  const pageName =
    active?.label === 'Handovers'
      ? 'My handovers'
      : pathname === '/app/chat' ? 'Chat' : active?.label ?? 'Workspace'

  useEffect(() => {
    if (!menuOpen) return

    function close(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuButton.current?.focus()
      }
    }

    document.addEventListener('keydown', close)

    return () => document.removeEventListener('keydown', close)
  }, [menuOpen])

  async function logout() {
    if (loggingOut) return

    setLoggingOut(true)
    setLogoutError('')

    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch {
      setLogoutError('Could not sign out. Please retry.')
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="app-shell vw-shell" data-sidebar-collapsed={sidebarCollapsed}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <aside className="vw-sidebar" id="workspace-sidebar" data-open={menuOpen}>
        <div className="vw-sidebar-top">
          <Link
            className="vw-brand"
            to="/"
            aria-label="Vimbre home"
          >
            <span className="vw-brand-surface"><BrandLogo /></span>
          </Link>

          <button
            ref={menuButton}
            className="vw-menu"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="workspace-navigation"
            onClick={() => setMenuOpen(value => !value)}
          >
            {menuOpen ? 'Close menu' : 'Menu'}
          </button>
        </div>

        <p className="vw-company">
          {company?.name ?? 'Your company'}
        </p>

        <nav
          id="workspace-navigation"
          className="vw-navigation"
          aria-label="Workspace"
        >
          {items.filter(item => !('leaders' in item)).map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={'end' in item && item.end}
              onClick={() => setMenuOpen(false)}
            >
              <WorkspaceIcon name={icons[item.path]} />
              <span>
                {item.label === 'Handovers'
                  ? 'My handovers'
                  : item.label}
              </span>
            </NavLink>
          ))}
          {leader && <div className="vw-manage-group"><span className="vw-nav-heading">Manage</span>{items.filter(item => 'leaders' in item).map(item => <NavLink key={item.path} to={item.path} onClick={() => setMenuOpen(false)}><WorkspaceIcon name={icons[item.path]} /><span>{item.label}</span></NavLink>)}</div>}
        </nav>

        <div className="vw-utilities">
          <NavLink
            to="/app/settings"
            onClick={() => setMenuOpen(false)}
          >
            <WorkspaceIcon name="settings" />
            Settings
          </NavLink>

          <Link to="/">
            <WorkspaceIcon name="home" />
            Back to website
          </Link>

          <button
            type="button"
            disabled={loggingOut}
            onClick={() => {
              void logout()
            }}
          >
            <WorkspaceIcon name="exit" />
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>

        <div className="vw-account">
          <span className="vw-avatar">{initials}</span>
          <div>
            <strong>{profile?.full_name ?? 'Your account'}</strong>
            <span>{role}</span>
          </div>
        </div>
      </aside>

      <div className="vw-workspace">
        <header className="vw-topbar">
          <button type="button" className="vw-collapse-sidebar" onClick={toggleSidebar} aria-expanded={!sidebarCollapsed} aria-controls="workspace-sidebar" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <WorkspaceIcon name="sidebar" />
            <span>{sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
          </button>
          <div className="vw-breadcrumb">
            {company?.name}
            <span aria-hidden="true">/</span>
            <strong>{pageName}</strong>
          </div>

          <div className="vw-topbar-actions">
            <ChatLauncher />
            <Notifications />


            <span
              className="vw-avatar"
              aria-label={profile?.full_name ?? 'Your account'}
            >
              {initials}
            </span>
          </div>
        </header>

        <main id="main" className="vw-content">
          {logoutError && (
            <p className="notice" role="alert">
              {logoutError}
            </p>
          )}
          <AIAllowanceNotice />
          <Outlet />
        </main>
      </div>


    </div>
  )
}

