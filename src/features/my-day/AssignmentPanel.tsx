import {useEffect,useState} from 'react'
import {RoleDrawer} from '../records/RoleDrawer'
import {Button} from '../../components/ui/Button'
import {daySuite,suiteError} from './suite-api'
import type {DayPerson} from './suite-api'
import type {Task} from './types'
export function AssignmentPanel({task,close,saved}:{task?:Task;close:()=>void;saved:()=>void}){
 const [people,setPeople]=useState<DayPerson[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[id]=useState(()=>crypto.randomUUID())
 useEffect(()=>{let live=true;void daySuite<DayPerson[]>('people').then(v=>{if(live)setPeople(v)}).catch(()=>{if(live)setError('People could not be loaded.')});return()=>{live=false}},[])
 return <RoleDrawer context="My day" title="Assign task" close={close}><div className="md-task-panel"><h2>Assign task</h2><form className="auth-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError('');try{await daySuite('assign',id,{title:String(f.get('title')),details:String(f.get('details')??''),recipient_id:String(f.get('recipient_id')),due_date:String(f.get('due_date')??''),source_task:task?.id});saved()}catch(e){setError(suiteError(e))}finally{setBusy(false)}}}><label className="field">Title<input name="title" defaultValue={task?.title??''} required maxLength={300}/></label><label className="field">Give to<select name="recipient_id" required><option value="">Choose a person</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="field">Due date<input type="date" name="due_date" defaultValue={task?.due_date??''}/></label><label className="field">Notes to share<textarea name="details" rows={4} maxLength={5000}/></label><p className="field-hint">They review this title, date and shared notes before accepting. Your task notes and source stay private.</p>{error&&<p role="alert" className="field-error">{error}</p>}<Button type="submit" disabled={busy}>{busy?'Sending…':'Send for acceptance'}</Button></form></div></RoleDrawer>
}
