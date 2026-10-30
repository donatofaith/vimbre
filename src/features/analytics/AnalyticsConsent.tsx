import {useEffect, useRef, useState} from 'react'
import {Link, useLocation} from 'react-router-dom'
import {analyticsConsent, resetAnalyticsPage, trackPageView} from '../../lib/analytics'
import type {AnalyticsConsent as Consent} from '../../lib/analytics'
import './analytics.css'

export function CookieSettingsLink() {
  return <button type="button" className="cookie-settings-link" onClick={() => window.dispatchEvent(new Event('vimbre:cookie-settings'))}>Cookie settings</button>
}
export function AnalyticsConsent() {
  const {pathname} = useLocation()
  const [consent, setConsent] = useState<Consent>(analyticsConsent)
  const [settings, setSettings] = useState(false)
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const update = () => setConsent(analyticsConsent())
    const open = () => { previousFocus.current = document.activeElement as HTMLElement; setSettings(true) }
    window.addEventListener('vimbre:analytics-consent', update)
    window.addEventListener('vimbre:cookie-settings', open)
    return () => { window.removeEventListener('vimbre:analytics-consent', update); window.removeEventListener('vimbre:cookie-settings', open) }
  }, [])
  useEffect(() => {
    if (consent !== 'accepted') { resetAnalyticsPage(); return }
    trackPageView(pathname)
  }, [pathname, consent])
  useEffect(() => { if (settings && dialog.current && !dialog.current.open) dialog.current.showModal() }, [settings])
  function close() { setSettings(false); previousFocus.current?.focus() }
  function choose(value: Exclude<Consent, null>) {
    if (!window.vimbreAnalytics) { setError('Cookie settings could not be saved. Reload this page and try again.'); return }
    window.vimbreAnalytics.choose(value); setConsent(value); setError(''); close()
  }
  const controls = <div className="cookie-actions"><button type="button" onClick={() => choose('declined')}>Reject analytics</button><button type="button" onClick={() => choose('accepted')}>Accept analytics</button></div>
  return <>
    {consent === null && !settings && <aside className="cookie-banner" aria-label="Cookie choices"><div><strong>Your cookie choices</strong><p>Essential storage keeps Vimbre working. With your permission, Google Analytics helps us understand which features are used. <Link to="/privacy">Privacy policy</Link></p>{error && <p role="alert">{error}</p>}</div>{controls}</aside>}
    {settings && <dialog className="cookie-dialog" ref={dialog} aria-labelledby="cookie-title" onCancel={close} onClose={close}><h2 id="cookie-title">Cookie settings</h2><p>Essential storage is always on. Analytics is {consent === 'accepted' ? 'on' : 'off'}.</p><p>Choose whether Google Analytics can measure visits and feature use. Your messages, documents and task contents are excluded. <Link to="/privacy" onClick={close}>Read our privacy policy</Link>.</p>{error && <p role="alert">{error}</p>}{controls}<button className="cookie-settings-link" type="button" onClick={close}>Close</button></dialog>}
  </>
}
