import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { useAuth } from '../auth/AuthProvider'

export function WebsiteHeader() {
  const { session, loading } = useAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menu = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuOpen) {
        setMenuOpen(false)
        menu.current?.focus()
      }
    }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [menuOpen])

  return (
    <header className="rs-header">
      <div className="rs-container rs-header-inner">
        <Link className="rs-brand" to="/" aria-label="Vimbre home"><BrandLogo /></Link>
        <nav id="rs-navigation" className={`rs-nav${menuOpen ? ' rs-nav-open' : ''}`} aria-label="Public">
          {['Product', 'How it works', 'Pricing'].map((label, index) => (
            <a key={label} href={`${pathname === '/' ? '' : '/'}${['#features', '#how-it-works', '#pricing'][index]}`} onClick={() => setMenuOpen(false)}>{label}</a>
          ))}
          <Link to="/contact" aria-current={pathname === '/contact' ? 'page' : undefined} onClick={() => setMenuOpen(false)}>Contact</Link>
        </nav>
        <div className="rs-header-actions">
          {!session && !loading && <Link className="rs-login" to="/login">Log in</Link>}
          <Link className="rs-button rs-header-cta" to={session ? '/app' : '/signup'}>{session ? 'Open workspace' : 'Get started'}</Link>
          <button ref={menu} className="rs-menu" type="button" aria-label={menuOpen ? 'Close website menu' : 'Open website menu'} aria-expanded={menuOpen} aria-controls="rs-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close' : 'Menu'}</button>
        </div>
      </div>
    </header>
  )
}
