import { useEffect, useRef, useState } from 'react'
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
} from 'react-router-dom'
import { navigation } from '../navigation'
import { WorkspaceIcon } from '../../components/ui/WorkspaceIcon'
import { useAuth } from '../../features/auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import './workspace.css'

const icons: Record<string, string> = {
  '/app': 'home',
  '/app/capture': 'capture',
  '/app/role-record': 'record',
  '/app/handovers': 'handover',
  '/app/my-cover-duties': 'people',
  '/app/team-activity': 'check',
  '/app/team': 'people',
  '/app/departments': 'people',
}

export function AppLayout() {
  const { company, profile } = useAuth()
  const { pathname } = useLocation()

  const [menuOpen, setMenuOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  const menuButton = useRef<HTMLButtonElement>(null)
  const help = useRef<HTMLDialogElement>(null)

  const initials =
    profile?.full_name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(word => word[0])
      .join('')
      .toUpperCase() || 'Y'

  const role =
    profile?.role === 'hr_admin'
      ? 'HR Admin'
      : profile?.role === 'manager'
        ? 'Manager'
        : 'Employee'

  const items = navigation.filter(
    item =>
      item.path !== '/app/settings' &&
      (!('leaders' in item) || profile?.role !== 'employee'),
  )

  const active = navigation.find(item => pathname === item.path)

  const pageName =
    active?.label === 'Handovers'
      ? 'My handovers'
      : active?.label ?? 'Workspace'

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
    <div className="app-shell vw-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <aside className="vw-sidebar" data-open={menuOpen}>
        <div className="vw-sidebar-top">
          <Link
            className="vw-brand"
            to="/"
            aria-label="Vimbre home"
          >
            <span className="vw-mark" aria-hidden="true">
              <i />
              <i />
            </span>
            Vimbre
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
          {items.map(item => (
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
            Home
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
          <div className="vw-breadcrumb">
            Workspace
            <span aria-hidden="true">/</span>
            <strong>{pageName}</strong>
          </div>

          <div className="vw-topbar-actions">
            <button
              type="button"
              className="vw-help"
              onClick={() => help.current?.showModal()}
            >
              Help
            </button>

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
          <Outlet />
        </main>
      </div>

      <dialog
        className="vw-dialog"
        ref={help}
        aria-labelledby="vw-help-title"
      >
        <h2 id="vw-help-title">Find your way around</h2>

        <p>
          My day shows your own actions. Use your role record to
          keep responsibilities, decisions and useful links
          together.
        </p>

        <p>
          Capture, handovers and cover duties are the next parts
          being built. Your company administrator manages team
          access.
        </p>

        <form method="dialog">
          <button className="button button-primary">
            Close help
          </button>
        </form>
      </dialog>
    </div>
  )
}