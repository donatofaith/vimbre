import {useCompanyLogo} from '../../features/team/CompanyLogo'
import {BillingAccessProvider} from '../../features/billing/BillingAccess'
import {offlineQueue} from '../../features/my-day/offline'
import {useMyDaySummary,MyDaySummaryProvider} from '../../features/workspace/useMyDaySummary'
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
import './workspace-refinement.css'
import { ChatProvider, ChatLauncher } from '../../features/chat/ChatProvider'
import { useCompanyMemberCount } from '../../features/workspace/useTeamOverview'

const icons: Record<string, string> = {
  '/app': 'home',
  '/app/capture': 'capture',
  '/app/chat': 'chat',
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
  const {profile}=useAuth()
  return <BillingAccessProvider><ChatProvider><MyDaySummaryProvider key={profile?.id} owner={profile?.id??''}><WorkspaceLayout /></MyDaySummaryProvider></ChatProvider></BillingAccessProvider>
}

function WorkspaceLayout() {
  const { company, profile } = useAuth()
  const companyLogo=useCompanyLogo(company?.logo_path)
  const { pathname } = useLocation()
  const daySummary=useMyDaySummary(profile?.id??'',0,Boolean(profile));
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
  const sidebarRef=useRef<HTMLElement>(null)
  useEffect(()=>{
    if(!menuOpen)return
    const media=window.matchMedia('(max-width: 1024px)')
    if(!media.matches){setMenuOpen(false);return}
    const previous=document.body.style.overflow;document.body.style.overflow='hidden'
    function trap(event:KeyboardEvent){if(event.key!=='Tab')return;const nodes=Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)')??[]).filter(el=>el.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
    const resize=()=>{if(!media.matches)setMenuOpen(false)}
    document.addEventListener('keydown',trap);media.addEventListener('change',resize)
    return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',trap);media.removeEventListener('change',resize)}
  },[menuOpen])

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

  const active = navigation.find(item => pathname === item.path || item.path === '/app/handovers' && pathname.startsWith(item.path+'/'))

  const pageName =
    active?.label === 'Handovers'
      ? 'Handovers'
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
    if(offlineQueue().length&&!window.confirm("Offline changes have not synced. Sign out and remove them from this device?"))return

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
    <div className="app-shell vw-shell" data-sidebar-collapsed={sidebarCollapsed} data-chat={pathname==='/app/chat'}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <aside ref={sidebarRef} role={menuOpen?'dialog':undefined} aria-modal={menuOpen?true:undefined} aria-label={menuOpen?'Workspace menu':undefined} className="vw-sidebar" id="workspace-sidebar" data-open={menuOpen}>
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">{menuOpen ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}</svg>
            <span>{menuOpen ? 'Close menu' : 'Menu'}</span>
          </button>
        </div>

        <p className="vw-company">
          {companyLogo&&<img className="vw-company-logo" src={companyLogo} alt="" width={28} height={28}/>} {company?.name ?? 'Your company'}
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
                  ? 'Handovers'
                  : item.label}
              </span>
              {item.path==='/app'&&daySummary.data?.task_counts&&daySummary.data.task_counts.today+daySummary.data.task_counts.overdue>0&&<span className="vw-task-count" aria-label="Today and overdue tasks">{daySummary.data.task_counts.today+daySummary.data.task_counts.overdue}</span>}
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

          <Link to="/" onClick={()=>setMenuOpen(false)}>
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

      <div className="vw-workspace" data-clarity-mask="true" inert={menuOpen}>
        <header className="vw-topbar">
          <button type="button" className="vw-collapse-sidebar" onClick={toggleSidebar} aria-expanded={!sidebarCollapsed} aria-controls="workspace-sidebar" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <WorkspaceIcon name="sidebar" />
            <span>{sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
          </button>
          <div className="vw-breadcrumb">
            <span className="vw-breadcrumb-company">{company?.name}</span>
            <span className="vw-breadcrumb-separator" aria-hidden="true">/</span>
            <strong className="sr-only">{pageName}</strong>
          </div>

          <div className="vw-topbar-actions">
            <NavLink to="/app/weekly-summary?tab=stars" className="chat-launcher stars-launcher" aria-label="Stars" title="Stars"><WorkspaceIcon name="star" /></NavLink>
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

