import {useEffect,useState} from 'react'
import {Button} from '../../components/ui/Button'
import {handoverRpc,sectionLabels} from './model'
import type {HandoverPolicy} from './model'
export function HandoverSettings(){
 const [policy,setPolicy]=useState<HandoverPolicy|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{let live=true;void handoverRpc('policy').then(r=>{if(live)setPolicy(r as HandoverPolicy)}).catch(()=>{if(live)setError('Handover settings could not be loaded.')});return()=>{live=false}},[])
 function change(key:string,value:unknown){setMessage('');setPolicy(p=>p?{...p,[key]:value}:p)}
 return <section className="card settings-card"><h2>Handovers</h2>{error&&<p role="alert" className="field-error">{error}</p>}{policy?.admin?<form className="auth-form" onSubmit={e=>{e.preventDefault();setBusy(true);setError('');void handoverRpc('policy_save',null,policy as unknown as Record<string,boolean|string|number|string[]>).then(r=>{setPolicy({...r as HandoverPolicy,admin:true});setMessage('Handover settings saved.')}).catch(e=>setError(e.message)).finally(()=>setBusy(false))}}><fieldset disabled={busy}>
 <label className="ho-choice"><input type="checkbox" checked={policy.approval_required} onChange={e=>change('approval_required',e.target.checked)}/>Require approval</label>
 <label className="ho-choice"><input type="checkbox" checked={policy.allow_top_no_approval} onChange={e=>change('allow_top_no_approval',e.target.checked)}/>Allow the top company admin without a line manager to assign cover without approval</label>
 <fieldset><legend>Who can approve</legend>{[['manager','Managers'],['hr_admin','Admins']].map(([key,label])=><label className="ho-choice" key={key}><input type="checkbox" checked={policy.approver_roles.includes(key)} onChange={e=>change('approver_roles',e.target.checked?[...policy.approver_roles,key]:policy.approver_roles.filter(r=>r!==key))}/>{label}</label>)}</fieldset>
 <label>Minimum notice (days)<input type="number" min="0" max="90" required value={policy.minimum_notice_days} onChange={e=>change('minimum_notice_days',Number(e.target.value))}/></label>
 <label>Cover can view<select value={policy.cover_visibility} onChange={e=>change('cover_visibility',e.target.value)}><option value="approval">After approval</option><option value="assignment">On assignment</option></select></label>
 <label className="ho-choice"><input type="checkbox" checked={policy.external_sharing} onChange={e=>change('external_sharing',e.target.checked)}/>Allow external read only links</label>
 <label>Default link expiry (days)<input type="number" min="1" max="30" required value={policy.link_expiry_days} onChange={e=>change('link_expiry_days',Number(e.target.value))}/></label>
 <label>Cover capacity warning (people)<input type="number" min="1" max="50" required value={policy.cover_capacity} onChange={e=>change('cover_capacity',Number(e.target.value))}/></label>
 <fieldset><legend>Required sections</legend>{sectionLabels.map(([key,label])=><label className="ho-choice" key={key}><input type="checkbox" checked={policy.required_sections.includes(key)} onChange={e=>change('required_sections',e.target.checked?[...policy.required_sections,key]:policy.required_sections.filter(s=>s!==key))}/>{label}</label>)}</fieldset>
 </fieldset><Button type="submit" disabled={busy}>{busy?'Saving…':'Save handover settings'}</Button></form>:policy&&<p>Your company sets approval, cover access and sharing rules.</p>}{message&&<p role="status">{message}</p>}</section>
}
