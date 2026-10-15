import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { navigation } from '../navigation'

export function AppLayout() {
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
      <p className="sidebar-note">Project foundation</p>
    </aside>
    <div className="workspace">
      <header className="workspace-bar"><span>Workspace foundation</span><Link to="/">Back to homepage</Link></header>
      <main id="main" className="workspace-content"><Outlet /></main>
    </div>
  </div>
}
