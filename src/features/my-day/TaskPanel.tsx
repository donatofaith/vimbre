import {runAI} from '../../lib/ai-gateway'
import {parseTaskDraft} from './task-draft'
import type {TaskDraft} from './task-draft'
import './task-details.css'
import {TimeField} from './TimeField'
import {trackTaskCreated,trackTaskCompleted} from '../../lib/analytics'
import {supabase} from '../../lib/supabase'
import type {Json} from '../../lib/database.types'
import {SegmentedControl} from '../../components/ui/SegmentedControl'
import { useState,useEffect,useRef } from "react";
import type { FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { RoleDrawer } from "../records/RoleDrawer";
import { safeRecordUrl } from "../records/record-utils";
import type { StructuredDraft } from "../ai/structured-output";
import { ForPicker } from "./ForPicker";
import type { Task, ForOption } from "./types";
import { changeTask, taskError } from "./api";
export function TaskPanel({
  task,
  draft,
  stepsFirst=false,
  today,
  close,
  saved,
  remove,
}: {
  task?: Task;
  stepsFirst?: boolean;
  draft?: StructuredDraft;
  today: string;
  close: () => void;
  saved: () => void;
  remove?: (future:boolean) => Promise<boolean>;
}) {

  const [title,setTitle]=useState(task?.title??draft?.title??''),[notes,setNotes]=useState(task?.details??draft?.details??''),[steps,setSteps]=useState((task?.steps??[]).join('\n'));
  const [repeat,setRepeat]=useState(task?.repeat_rule?.frequency??'none'),[every,setEvery]=useState(task?.repeat_rule?.every_n??1),[unit,setUnit]=useState(task?.repeat_rule?.unit??'day');
  const [aiBusy,setAiBusy]=useState(false),[aiDraft,setAiDraft]=useState<TaskDraft|null>(null);
  async function improve(){if(!title.trim()&&!notes.trim()){setError('Describe the task first.');return}setAiBusy(true);setError('');try{const result=await runAI('tasks_extract',JSON.stringify({purpose:'improve_task',today,title,details:notes,due_date:date,due_time:time,priority,status,time_needed_minutes:duration?Number(duration):null,steps:steps.split('\n').filter(Boolean),repeat}));if(!result.ok)throw Error(result.message);setAiDraft(parseTaskDraft(result.text))}catch(e){setError((e as Error).message)}finally{setAiBusy(false)}}
  function applyDraft(){if(!aiDraft)return;setTitle(aiDraft.title);setNotes(aiDraft.details);setPriority(aiDraft.priority);setDate(aiDraft.due_date||date);setTime(aiDraft.due_time||time);setDuration(aiDraft.time_needed_minutes?String(aiDraft.time_needed_minutes):duration);setSteps(aiDraft.steps.join('\n'));setRepeat(aiDraft.repeat);setAiDraft(null);schedule()}

  const version=useRef(task?.updated_at),changes=useRef(0),savedChanges=useRef(0);
  const [confirmDelete,setConfirmDelete]=useState(false),[deleting,setDeleting]=useState(false);
  const [saveState,setSaveState]=useState(''),[priority,setPriority]=useState(task?.priority??'normal'),[status,setStatus]=useState(task?.status??'open'),[reminder,setReminder]=useState(task?.reminder_option??'at_time'),[duration,setDuration]=useState(task?.time_needed_minutes?String(task.time_needed_minutes):'');
  function schedule(){changes.current++;setSaveState('Unsaved changes')}
  const [date, setDate] = useState(
      task ? task.due_date??"" : (draft ? draft.due_date || "" : today),
    ),
    [time, setTime] = useState(
      task?.due_time?.slice(0, 5) || draft?.due_time || "",
    );
  const [forValue, setFor] = useState<ForOption | null>(
    task?.department_id
      ? {
          id: task.department_id,
          kind: "department",
          name: task.department_name ?? "Current department",
          label: `${task.department_name ?? "Current department"} (Department)`,
        }
      : task?.external_contact_id
        ? {
            id: task.external_contact_id,
            kind: "contact",
            name: task.external_contact_name ?? "Current external contact",
            label: `${task.external_contact_name ?? "Current external contact"} (External contact)`,
          }
        : null,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [id] = useState(() => task?.id ?? crypto.randomUUID());
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy||aiBusy) return;
    if(!navigator.onLine&&JSON.stringify({frequency:repeat,every_n:every,unit})!==JSON.stringify({frequency:task?.repeat_rule?.frequency??'none',every_n:task?.repeat_rule?.every_n??1,unit:task?.repeat_rule?.unit??'day'})){setError('Connect to save a repeat rule.');return;}
    setBusy(true);
    setError("");
    const savingRevision=changes.current;
    const fd = new FormData(event.currentTarget),
      get = (k: string) => String(fd.get(k) ?? "").trim();
    const url = get("source_url"), links=get("links").split("\n").map(s=>s.trim()).filter(Boolean);
    if (url && !safeRecordUrl(url) || links.some(link=>!safeRecordUrl(link))) {
      setError("Use a valid http or https link.");
      setBusy(false);
      return;
    }
    if(repeat!=='none'&&(!date||status==='done')){setError('Repeating tasks need a due date and an open status.');setBusy(false);return;}
    try {
      const payload={
        title: get("title"),
        base_updated_at: version.current,
        due_date: date,
        due_time: date?time:"",
        details: get("details"),
        status: get("status"),
        priority,
        time_needed_minutes: get("time_needed_minutes")?Number(get("time_needed_minutes")):null,
        label: get("label"),
        steps: get("steps").split("\n").map(s=>s.trim()).filter(Boolean),
        links,
        reminder_option: get("reminder_option"),
        completion_note: get("completion_note"),
        source_url: url,
        department_id: forValue?.kind === "department" ? forValue.id : null,
        external_contact_id: forValue?.kind === "contact" ? forValue.id : null,
        repeat: repeat==='none'?{stop:true}:{frequency:repeat,every_n:every,unit},
        source_kind: task?.source_kind ?? (draft ? "ai" : "manual"),
      };
      if(task&&!navigator.onLine){await changeTask(id,'edit',payload,{completed:task.status!=='done'&&payload.status==='done'});savedChanges.current=savingRevision;setSaveState('Saved on this device · waiting to sync');if(changes.current===savingRevision)saved();}
      else if(task){const result=await supabase.rpc('myday_save_task',{p_id:id,p_data:payload as Json,p_create:false});if(result.error)throw result.error;if(task.status!=='done'&&payload.status==='done')trackTaskCompleted(id,'manual');const state=result.data as {updated_at?:string};if(state.updated_at)version.current=state.updated_at;savedChanges.current=savingRevision;setSaveState('Saved');window.dispatchEvent(new Event('vimbre:work-changed'));if(changes.current===savingRevision)saved();else setSaveState('Unsaved changes');}
      else if(!navigator.onLine){await changeTask(id,'create',payload);saved();}
      else {const result=await supabase.rpc('myday_save_task',{p_id:id,p_data:payload as Json,p_create:true});if(result.error)throw result.error;trackTaskCreated(id,draft?'ai':'manual');if(status==='done')trackTaskCompleted(id,'manual');window.dispatchEvent(new Event('vimbre:work-changed'));saved();}
    } catch (reason) {
      const code = (reason as { code?: string })?.code;
      if (code === '40001') {
        // A stale editor must be closed immediately. Keeping it mounted leaves
        // the old base_updated_at in memory and can cause repeated submissions.
        window.dispatchEvent(new Event('vimbre:work-changed'));
        setSaveState('Task changed — reloading.');
        close();
        return;
      }
      setError(taskError(reason));setSaveState('Changes not saved');
    } finally {
      setBusy(false);
    }
  }
  async function deleteTask(future=false){
    if(!task||!remove||busy)return
    setBusy(true);setDeleting(true);setError('')
    try{if(!await remove(future))setError('The task could not be deleted. Please try again.')}catch(reason){setError(taskError(reason))}finally{setBusy(false);setDeleting(false)}
  }
  function finish(){if(busy)return;if(changes.current!==savedChanges.current&&!window.confirm('Discard your unsaved changes?'))return;close()}

  const controlled=JSON.stringify([date,time,forValue,priority,status,reminder,duration,repeat,every,unit]),lastControlled=useRef(controlled);
  useEffect(()=>{if(lastControlled.current!==controlled){lastControlled.current=controlled;schedule()}},[controlled]);
  return (
    <RoleDrawer
      context="My day"
      className="md-task-drawer"
      title={task ? "Edit task" : "Add a task"}
      close={finish}
    >
      <section className="md-task-panel">
        <h2>{task ? "Edit task" : "Add a task"}</h2>
        {draft && (
          <p className="md-draft-note">
            Draft from Vimbre AI. Check before saving.
          </p>
        )}
        <form className="auth-form md-task-edit-form" onSubmit={save} onInput={schedule} onChange={schedule}>
          <div className="md-task-fields">
          <div className="md-task-ai-tools"><Button variant="secondary" disabled={busy||aiBusy} onClick={()=>void improve()}>{aiBusy?'Improving task…':'Use VimbreAI'}</Button></div>
          {aiDraft&&<section className="md-task-ai-review"><h3>Suggested task</h3><strong>{aiDraft.title}</strong><p>{aiDraft.details}</p><p>{aiDraft.due_date?`Due ${aiDraft.due_date}`:'No due date'} · {aiDraft.priority} priority{aiDraft.time_needed_minutes?` · ${aiDraft.time_needed_minutes} minutes`:''} · {aiDraft.repeat==='none'?'Does not repeat':aiDraft.repeat}</p>{aiDraft.steps.length>0&&<ul>{aiDraft.steps.map((v,i)=><li key={i}>{v}</li>)}</ul>}<div className="form-actions"><Button onClick={applyDraft}>Use this draft</Button><Button variant="secondary" onClick={()=>setAiDraft(null)}>Discard</Button></div></section>}
          <Input
            autoFocus
            data-autofocus=""
            label="What needs to be done?"
            name="title"
            required
            maxLength={300}
            value={title} onChange={e=>setTitle(e.target.value)}
            placeholder="e.g. Share the supplier review notes"
          />
              <div className="field">
                <span>Status</span>
                <input type="hidden" name="status" value={status}/><SegmentedControl label="Status" value={status} onChange={setStatus} options={[{value:'open',label:'To do'},{value:'in_progress',label:'In progress'},{value:'done',label:'Done'}]}/>
              </div>
          <div className="md-task-basics"><label className="field">Due date<input id="md-date" type="date"value={date}onChange={e=>setDate(e.target.value)}/></label>
          <label className="field">Repeat<select value={repeat}disabled={Boolean(task?.recurring_id)}onChange={e=>setRepeat(e.target.value)}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom</option></select></label>
          <label className="field">Priority<select value={priority}onChange={e=>setPriority(e.target.value as typeof priority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
          <label className="field">Estimated duration (minutes)<input type="number"name="time_needed_minutes"min={10}max={480}value={duration}onChange={e=>setDuration(e.target.value)}placeholder="e.g. 30"/></label></div>
          {repeat==='custom'&&<div className="md-task-basics"><label className="field">Every<input type="number"min={1}max={365}value={every}onChange={e=>setEvery(Number(e.target.value))}/></label><label className="field">Interval<select value={unit}onChange={e=>setUnit(e.target.value)}><option value="day">Days</option><option value="week">Weeks</option><option value="month">Months</option></select></label></div>}
          <div className="field"><label htmlFor={`md-notes-${id}`}>Notes</label><textarea id={`md-notes-${id}`} name="details"rows={3}maxLength={5000}value={notes}onChange={e=>setNotes(e.target.value)}placeholder="Add context or instructions"/></div>
          <details className="md-more" open={stepsFirst||undefined}>
            <summary>More options</summary>
            <div className="auth-form">

          <TimeField value={time} disabled={!date} onChange={setTime}/>
          <ForPicker
            suggestion={draft?.department_name || draft?.external_contact_name}
            value={forValue}
            onChange={setFor}
          />

              <div className="field">
                <span>Remind me</span>
                <input type="hidden" name="reminder_option" value={reminder}/><SegmentedControl label="Remind me" value={reminder} onChange={setReminder} options={[{value:'at_time',label:'At due time'},{value:'30_minutes',label:'30 minutes before'},{value:'1_hour',label:'1 hour before'},{value:'day_before',label:'The day before at 9:00'}]}/>
              </div>
              <div className="field">
                <label htmlFor="md-cover-note">
                  Note for whoever covers this
                </label>
                <textarea
                  id="md-cover-note"
                  name="completion_note"
                  rows={3}
                  maxLength={5000}
                  defaultValue={task?.completion_note}
                />
              </div>
              <Input label="Label" name="label" maxLength={80} defaultValue={task?.label??""}/>
              <label className="field">Steps<textarea name="steps" rows={4} maxLength={5000} value={steps} onChange={e=>setSteps(e.target.value)} placeholder="One step per line"/></label>
              <label className="field">Links<textarea name="links" rows={3} maxLength={5000} defaultValue={(task?.links??[]).join("\n")} placeholder="One https link per line"/></label>
              <Input
                label="Link to the email or notes (optional)"
                name="source_url"
                type="url"
                maxLength={2048}
                defaultValue={task?.source_url ?? ""}
              />
            </div>
          </details>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          </div>
          {confirmDelete&&<section className="md-delete-confirm" aria-label="Confirm task deletion"><h3>Delete task?</h3><p>{task?.repeat_rule?'Choose whether to delete this occurrence or this and all future occurrences.':'This task will move to Deleted.'} Linked decisions and sources stay.</p><div className="form-actions"><Button variant="danger" className="md-delete" disabled={busy} onClick={()=>void deleteTask(false)}>{deleting?'Deleting…':task?.repeat_rule?'Delete this one':'Delete task'}</Button>{task?.repeat_rule&&<Button variant="danger" className="md-delete" disabled={busy} onClick={()=>void deleteTask(true)}>Delete this and future ones</Button>}<Button variant="secondary" disabled={busy} onClick={()=>setConfirmDelete(false)}>Keep task</Button></div></section>}
          <div className="md-panel-actions">
            <span role="status">{busy?deleting?'Deleting…':'Saving…':saveState}</span>
            <Button variant="secondary" onClick={finish} disabled={busy}>Cancel</Button>
            {task&&!task.deleted_at&&remove&&<details className="md-task-action-menu"><summary>More actions</summary><div><Button variant="danger" className="md-delete" onClick={e=>{e.currentTarget.closest("details")?.removeAttribute("open");if(task.capture_id||task.decision_id||task.repeat_rule)setConfirmDelete(true);else void deleteTask(false)}} disabled={busy}>{deleting?'Deleting…':'Delete task'}</Button></div></details>}
            <Button type="submit" disabled={busy||aiBusy||confirmDelete}>{busy&&!deleting?'Saving…':task?'Save changes':'Save task'}</Button>
          </div>
        </form>
      </section>
    </RoleDrawer>
  );
}
