import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase'
import {Button} from '../../components/ui/Button'
import {changeTask,taskError} from './api'
import type {Task} from './types'
export function SkipReview({breakDown}:{breakDown:(task:Task)=>void}){
 const [tasks,setTasks]=useState<Task[]>([]),[busy,setBusy]=useState(''),[error,setError]=useState('')
 useEffect(()=>{let live=true;async function load(){const r=await supabase.rpc('myday_skip_review',{});if(live&&!r.error&&r.data&&typeof r.data==='object'&&!Array.isArray(r.data)&&Array.isArray(r.data.tasks))setTasks(r.data.tasks as unknown as Task[])}void load();window.addEventListener('vimbre:work-changed',load);return()=>{live=false;window.removeEventListener('vimbre:work-changed',load)}},[])
 if(!tasks.length)return null
 async function act(task:Task,operation:'keep'|'delete'){
  if(operation==='delete'&&!window.confirm('Delete this task? Its source and decisions stay.'))return
  setBusy(task.id);setError('');try{if(operation==='delete')await changeTask(task.id,'delete');else{const r=await supabase.rpc('myday_skip_review',{p_operation:'keep',p_task:task.id});if(r.error)throw r.error}setTasks(old=>old.filter(t=>t.id!==task.id))}catch(e){setError(taskError(e))}finally{setBusy('')}
 }
 return <section className="md-skip-review"><h3>Skipped three days in a row</h3><p>Keep the task, break it into smaller steps, or delete it.</p><ul>{tasks.slice(0,5).map(task=><li key={task.id}><strong>{task.title}</strong><div className="form-actions"><Button variant="secondary" disabled={Boolean(busy)} onClick={()=>void act(task,'keep')}>Keep task</Button><Button variant="secondary" disabled={Boolean(busy)} onClick={()=>breakDown(task)}>Break into steps</Button><Button variant="danger" disabled={Boolean(busy)} onClick={()=>void act(task,'delete')}>Delete task</Button></div></li>)}</ul>{tasks.length>5&&<p>{tasks.length-5} more tasks need a decision. Review these first.</p>}{error&&<p role="alert" className="field-error">{error}</p>}</section>
}
