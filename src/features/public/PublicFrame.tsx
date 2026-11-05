import {useEffect,useRef} from 'react'
import type {ReactNode} from 'react'
import {Link,useLocation} from 'react-router-dom'
import {LandingHeader} from './LandingHeader'
import {CookieSettingsLink} from '../analytics/AnalyticsConsent'
import './landing.css'
import './public-pages.css'
export function PublicFrame({children,authenticated=false,loading=false}:{children:ReactNode;authenticated?:boolean;loading?:boolean}){
  const main = useRef<HTMLElement>(null)
  const {pathname} = useLocation()
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!main.current || !('IntersectionObserver' in window) || media.matches) return
    const cards = '.public-link-grid > a, .public-integrations > article, .rs-pricing > article, .public-page-sections > section'
    const animations: Animation[] = []
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        observer.unobserve(entry.target)
        const items = Array.from(entry.target.parentElement?.children ?? [])
        const index = items.indexOf(entry.target)
        if (!media.matches) animations.push(entry.target.animate(
          [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 400, easing: 'ease-out', delay: Math.max(0, index % 4) * 60, fill: 'backwards' },
        ))
      }
    }, { threshold: 0.15 })
    const stop = () => { for (const animation of animations) animation.cancel() }
    media.addEventListener('change', stop)
    main.current.querySelectorAll(cards).forEach(card => observer.observe(card))
    return () => { observer.disconnect(); stop(); media.removeEventListener('change', stop) }
  }, [pathname])
  return <div className="rs-site" data-theme="light"><a className="skip-link" href="#rs-main">Skip to content</a><LandingHeader authenticated={authenticated} loading={loading}/><main id="rs-main" ref={main}>{children}</main><PublicFooter/></div>
}

const footerGroups = [
  { label: 'Product', links: [['Product', '/how-it-works'], ['Pricing', '/pricing'], ['FAQ', '/faq'], ['Integrations', '/integrations']] },
  { label: 'Who Vimbre is for', links: [['Individuals', '/for-individuals'], ['Founders', '/for-founders'], ['Companies', '/for-companies']] },
  { label: 'Company', links: [['Blog', '/blog'], ['Careers', '/careers'], ['Contact', '/#contact']] },
]

function PublicFooter() {
  return <footer className="rs-footer public-footer">
    <div className="rs-container">
      <div className="rs-footer-top">
        <Link className="rs-footer-brand" to="/" aria-label="Vimbre home">
          <img src="/vimbre-lockup-compact-light.svg" width={153} height={48} alt="" decoding="async"/>
        </Link>
        <nav className="public-footer-links" aria-label="Footer">
          {footerGroups.map(group => <ul key={group.label} aria-label={group.label}>
            {group.links.map(([label, to]) => <li key={to}><Link to={to}>{label}</Link></li>)}
          </ul>)}
        </nav>
      </div>
      <div className="public-footer-bottom">
        <p>© 2026 Genade Global Service Limited.</p>
        <nav aria-label="Legal and privacy">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <CookieSettingsLink/>
        </nav>
      </div>
    </div>
  </footer>
}
