import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {trackMarketing} from './marketing-analytics'
import './public-polish.css'
import { BrandLogo } from '../../components/ui/BrandLogo'

export function LandingHeader({ authenticated = false, loading = false }: { authenticated?: boolean; loading?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menu = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuOpen) { setMenuOpen(false); menu.current?.focus() }
    }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [menuOpen])
  return <header className={`rs-header${scrolled ? ' rs-header-scrolled' : ''}`}>
    <div className="rs-container rs-header-inner">
      <Link className="rs-brand" to="/" aria-label="Vimbre home"><BrandLogo /></Link>
      <nav id="rs-navigation" className={`rs-nav${menuOpen ? ' rs-nav-open' : ''}`} aria-label="Public">
        {[['Product', '#product-demo'], ['How it works', 'how-it-works'], ['Pricing', 'pricing'], ['FAQ', 'faq'], ['Integrations', 'integrations']].map(([label, href]) => <Link key={label} to={`/${href}`} onClick={() => setMenuOpen(false)}>{label}</Link>)}
        <Link to="/blog" onClick={()=>setMenuOpen(false)}>Blog</Link>
      </nav>
      <div className="rs-header-actions">
        {!authenticated && !loading && <Link className="rs-login" to="/login">Log in</Link>}
        <Link className="rs-button rs-header-cta" onClick={()=>trackMarketing('cta_click',{location:'header'})} to={authenticated ? '/app' : '/signup'}>{authenticated ? 'Go to workspace' : 'Start free'}</Link>
        <button ref={menu} className="rs-menu" type="button" aria-label={menuOpen ? 'Close website menu' : 'Open website menu'} aria-expanded={menuOpen} aria-controls="rs-navigation" onClick={() => setMenuOpen(!menuOpen)}><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none"><path d={menuOpen?'M6 6l12 12M6 18 18 6':'M4 6h16M4 12h16M4 18h16'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg><span className="sr-only">{menuOpen ? 'Close' : 'Menu'}</span></button>
      </div>
    </div>
  </header>
}

