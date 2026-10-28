import {useState} from 'react'
import {RoleDrawer} from '../records/RoleDrawer'
import {Button} from '../../components/ui/Button'
export function DecisionReasonPrompt({title,confirm,close}:{title:string;confirm:(reason:string)=>Promise<void>;close:()=>void}){
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function finish(value:string){setBusy(true);setError('');try{await confirm(value);close()}catch{setError('The task could not be completed. Your reason has been kept.')}finally{setBusy(false)}}
 return <RoleDrawer context="My day" title="Complete decision task" close={busy?()=>{}:close}><form className="md-task-panel" onSubmit={e=>{e.preventDefault();void finish(reason)}}><h2>{title}</h2><label className="field">Why did you decide this?<input autoFocus value={reason} maxLength={5000} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>{error&&<p role="alert" className="field-error">{error}</p>}<div className="form-actions"><Button type="submit" loading={busy} disabled={!reason.trim()}>Save reason and complete</Button><Button variant="secondary" disabled={busy} onClick={()=>void finish('')}>Skip and complete</Button></div></form></RoleDrawer>
}
