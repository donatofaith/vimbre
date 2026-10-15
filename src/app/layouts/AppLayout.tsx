import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { navigation } from '../navigation'

import { useAuth } from '../../features/auth/AuthProvider'
import { supabase } from '../../lib/supabase'

export function AppLayout() {
  const { company, profile } = useAuth()
  const [logoutError, setLogoutError] = useState('')
  async function logout() {
    const { error } = await supabase.auth.signOut()
    if (error) setLogoutError('Could not sign out. Please retry.')
  }
  const [menuOpen, setMenuOpen] = useState(false)
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <aside className="sidebar">
      <div className="sidebar-top">
        <Link className="wordmark" to="/">vimbre</Link>
        <Button className="menu-button" variant="secondary" aria-expanded={menuOpen} aria-controls="workspace-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close menu' : 'Menu'}</Button>
      </div>
      <nav id="workspace-navigation" className={menuOpen ? 'navigation is-open' : 'navigation'} aria-label="Workspace">
        {navigation.map(item => <NavLink key={item.path} to={item.path} end={'end' in item && item.end} onClick={() => setMenuOpen(false)}>{item.label}</NavLink>)}
      </nav>
      <p className="sidebar-note">{profile?.full_name}<br />{profile?.role.replace('_', ' ')}</p>
    </aside>
    <div className="workspace">
      <header className="workspace-bar"><span>{company?.name}</span><Button variant="secondary" onClick={() => { void logout() }}>Sign out</Button></header>
      <main id="main" className="workspace-content">{logoutError && <p role="alert">{logoutError}</p>}<Outlet /></main>
    </div>
  </div>
}
