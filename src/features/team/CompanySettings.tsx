import {CompanyStructure} from './CompanyStructure'
import {CompanyLogo} from './CompanyLogo'
import './settings.css'
import {CookieSettingsLink} from '../analytics/AnalyticsConsent'
import {HandoverSettings} from '../handovers/HandoverSettings'
import {PlanningCalendarSettings} from '../my-day/PlanningCalendarSettings'
import {CompetitionSettings} from '../my-day/CompetitionSettings'
import {ConnectionSettings} from '../capture/ConnectionSettings'
import {SuitePreferences} from '../my-day/SuitePreferences'
import '../handovers/handover.css'
import { WorkPreferences } from '../my-day/WorkPreferences'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import { Input } from '../../components/ui/Input'
import { roleLabel } from './team-utils'
import { Button } from '../../components/ui/Button'
const categories=[['company','Company'],['notifications','Notifications'],['handovers','Handovers'],['planning','Planning'],['stars','Stars'],['integrations','Integrations'],['privacy','Cookie preferences']]
export function CompanySettings() {
  const { company, profile, session, refresh } = useAuth()
  const [section,setSection]=useState('company')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  if (!company || !profile) return null
  const currentCompany = company
  const admin = profile.role === 'hr_admin'
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); setError('')
    const form = new FormData(event.currentTarget)
    const name = String(form.get('company')).trim()
    if (!name || name.length > 120) { setError('Enter a company name of up to 120 characters.'); setBusy(false); return }
    try {
      const { data, error: failure } = await supabase.from('companies').update({ name }).eq('id', currentCompany.id).select('id').single()
      if (failure || !data) throw new Error('Save failed')
      setMessage('Company settings saved.'); refresh()
    } catch { setError('Could not save your settings. Check your connection and administrator access, then retry.') }
    finally { setBusy(false) }
  }
  return <div className="settings-layout"><div className="page-heading"><h1 tabIndex={-1}>Company settings</h1><p>Your account: {profile.full_name} · {roleLabel(profile.role, company.created_by === profile.id)}</p></div><div className="settings-mobile-category"><label htmlFor="settings-category">Settings section</label><select id="settings-category" value={section} onChange={event=>setSection(event.target.value)}>{categories.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div><div className="settings-shell"><nav className="settings-navigation" aria-label="Settings categories">{categories.map(([id,label])=><button key={id} type="button" aria-pressed={section===id} onClick={()=>setSection(id)}>{label}</button>)}</nav><div className="settings-content" key={section}>{section==='company'&&<><section className="card settings-card"><h2>{company.name}</h2>{admin ? <form className="auth-form settings-company-form" onSubmit={save} key={company.updated_at}>
    <Input label="Company name" name="company" defaultValue={company.name} required maxLength={120} autoComplete="organization" />
    <Input label="Account email" type="email" value={session?.user.email ?? profile.email} readOnly />
    <Input label="Company contact email" type="email" value={company.contact_email ?? ''} readOnly />
    <CompanyStructure field/>
    <p className="settings-plan-link"><Link to="/app/billing">Manage subscription</Link></p>
    {error && <p role="alert" className="field-error">{error}</p>}{message && <p role="status">{message}</p>}
    <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</Button>
  </form> : <p>Contact your company administrator to change company settings.</p>}</section>{admin&&<section className="card"><CompanyLogo/></section>}</>}{section==='notifications'&&<><WorkPreferences/><SuitePreferences/></>}{section==='handovers'&&<HandoverSettings/>}{section==='planning'&&<PlanningCalendarSettings/>}{section==='stars'&&<CompetitionSettings/>}{section==='integrations'&&<ConnectionSettings/>}{section==='privacy'&&<section className="card"><h2>Cookie preferences</h2><p>Manage optional website analytics.</p><CookieSettingsLink/></section>}</div></div></div>
}

