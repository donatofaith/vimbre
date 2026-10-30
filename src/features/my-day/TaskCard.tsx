import {useTaskFormat,formatTaskDay} from './task-format'
import type {ReactNode} from 'react'
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";
import { RoleDrawer } from "../records/RoleDrawer";
import { safeRecordUrl } from "../records/record-utils";
import { dateInZone, sourceLabels, statuses, taskDate } from "./types";
import type { Task } from "./types";
const label = (value: string | null) =>
  value === "archived"
    ? "Deleted"
    : (statuses.find(([v]) => v === value)?.[1] ?? "Created");
export function TaskRecord({
  task,
  zone,
  close,
}: {
  task: Task;
  zone: string;
  close: () => void;
}) {
  const format=useTaskFormat();
  const [history, setHistory] = useState<
      | {
          id: number;
          event?: string | null;
          previous_status: string | null;
          status: string;
          created_at: string;
        }[]
      | null
    >(null),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    void supabase
      .rpc("myday_task_history", { p_id: task.id })
      .then(({ data, error }) => {
        if (live) {
          setHistory(
            Array.isArray(data)
              ? (data as unknown as NonNullable<typeof history>)
              : null,
          );
          setError(Boolean(error) || !Array.isArray(data));
        }
      });
    return () => {
      live = false;
    };
  }, [task.id, task.status, task.deleted_at, retry]);
  return (
    <RoleDrawer context="My day" title="Task record" close={close}>
      <div className="md-task-panel">
        <h2>{task.title}</h2>
        <p>
          {taskDate(task, zone,format.language,format.style)} ·{" "}
          {task.deleted_at ? "Deleted" : label(task.status)}
        </p>
        {task.details && <p className="record-text">{task.details}</p>}
        {task.context_added_at && task.completion_note && (
          <>
            <h3>Outcome</h3>
            <p className="record-text">{task.completion_note}</p>
          </>
        )}
        {task.capture_record_id && <Link to={`/app/role-record?section=workstream&record=${task.capture_record_id}`}>Open linked Record</Link>}
        <h3>Status history</h3>
        {error ? (
          <p role="alert">
            History could not be loaded.{" "}
            <button onClick={() => setRetry((v) => v + 1)}>
              Retry history
            </button>
          </p>
        ) : !history ? (
          <p role="status">Loading history…</p>
        ) : (
          <ol className="md-history">
            {history.map((h) => (
              <li key={h.id}>
                <strong>
                  {h.event ? ({baseline:"Recorded state",created:"Created",done:"Done",deleted:"Deleted",restored:"Restored",starred:"Starred",unstarred:"Unstarred",rescheduled:"Snoozed or rescheduled",outcome_saved:"Outcome saved",updated:"Updated",status_changed:"Status changed"} as Record<string,string>)[h.event]??h.event : h.previous_status
                    ? `${label(h.previous_status)} → ${label(h.status)}`
                    : `Recorded as ${label(h.status)}`}
                </strong>
                <time dateTime={h.created_at}>
                  {new Intl.DateTimeFormat(format.language, {
                    dateStyle: format.style,
                    timeStyle: "short",
                    timeZone: zone,
                  }).format(new Date(h.created_at))}
                </time>
              </li>
            ))}
          </ol>
        )}
      </div>
    </RoleDrawer>
  );
}
export function TaskCard({undo,task,zone,busy,now,initialOpen=false,act,edit,remind,context,quickContext,record,drag,inspect,onClose,panelOnly=false,tools,selecting=false,selected=false,select}: {
 tools?:ReactNode;selecting?:boolean;selected?:boolean;select?:()=>void;
 inspect?:(task:Task)=>void;onClose?:()=>void;panelOnly?:boolean;
 undo?:()=>void;task: Task;zone:string;busy:boolean;rank?:number;initialOpen?:boolean;now:Date;
 act:(task:Task,op:string,values:Record<string,unknown>)=>void;
 edit:(task:Task)=>void;remind:(task:Task)=>void;context:(task:Task)=>void;
 quickContext:(task:Task,outcome:string)=>void;record:(task:Task)=>void;drag:(id:string)=>void;
}) {
 const format=useTaskFormat();
 const [open,setOpen]=useState(initialOpen),[outcome,setOutcome]=useState(task.completion_note??"");
 const touch=useRef<{x:number;y:number}|null>(null);
 const dueDay=task.due_time?dateInZone(zone,new Date(task.due_at)):task.due_date;
 const rowDate=dueDay===dateInZone(zone,now)?task.due_time?new Intl.DateTimeFormat(format.language,{hour:'2-digit',minute:'2-digit',timeZone:zone}).format(new Date(task.due_at)):'Today':taskDate(task,zone,format.language,format.style);
 const source=task.source_role_id??task.stable_role_item_id??task.recurring_id;
 const sourceUrl=safeRecordUrl(task.source_origin_url??task.source_url);
 return <>{!panelOnly&&<article className={`md-task-card md-slim-row ${undo?"md-completion-pending":""} ${task.status==="done"?"md-task-completed":""}`} data-task-id={task.id} onTouchStart={e=>{if(e.touches.length===1)touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY}}} onTouchEnd={e=>{const start=touch.current;touch.current=null;if(!start||!e.changedTouches.length||busy||selecting||task.deleted_at||task.missed_at)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;if(Math.abs(dy)<35&&Math.abs(dx)>85){if(dx>0)act(task,"status",{status:task.status==="done"?"open":"done"});else if(task.status!=="done")act(task,"tomorrow",{})}}} draggable={!task.deleted_at&&!busy} onDragStart={e=>{drag(task.id);e.dataTransfer.setData("text/plain",task.id)}} onDragEnd={()=>drag("")}>
   <label className="md-check-target"><input type="checkbox" aria-label={`${selecting?"Select":"Done"}: ${task.title}`} checked={selecting?selected:task.status==="done"} disabled={busy||Boolean(task.deleted_at)||Boolean(task.missed_at)} onChange={e=>selecting?select?.():act(task,"status",{status:e.target.checked?"done":"open"})}/></label>
   <button className="md-task-title" aria-label={task.title} onClick={()=>inspect?inspect(task):setOpen(true)}>{task.metadata?.plan_day===dateInZone(zone,now)&&task.metadata.plan_order&&<small className="md-plan-order">{task.metadata.plan_order} {Number(task.metadata.plan_order)===1?"First":"Next"} · </small>}{task.title}{task.missed_at&&<small className="md-progress-chip">Missed</small>}{task.pinned_at&&<span className="md-star-mark" aria-label="Starred">★</span>}{task.status==="in_progress"&&<small className="md-progress-chip">In progress</small>}</button>
   <time dateTime={task.due_at}><span className="md-due-label" title={taskDate(task,zone,format.language,format.style)}>{rowDate}</span>{task.status!=="done"&&task.due_time&&new Date(task.due_at)<now&&dateInZone(zone,new Date(task.due_at))===dateInZone(zone,now)&&<small className="md-earlier-tag">Earlier</small>}</time>
   {undo&&<button className="md-row-undo" onClick={undo}>Undo</button>}</article>}{open&&<RoleDrawer context="My day" title={task.title} close={()=>{setOpen(false);onClose?.()}}><div className="md-task-panel">
    <h2>{task.title}</h2><p>{taskDate(task,zone,format.language,format.style)}</p>
    {task.details&&<p className="record-text">{task.details}</p>}
    <div className="md-source-detail"><strong>From </strong>{task.source_name??sourceLabels[task.source_kind??"manual"]}{task.source_date&&<span>{formatTaskDay(task.source_date,format)}</span>}{task.source_connected===false&&<span>Source disconnected</span>}{sourceUrl&&<a href={sourceUrl} target="_blank" rel="noopener noreferrer">Open in {task.source_name??"app"}</a>}{source&&<Link to={`/app/role-record?section=${task.source_role_kind??"recurring_deadline"}&record=${source}${task.source_role_profile_id?`&role=${task.source_role_profile_id}`:""}`}>Open role record</Link>}{task.capture_id&&<Link to={`/app/capture?capture=${task.capture_id}`}>View captured source</Link>}</div>
    {(task.source_excerpt||task.capture_excerpt)&&<details><summary>Source excerpt</summary><p className="record-text">{task.source_excerpt||task.capture_excerpt}</p></details>}
    {task.label&&<p>Label: {task.label}</p>}{task.time_needed_minutes&&<p>Time needed: {task.time_needed_minutes} minutes</p>}
    {Boolean(task.steps?.length)&&<section><h3>Steps</h3><ol>{task.steps!.map((step,i)=><li key={i}>{step}</li>)}</ol></section>}
    {Boolean(task.links?.length)&&<section><h3>Links</h3><ul>{task.links!.map((link,i)=>safeRecordUrl(link)&&<li key={i}><a href={safeRecordUrl(link)!} target="_blank" rel="noopener noreferrer">{link}</a></li>)}</ul></section>}
    {task.decision_id?<Link to={`/app/decisions?decision=${task.decision_id}`}>Part of: {task.decision_title??"Decision"}</Link>:null}
    <div className="md-expanded-actions"><button className="md-text-button" onClick={()=>{setOpen(false);record(task)}}>Record</button>{!task.deleted_at&&<button className="md-text-button" onClick={()=>{setOpen(false);edit(task)}}>Edit task</button>}</div>
    {!task.deleted_at&&!task.missed_at&&<><label className="field">Status<select aria-label={`Status for ${task.title}`} value={task.status} disabled={busy} onChange={e=>act(task,"status",{status:e.target.value})}>{statuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    {task.status!=="done"&&<div className="md-expanded-actions"><button className="md-text-button" disabled={busy} aria-pressed={Boolean(task.pinned_at)} onClick={()=>act(task,"pin",{pinned:!task.pinned_at})}>{task.pinned_at?"Unstar":"Star"}</button><button className="md-text-button" onClick={()=>{setOpen(false);remind(task)}}>Remind me / Snooze</button><button className="md-text-button" disabled={busy} onClick={()=>act(task,"tomorrow",{})}>Tomorrow</button></div>}
    {task.status==="done"&&(task.context_added_at?<span className="md-context-added">Added to the Record</span>:<div className="md-quick-context"><label>Add the outcome to the record? (optional)<textarea maxLength={5000} value={outcome} onChange={e=>setOutcome(e.target.value)}/></label><span className="field-hint">My notes · Private</span><button className="md-text-button" disabled={busy||!outcome.trim()} onClick={()=>quickContext(task,outcome)}>Save outcome</button><button className="md-text-button" onClick={()=>{setOpen(false);context(task)}}>Choose where to save</button></div>)}
    </>}
    {tools}
    {task.deleted_at&&<><p>Deleted tasks can be restored for 30 days.</p><Button disabled={busy} onClick={()=>act(task,"restore",{})}>Restore</Button></>}
   </div></RoleDrawer>}
 </>;
}
