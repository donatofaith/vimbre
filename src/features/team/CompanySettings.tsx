import { Link } from 'react-router-dom'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
export function CompanySettings() {
  const { company, profile, refresh } = useAuth()
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
    const teamMode = String(form.get('team_mode'))
    if (!name || (teamMode !== 'small' && teamMode !== 'departments')) { setError('Enter a company name and select a team structure.'); setBusy(false); return }
    try {
      const { data, error: failure } = await supabase.from('companies').update({ name, contact_email: String(form.get('contact')).trim() || null, team_mode: teamMode }).eq('id', currentCompany.id).select('id').single()
      if (failure || !data) throw new Error('Save failed')
      setMessage('Company settings saved.'); refresh()
    } catch { setError('Could not save your settings. Check your connection and administrator access, then retry.') }
    finally { setBusy(false) }
  }
  return <><div className="page-heading"><span className="eyebrow">Workspace setup</span><h1 tabIndex={-1}>Company settings</h1><p>Your account: {profile.full_name} · {profile.role.replace('_', ' ')}</p></div><section className="card settings-card"><h2>{company.name}</h2>{admin ? <form className="auth-form" onSubmit={save} key={company.updated_at}>
    <Input label="Company name" name="company" defaultValue={company.name} required maxLength={120} autoComplete="organization" />
    <Input label="Contact email" name="contact" type="email" defaultValue={company.contact_email ?? ''} maxLength={320} autoComplete="email" />
    <div className="field"><label htmlFor="team-mode">Team structure</label><select id="team-mode" name="team_mode" defaultValue={company.team_mode}><option value="small">Small team</option><option value="departments">Departments</option></select></div>
    <p className="muted">Small teams can skip departments. In department mode, assign each Manager and Employee to a department.</p>
    {error && <p role="alert" className="field-error">{error}</p>}{message && <p role="status">{message}</p>}
    <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</Button>
  </form> : <p>Contact your HR Admin to change company settings.</p>}</section>{admin && <p><Link to="/app/team">Manage your team</Link> · <Link to="/app/departments">Manage departments</Link></p>}</>
}
