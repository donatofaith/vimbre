import {useState} from 'react'
import {Button} from '../../components/ui/Button'
import {connectionCall} from '../capture/capture-api'
export function PlanningCalendarSettings(){
 const [busy,setBusy]=useState(''),[error,setError]=useState('')
 async function connect(provider:'outlook'){setBusy(provider);setError('');try{const r=await connectionCall({action:'connect',provider,calendar:true});if(!r.url||!/^https:\/\/(login\.microsoftonline\.com)\//.test(r.url)||!r.state||!/^[a-f0-9]{64}$/.test(r.state))throw Error('Calendar connection could not be started.');sessionStorage.setItem('vimbre:tool-connect-state',r.state);sessionStorage.setItem('vimbre:tool-connect-return','myday');window.location.assign(r.url)}catch(e){setError((e as Error).message);setBusy('')}}
 return <section className="card settings-card"><h2>Calendar for My Day</h2><p>Use busy times from your primary calendar when planning. Vimbre does not save meeting titles, attendees or descriptions. Without a calendar, your working hours apply.</p><p>If a task has no estimate, planning uses your usual duration from your own Start and Done entries. That duration is private to you.</p><div className="form-actions"><Button variant="secondary" disabled={Boolean(busy)} loading={busy==='outlook'} onClick={()=>void connect('outlook')}>Use Outlook Calendar</Button></div><p>Microsoft will ask you to approve calendar access. Disconnect the account in Connected tools to stop using it.</p>{error&&<p role="alert" className="field-error">{error}</p>}</section>
}
