import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase'
import {Button} from '../../components/ui/Button'
export function RoleProfileIntro({role,holder,title,own,editTitle}:{role:string;holder:string;title:string;own:boolean;editTitle:()=>void}){
 const [intro,setIntro]=useState(''),[draft,setDraft]=useState(''),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),[loaded,setLoaded]=useState(false)
 useEffect(()=>{let live=true;void supabase.rpc('role_introduction',{p_role:role}).then(({data,error:failure})=>{if(!live)return;if(failure){setError('Your role introduction could not be loaded.');return}setError('');const text=(data as {introduction?:string})?.introduction??'';setIntro(text);setDraft(text);setLoaded(true)});return()=>{live=false}},[role,revision])
 const initials=holder.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('')
 async function save(){setBusy(true);setError('');try{const r=await supabase.rpc('role_introduction',{p_role:role,p_text:draft});if(r.error)throw r.error;setIntro((r.data as {introduction:string}).introduction);setEditing(false)}catch{setError('Your introduction could not be saved. Check the text and try again.')}finally{setBusy(false)}}
 return <div className="rc-role-profile-intro"><div className="rc-role-identity"><span className="rc-role-avatar" aria-hidden="true">{initials}</span><div><h2>{holder}</h2>{own?<button className="rc-text rc-role-title" aria-label={title?'Edit role title':'Add role title'} onClick={editTitle}>{title||'Add role title'}</button>:<p className="rc-role-title">{title}</p>}</div></div>
 {intro&&!editing&&<p className="rc-role-bio">{intro}</p>}
 {own&&!editing&&<button className="rc-text" disabled={!loaded} onClick={()=>{setDraft(intro);setEditing(true)}}>{intro?'Edit introduction':'Add introduction'}</button>}
 {own&&editing&&<form className="auth-form" onSubmit={e=>{e.preventDefault();void save()}}><div className="field"><label htmlFor="role-introduction">About my role</label><textarea id="role-introduction" rows={4} maxLength={1200} value={draft} onChange={e=>setDraft(e.target.value)} disabled={busy}/></div><div className="form-actions"><Button type="submit" disabled={busy}>{busy?'Saving…':'Save introduction'}</Button><Button variant="secondary" disabled={busy} onClick={()=>{setEditing(false);setDraft(intro)}}>Cancel</Button></div></form>}
 {error&&<p className="field-error" role="alert">{error} {!editing&&<button className="rc-text" onClick={()=>setRevision(n=>n+1)}>Retry introduction</button>}</p>}
 </div>
}
