import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { TextField } from './RecordForms'
import { RoleDrawer } from './RoleDrawer'
import type { RoleItem } from './RecordForms'
import type { Database } from '../../lib/database'
type Suggestion = Database['public']['Tables']['responsibility_suggestions']['Row'] & { item: {title: string; owner_id: string} | null }
export function ResponsibilityReview({ manager, revision, changed }: { manager: boolean; revision: number; changed: () => void }) {
  const [result, setResult] = useState<{rows: Suggestion[]; error: boolean} | null>(null)
  const [page, setPage] = useState(0)
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    let cancelled = false
    void supabase.from('responsibility_suggestions').select('*,item:role_items(title,owner_id)').eq('status','pending').order('created_at').range(page * 20, page * 20 + 19).then(({data,error}) => {if(!cancelled) setResult({rows: data ?? [],error: Boolean(error)})})
    return () => {cancelled=true}
  },[revision,page,retry])
  async function review(id: string, approve: boolean) {
    setBusy(true); setMessage('')
    const {error} = await supabase.rpc('review_responsibility',{p_id:id,p_approve:approve})
    setBusy(false)
    if(error) {setMessage(error.code === '22023' ? error.message : 'Could not review this suggestion. Please retry.'); return}
    setMessage(approve ? 'Suggestion approved.' : 'Suggestion declined.'); changed()
  }
  if(!result) return null
  if(result.error) return <p role="alert">Suggestions could not be loaded. <button type="button" onClick={() => setRetry(n=>n+1)}>Retry suggestions</button></p>
  if(!result.rows.length && !page) return message ? <p className="notice" role="status">{message}</p> : null
  return <section className="vr-review card" aria-label="Responsibility suggestions"><h2>{manager ? 'Suggestions to review' : 'Your pending suggestions'}</h2>
    {message && <p role="status">{message}</p>}
    {result.rows.map(row => <article key={row.id}><h3>{row.item?.title ?? 'Responsibility'}</h3><p><strong>Current description</strong></p><p className="record-text">{row.original_details || 'No description'}</p><p><strong>Suggested description</strong></p><p className="record-text">{row.body}</p>{manager && <div className="form-actions"><Button disabled={busy} onClick={()=>{void review(row.id,true)}}>Approve</Button><Button variant="secondary" disabled={busy} onClick={()=>{void review(row.id,false)}}>Decline</Button></div>}</article>)}
    {(page>0 || result.rows.length===20) && <div className="pagination"><Button variant="secondary" disabled={!page} onClick={()=>setPage(n=>n-1)}>Previous suggestions</Button><Button variant="secondary" disabled={result.rows.length<20} onClick={()=>setPage(n=>n+1)}>Next suggestions</Button></div>}
  </section>
}
export function ResponsibilityPersonal({item, mode, close, saved}: {item: RoleItem; mode:'notes'|'suggest'; close:()=>void; saved:()=>void}) {
  const [state,setState]=useState<{body:string; exists:boolean}|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [retry,setRetry]=useState(0)
  useEffect(()=>{
    let cancelled=false
    if(mode==='suggest') return
    void supabase.from('responsibility_notes').select('body').eq('item_id',item.id).maybeSingle().then(({data,error})=>{if(!cancelled){if(error)setError('Could not load your notes.');else {setState({body:data?.body??'',exists:Boolean(data)});setError('')}}})
    return ()=>{cancelled=true}
  },[item.id,mode,retry])
  return <RoleDrawer title={mode==='notes'?'My notes':'Suggest a change'} close={close}><h2>{mode==='notes'?'My notes':'Suggest a change'}</h2><p>{item.title}</p>
    {mode==='notes' && !state ? <>{error ? <p role="alert">{error} <button type="button" onClick={()=>setRetry(n=>n+1)}>Retry notes</button></p>:<p role="status">Loading notes…</p>}</> : <form className="auth-form" onSubmit={async event=>{
      event.preventDefault();setBusy(true);setError('')
      const body=String(new FormData(event.currentTarget).get('body')??'').trim()
      const {error}=mode==='suggest' ? await supabase.rpc('suggest_responsibility',{p_item:item.id,p_body:body}):state?.exists ? await supabase.from('responsibility_notes').update({body,updated_at:new Date().toISOString()}).eq('item_id',item.id).select('item_id').single():await supabase.from('responsibility_notes').insert({item_id:item.id,body}).select('item_id').single()
      setBusy(false)
      if(error){setError(error.code==='23505'?'You already have a suggestion waiting for review.':'Could not save. Your changes are still here. Please retry.');return}
      saved()
    }}><TextField label={mode==='notes'?'Your notes':'Suggested description'} name="body" value={mode==='notes'?state?.body:item.details} required={mode==='suggest'} />{mode==='suggest' && <p className="field-hint">Your manager will review this before the responsibility changes.</p>}{error && <p role="alert" className="field-error">{error}</p>}<Button type="submit" disabled={busy}>{busy?'Saving…':mode==='notes'?'Save notes':'Send suggestion'}</Button></form>}
  </RoleDrawer>
}
