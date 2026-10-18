import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../../components/ui/Button'

export function PublicHeader({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  return <header className="public-header glass-surface">
    <Link className="wordmark brand" to="/" aria-label="Vimbre home"><span className="brand-mark" aria-hidden="true"><i /><i /></span>vimbre</Link>
    <nav id="public-navigation" className={`public-nav${open ? ' is-open' : ''}`} aria-label="Public">
      <a href="#how-it-works" onClick={() => setOpen(false)}>How it works</a><a href="#features" onClick={() => setOpen(false)}>What Vimbre does</a><a href="#questions" onClick={() => setOpen(false)}>Questions</a>
    </nav>
    <div className="public-actions"><button type="button" className="theme-toggle" onClick={onToggleTheme} aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}><span aria-hidden="true">{theme === 'light' ? '☾' : '☀'}</span></button><Link className="public-account-link" to="/login">{profile ? 'Open workspace' : 'Log in'}</Link>{!profile && <Link className="button button-primary" to="/signup">Create account</Link>}<Button className="public-menu" variant="secondary" aria-label={open ? 'Close website menu' : 'Open website menu'} aria-expanded={open} aria-controls="public-navigation" onClick={() => setOpen(value => !value)}>{open ? 'Close' : 'Menu'}</Button></div>
  </header>
}
