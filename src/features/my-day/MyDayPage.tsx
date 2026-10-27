import {NextPlannedTask} from './NextPlannedTask'
import {StarsPanel} from './StarsPanel'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import {TaskFormatContext,formatTaskDay} from './task-format'
import type {TaskFormat} from './task-format'
import {OfflineStatus} from './OfflineStatus'
import {cacheDay,cachedDay} from './offline'
import {useDaySuite} from './useDaySuite'
import {daySuite,suiteError} from './suite-api'
import {TemplatePicker} from './TemplatePicker'
import {RulesPanel} from './RulesPanel'
import {AssignmentPanel} from './AssignmentPanel'
import {PlanMyDay} from './TaskAI'
import {TaskTools,TaskComments} from './TaskTools'
import {CalendarPanel} from './CalendarPanel'
import {ImportExportPanel} from './ImportExportPanel'
import {TeamDayPanel} from './TeamDayPanel'
import {parseQuickTask} from "./quick-add";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { WorkspaceIcon } from "../../components/ui/WorkspaceIcon";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { CaptureSummary } from "../workspace/MyDayOverview";
import { useMyDaySummary } from "../workspace/useMyDaySummary";
import { WorkVisibilityDetails } from "../workspace/WorkVisibilityDetails";
import { TaskPanel } from "./TaskPanel";
import { ForPicker } from "./ForPicker";
import { ContextPanel } from "./ContextPanel";
import { ReminderPanel } from "./ReminderPanel";
import { TaskCard, TaskRecord } from "./TaskCard";
import { RoleTaskPicker } from "./RoleTaskPicker";
import { changeTask, taskError } from "./api";
import {
  addDays,
  dateInZone,
  greetingInZone,
  parseDay,
  sourceLabels,
  statuses,
} from "./types";
import type { DayData, Task, ForOption } from "./types";
import "./my-day.css";
const filters = [
  ["today", "Today"],
  ["week", "This week"],
  ["all", "All"],
  ["done", "Done"],
  ["archived", "Deleted"],
] as const;
export function MyDayPage() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  return <MyDayContent key={`${profile!.id}:${params.get("task")??""}:${params.get("decision")??""}`} />;
}
function MyDayContent() {
  const { profile } = useAuth(),
    [params] = useSearchParams(),
    taskId = params.get("task") ?? "",
    linked = params.get("decision") ?? "";
  const [filter, setFilter] = useState(taskId || linked ? "all" : "today"),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [forValue, setFor] = useState<ForOption | null>(null),
    [source, setSource] = useState(""),
    [priority] = useState(""),
    [page, setPage] = useState(0),
    [revision, setRevision] = useState(0),
    [clock, setClock] = useState(() => new Date());
  const [layout, setLayout] = useState<"list" | "board" | "week">(() => {
    try {
      const v = localStorage.getItem("vimbre:myday-view");
      if (v === "list" || v === "board" || v === "week") return v;
    } catch {}
    return "list";
  });
  const [result, setResult] = useState<{
      key: string;
      data: DayData | null;
      error: boolean;
    } | null>(null),
    [editor, setEditor] = useState<{ task?: Task } | null>(null),
    [context, setContext] = useState<Task | null>(null),
    [reminder, setReminder] = useState<Task | null>(null),
    [record, setRecord] = useState<Task | null>(null),
    [templates,setTemplates]=useState(false),[rules,setRules]=useState(false),[planning,setPlanning]=useState(false),[calendar,setCalendar]=useState(false),[transfers,setTransfers]=useState(false),[assignment,setAssignment]=useState<{task?:Task;ids?:string[]}|null>(null),[comments,setComments]=useState<string|null>(params.get('comment_task')),[teamOpen,setTeamOpen]=useState(false),[selecting,setSelecting]=useState(false),[selectedIds,setSelectedIds]=useState<string[]>([]),
    [inspected,setInspected]=useState<Task|null>(null),
    [rolePicker, setRolePicker] = useState(false),
    [dismissed, setDismissed] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [quick, setQuick] = useState(false), [quickText,setQuickText]=useState(""),
    [undo, setUndo] = useState<{task: Task; ids?:string[]; until: number} | null>(null);
  const [finishing,setFinishing] = useState<(Task & {finishPosition:number})[]>([]);
  const finishTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(finishTimer.current)clearTimeout(finishTimer.current)},[]);
  const access = useRef<HTMLDialogElement>(null),
    dragging = useRef(""),
    pending = useRef(false);
  const extras=useDaySuite(profile!.id,revision);
  const summary = useMyDaySummary(profile!.id, revision, true);
  const key = JSON.stringify([
      filter,
      search,
      forValue,
      source,
      priority,
      page,
      taskId,
      linked,
    ]),
    current = result?.key === key ? result : null,
    data = current?.data ?? null;
  const zone =
      data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    today = data?.today ?? dateInZone(zone);
  async function undoLast(){if(!undo||Date.now()>=undo.until)return;if(!undo.ids)return act(undo.task,'undo',{});setBusy('bulk');try{await daySuite('batch',null,{ids:undo.ids,operation:'undo'});setUndo(null);setMessage('Changes undone.');refresh()}catch(e){setError(suiteError(e))}finally{setBusy('')}}
  const refresh = () => {
    setRevision((v) => v + 1);
    window.dispatchEvent(new Event("vimbre:work-changed"));
  };
  useEffect(()=>{setSelectedIds([])},[filter,search,forValue,source,priority,page]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 10000);
    return () => clearTimeout(t);
  }, [message]);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query);
      setPage(0);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => {
    let live = true;
    let version = 0;
    const load = async () => {
      const request = ++version;
      try {
        if(!navigator.onLine){const saved=cachedDay(profile!.id,filter);if(!saved)throw Error();if(live&&request===version)setResult({key,data:saved,error:false});return}
        const { data, error } = await supabase.rpc("myday_tasks", {
          p_filter: filter,
          p_query: search,
          p_for: forValue ? `${forValue.kind}:${forValue.id}` : "",
          p_source: source,
          p_priority: priority,
          p_page: page,
          p_task: taskId || null,
          p_decision: linked || null,
        });
        if(!error&&parseDay(data)&&!search&&!forValue&&!source&&!page)cacheDay(profile!.id,filter,parseDay(data)!);
        if (live && request === version)
          setResult({
            key,
            data: parseDay(data),
            error: Boolean(error) || !parseDay(data),
          });
      } catch {
        if (live && request === version)
          setResult({ key, data: null, error: true });
      }
    };
    void load();
    const onReturn = () => {
      if (!document.hidden) {
        setClock(new Date());
        void load();
      }
    };
    const t = setInterval(onReturn, 60000);
    window.addEventListener("focus", onReturn);
    window.addEventListener("vimbre:work-changed", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      live = false;
      clearInterval(t);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("vimbre:work-changed", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [
    key,
    filter,
    search,
    forValue,
    source,
    priority,
    page,
    taskId,
    linked,
    revision,
  ]);

  useEffect(() => {
    if (params.get("visibility") === "manager") access.current?.showModal();
  }, [params]);
  async function act(task: Task, op: string, values: Record<string, unknown>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(task.id);
    setError("");
    try {
      if(op==="delete_series")await daySuite("delete",task.id,values);else await changeTask(task.id, op, values);
      if (op === "archive" || op === "delete_series" || op === "status" && values.status === "done") setUndo({task,until:Date.now()+10000});
      if(op === "status" && values.status === "done") {
        setFinishing(previous=>[...previous.filter(t=>t.id!==task.id),{...task,status:"done",finishPosition:Math.max(0,(data?.rows??[]).findIndex(t=>t.id===task.id))}]);
        if(finishTimer.current)clearTimeout(finishTimer.current);
        finishTimer.current=setTimeout(()=>setFinishing([]),5000);
      }
      if(op === "undo" || op === "status" && values.status !== "done") {setFinishing(previous=>previous.filter(t=>t.id!==task.id));if(op === "undo")setUndo(null);}
      setMessage(
        op === "pin"
          ? values.pinned
            ? "Task starred."
            : "Task unstarred."
          : op === "context"
            ? "Added to context."
            : "Task updated.",
      );
      refresh();
    } catch (e) {
      setError(
        op === "pin" && (e as { code?: string }).code === "22023"
          ? "This task could not be starred. Refresh and try again."
          : taskError(e),
      );
    } finally {
      setBusy("");
      pending.current = false;
    }
  }
  const rows = data?.rows ?? [],
    allRows = [...rows, ...(data?.overdue_rows ?? []), ...(data?.done_today ?? []), ...(data?.upcoming ?? [])],
    selected = rows.find((t) => t.id === taskId),
    requested =
      !dismissed &&
      params.has("task_action") &&
      selected?.status !== "done" &&
      !selected?.deleted_at
        ? selected
        : null;
  useEffect(()=>{const key=(e:KeyboardEvent)=>{
    if(e.metaKey||e.ctrlKey||e.altKey||e.target instanceof HTMLElement&&e.target.closest('input,textarea,select,[contenteditable="true"],dialog'))return;
    const k=e.key.toLowerCase(),buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('.md-slim-row>.md-task-title')).filter(b=>b.getClientRects().length),at=buttons.indexOf(document.activeElement as HTMLButtonElement),id=(document.activeElement as HTMLElement)?.closest<HTMLElement>('[data-task-id]')?.dataset.taskId,task=allRows.find(t=>t.id===id);
    if(k==='n'){e.preventDefault();setQuick(true)}else if(k==='/'){e.preventDefault();document.getElementById('md-search')?.focus()}else if(k==='c'){e.preventDefault();window.location.assign('/app/capture')}else if(k==='j'||k==='k'){e.preventDefault();buttons[Math.max(0,Math.min(buttons.length-1,at+(k==='j'?1:-1)))]?.focus()}else if(k==='z'&&undo&&Date.now()<undo.until){e.preventDefault();void undoLast()}else if(task&&!busy){
      if(k==='e'){e.preventDefault();setInspected(task)}else if(k==='x'&&!task.deleted_at&&!task.missed_at){e.preventDefault();void act(task,'status',{status:task.status==='done'?'open':'done'})}else if(k==='s'&&!task.deleted_at&&task.status!=='done'&&!task.missed_at){e.preventDefault();void act(task,'pin',{pinned:!task.pinned_at})}else if(k==='t'&&!task.deleted_at&&task.status!=='done'&&!task.missed_at){e.preventDefault();void act(task,'tomorrow',{})}else if(k==='delete'&&!task.deleted_at){e.preventDefault();if(task.repeat_rule){setInspected(task);return}if(!(task.capture_id||task.decision_id)||window.confirm('This task is part of the record. Delete it anyway? The decision and source stay.'))void act(task,'archive',{})}
    }
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[allRows,undo,busy]);
  function card(task: Task, rank?: number, panelOnly=false) {
    return (
      <TaskCard
        key={task.id}
        task={task}
        selecting={selecting&&!panelOnly}
        selected={selectedIds.includes(task.id)}
        select={()=>setSelectedIds(v=>v.includes(task.id)?v.filter(id=>id!==task.id):[...v,task.id])}
        tools={panelOnly||task.id===taskId?<TaskTools task={task} zone={zone} flags={extras.data?.flags??{}} assign={profile!.role!=='employee'?()=>{setInspected(null);setAssignment({task})}:undefined}/>:undefined}
        inspect={panelOnly?undefined:setInspected}
        panelOnly={panelOnly}
        onClose={()=>setInspected(null)}
        zone={zone}
        now={clock}
        rank={rank}
        initialOpen={panelOnly || task.id === taskId && !params.has("task_action")}
        busy={Boolean(busy)}
        act={(t, o, v) => void act(t, o, v)}
        edit={(t) => {setInspected(null);setEditor({ task: t })}}
        remind={t=>{setInspected(null);setReminder(t)}}
        context={t=>{setInspected(null);setContext(t)}}
        quickContext={(t, outcome) =>
          void act(t, "context", {
            kind: "note",
            title: t.title,
            details: outcome.trim() || t.completion_note || "Completed.",
          })
        }
        record={t=>{setInspected(null);setRecord(t)}}
        drag={(id) => {
          dragging.current = id;
        }}
      />
    );
  }
  function board(items: Task[]) {
    return (
      <div className="md-board">
        {statuses.map(([status, label]) => {
          const tasks = items.filter((t) => t.status === status);
          return (
            <details
              className={`md-board-column md-column-${status}`}
              key={status}
              open={status !== "done"}
              onDragOver={(e) => {
                if (dragging.current) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const task = allRows.find((t) => t.id === dragging.current);
                dragging.current = "";
                if (task && !task.deleted_at && task.status !== status)
                  void act(task, "status", { status });
              }}
            >
              <summary>
                {label}
                <span>{tasks.length}</span>
              </summary>
              <div className="md-column-cards">
                {tasks.map((t) => card(t, t.rank))}
                {!tasks.length && (
                  <p className="md-column-empty">
                    {status === "done"
                      ? "No completed tasks."
                      : status === "in_progress"
                        ? "No tasks in progress."
                        : "No tasks to do."}
                  </p>
                )}
              </div>
            </details>
          );
        })}
      </div>
    );
  }
  const done = (data?.done_today ?? []).filter(t=>!finishing.some(f=>f.id===t.id)),
    upcoming = data?.upcoming ?? [],
    waiting = data?.drafts_waiting ?? summary.data?.pending_drafts ?? 0,
    handovers = data?.handovers_waiting ?? [];
  const overdueRows = data?.overdue_rows ?? [];
  const incoming=data?.review_assignments??extras.data?.incoming??[];
  const format:TaskFormat={language:String(extras.data?.settings.language??"en-GB"),style:(extras.data?.settings.date_style??"medium") as TaskFormat["style"]};
  const todayRows = filter === "today" ? rows.filter(t => !overdueRows.some(o => o.id === t.id)&&!finishing.some(f=>f.id===t.id)) : [...rows];
  if(filter === "today")for(const task of [...finishing].sort((a,b)=>a.finishPosition-b.finishPosition))todayRows.splice(Math.min(task.finishPosition,todayRows.length),0,task);
  function list(items: Task[]) {return <div className="md-task-list">{items.map(t=>card(t))}</div>}
  function weekView(items: Task[]) {return <>{Boolean(data?.undated?.length)&&<section className="md-undated-strip"><h3>No date</h3>{list(data!.undated!)}</section>}<div className="md-week">{Array.from({length:7},(_,i)=>{const date=addDays(today,i), group=items.filter(t=>(t.due_time?dateInZone(zone,new Date(t.due_at)):t.due_date)===date);return <section key={date}><h3>{new Intl.DateTimeFormat(format.language,{weekday:"short",day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z"))}</h3>{group.length?list(group):<p className="md-muted">No tasks</p>}</section>})}</div></>}
  const empty = (
    <div className="md-empty">
      <WorkspaceIcon name="tick" />
      <p>
        {filter === "today" && !search && !forValue && !source && !priority
          ? "You’re clear for today."
          : filter === "overdue"
            ? "No overdue tasks."
            : filter === "archived"
              ? "No deleted tasks."
              : "No tasks match these filters."}
      </p>

    </div>
  );
  const setup = [
      ["capture", "Capture one item", "/app/capture"],
      ["role", "Fill My role", "/app/role-record"],
      ["reminder", "Set one reminder", "/app/settings"],
      ["cover", "Name a cover person", "/app/handovers"],
    ] as const,
    completed = setup.filter(([k]) => data?.checklist?.[k]).length;
  return (
    <TaskFormatContext.Provider value={format}><div className="md-page"><OfflineStatus/>
      <header className="md-page-heading">
        <div>
          <h1 tabIndex={-1}>
            {greetingInZone(zone)}, {profile!.full_name.trim().split(/\s+/)[0]}
          </h1>
          <p className="md-live-line">
            {data
              ? `${data.counts.today ?? data.counts.todo + data.counts.progress} today, ${data.counts.overdue} overdue, ${waiting + handovers.length+incoming.length} to review`
              : "Loading your tasks…"}
          </p>
        </div>

      </header>
      {extras.data?.settings.briefing===true&&extras.data?.flags.ai&&extras.data.briefing&&<aside className="md-briefing"><h2>Daily briefing</h2><p className="record-text">{extras.data.briefing.body}</p></aside>}
      {extras.data?.away.map(h=><aside className="md-away-banner" key={h.id}>You’re away from {formatTaskDay(h.starts_on,format)}. Your handover isn’t submitted yet.</aside>)}
      {message && (
        <p className="notice" role="status">
          {message} {undo && Date.now()<undo.until && <button className="md-text-button" onClick={()=>void undoLast()}>Undo</button>}
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <section className="md-work-section" aria-labelledby="md-tasks-heading">
        <div className="md-section-heading">
          <h2 id="md-tasks-heading">Your tasks</h2>
        </div>
        <div className="md-toolbar md-toolbar-approved">
          <label className="md-search"><span className="sr-only">Search tasks</span><input id="md-search" type="search" placeholder="Search tasks" maxLength={100} value={query} onChange={e=>setQuery(e.target.value)}/></label>
          <label className="md-menu-label">Filter<select aria-label="Task filter" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0)}}>{filters.map(([v,l])=><option key={v} value={v}>{l} ({data?.tab_counts?.[v]??0})</option>)}</select></label>
          <SegmentedControl label="Task view" value={layout} options={[{value:"list",label:"List"},{value:"board",label:"Board"},{value:"week",label:"Week"}]} onChange={value=>{setLayout(value);if(value==="week")setFilter("week");else if(value==="board"&&filter==="today")setFilter("all");try{localStorage.setItem("vimbre:myday-view",value)}catch{}}}/>
          <details className="md-add-menu" onClick={e=>{if(e.target instanceof Element&&e.target.closest("button,a"))e.currentTarget.open=false}}><summary aria-label="Add" aria-describedby="myday-add-hint"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg><span id="myday-add-hint" className="md-add-hint" role="tooltip">Add a task or capture a conversation</span></summary><div><button onClick={()=>setEditor({})}>Add task</button><Link to="/app/capture">Capture</Link>{extras.data?.flags.templates&&<button onClick={()=>setTemplates(true)}>Add from template</button>}<button onClick={()=>setRolePicker(true)}>Add from My role</button>{profile!.role!=='employee'&&<button onClick={()=>setAssignment({})}>Assign task</button>}<button onClick={()=>{setSelecting(v=>!v);setSelectedIds([])}}>{selecting?"Finish selecting":"Select several"}</button></div></details>
        </div>
        {quick && <form className="md-quick-add" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy("quick");setError("");try{const task=parseQuickTask(quickText,today);if(!task.title)throw new Error();await changeTask(crypto.randomUUID(),"create",{...task,reminder_option:"at_time"});setQuickText("");setQuick(false);refresh()}catch(e){setError(taskError(e))}finally{setBusy("")}}}><label>Quick add<input autoFocus value={quickText} onChange={e=>setQuickText(e.target.value)} maxLength={300} placeholder="Send quote Friday 3pm" required/></label><Button type="submit" disabled={Boolean(busy)}>Add task</Button></form>}
        <details className="md-filter-disclosure"><summary>More filters{search||forValue||source ? " · Active":""}</summary><div className="md-filter-row"><ForPicker filter value={forValue} onChange={v=>{setFor(v);setPage(0)}}/><label>From<select value={source} onChange={e=>{setSource(e.target.value);setPage(0)}}><option value="">All sources</option>{Object.entries(sourceLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>{(query||forValue||source)&&<button className="md-text-button" onClick={()=>{setQuery("");setSearch("");setFor(null);setSource("");setPage(0)}}>Clear filters</button>}</div></details>
        {<button className="md-text-button md-plan-action" onClick={()=>setPlanning(true)}>Plan my day</button>}
        <NextPlannedTask replan={()=>setPlanning(true)}/><StarsPanel compact/>
        {selecting&&<div className="md-bulk-bar"><span>{selectedIds.length} selected</span><Button variant="secondary" disabled={!selectedIds.length||Boolean(busy)} onClick={()=>setAssignment({ids:selectedIds})}>Assign</Button><button className="md-text-button" onClick={()=>setSelectedIds(todayRows.map(t=>t.id))}>Select visible tasks</button>{['done','tomorrow','delete'].map(op=><Button key={op} variant="secondary" disabled={!selectedIds.length||Boolean(busy)} onClick={async()=>{if(op==='delete'&&!window.confirm('Delete the selected tasks? Sources and decisions stay.'))return;setBusy('bulk');setError('');try{await daySuite('batch',null,{ids:selectedIds,operation:op,confirmed:op==='delete'});if(op==='done'||op==='delete'){const first=allRows.find(t=>t.id===selectedIds[0]);if(first)setUndo({task:first,ids:[...selectedIds],until:Date.now()+10000})}setMessage(op==='done'?'Tasks marked done.':op==='delete'?'Tasks deleted.':'Tasks moved to tomorrow.');setSelectedIds([]);refresh()}catch(e){setError(suiteError(e))}finally{setBusy('')}}}>{op==='done'?'Done':op==='tomorrow'?'Tomorrow':'Delete'}</Button>)}<button className="md-text-button" onClick={()=>{setSelectedIds([]);setSelecting(false)}}>Cancel selection</button></div>}
        {(taskId || linked) && (
          <Link className="md-text-button" to="/app">
            All tasks
          </Link>
        )}
        {!current ? (
          <p role="status">Loading tasks…</p>
        ) : current.error ? (
          <div className="md-empty">
            <p role="alert">Tasks could not be loaded.</p>
            <Button onClick={refresh}>Retry tasks</Button>
          </div>
        ) : (
          <>
            {filter === "today" && overdueRows.length>0 && <section className="md-day-group" aria-label="Overdue"><h3>Overdue <span>{overdueRows.length}</span></h3><button className="md-text-button" disabled={Boolean(busy)} onClick={async()=>{if(!overdueRows.length)return;setBusy("move-overdue");setError("");try{for(const task of overdueRows){await changeTask(task.id,"tomorrow",{date:today})}setMessage("Overdue tasks moved to today.");refresh()}catch(e){setError(taskError(e))}finally{setBusy("")}}}>Move all to today</button>{list(overdueRows)}</section>}
            {filter === "today" && <h3 className="md-group-title">Today <span>{todayRows.length}</span></h3>}
            {layout==="week" ? weekView(todayRows) : todayRows.length ? (layout === "board" && filter !== "archived" ? board(todayRows) : list(todayRows)) : empty}
            {data && filter !== "today" && data.count > 60 && (
              <div className="pagination">
                <Button
                  variant="secondary"
                  disabled={!page}
                  onClick={() => setPage((v) => v - 1)}
                >
                  Previous tasks
                </Button>
                <span>Page {page + 1}</span>
                <Button
                  variant="secondary"
                  disabled={(page + 1) * 60 >= data.count}
                  onClick={() => setPage((v) => v + 1)}
                >
                  Next tasks
                </Button>
              </div>
            )}
            {filter === "today" && (
              <>
                {(waiting > 0 || handovers.length > 0 || incoming.length>0) && <section className="md-day-group" aria-label="To review">
                  <h3>To review</h3>
                  <div className="md-waiting-links">
                    {(data?.review_drafts??[]).map(d=><article className="md-review-draft" key={d.id}><span className="md-muted">Draft · {d.kind==='action'?'Task':d.kind==='decision'?'Decision':d.kind}</span><h4>{d.payload.title}</h4>{d.payload.details&&<p>{d.payload.details}</p>}{d.payload.due_date&&<p>Due: {formatTaskDay(d.payload.due_date,format)}{d.payload.due_time?` · ${d.payload.due_time}`:''}</p>}<p>Owner: {d.payload.owner_id&&d.payload.owner_id!==profile!.id?'Review owner in Capture':'Me'} · Reminder: {(d.payload.reminder_option??'at_time').replaceAll('_',' ')}</p>{d.duplicate&&<p className="field-error">A matching item already exists. Review it before accepting.</p>}<div className="md-expanded-actions"><Button disabled={Boolean(busy)||d.duplicate} onClick={async()=>{setBusy(d.id);setError('');try{await changeTask(d.id,'review_accept',{version:d.version});refresh()}catch(e){setError(taskError(e))}finally{setBusy('')}}}>Accept</Button><Link to={`/app/capture?capture=${d.capture_id}`}>Edit</Link><button className="md-text-button" disabled={Boolean(busy)} onClick={async()=>{setBusy(d.id);setError('');try{await changeTask(d.id,'review_dismiss',{version:d.version});refresh()}catch(e){setError(taskError(e))}finally{setBusy('')}}}>Dismiss</button></div></article>)}
                    {waiting>0&&!data?.review_drafts&&<Link to="/app/capture">{waiting} drafts to review</Link>}
                    {incoming.map(a=><article className="md-review-draft" key={a.id}><span className="md-muted">Assigned by {a.creator_name}</span><h4>{a.title}</h4>{a.details&&<p>{a.details}</p>}<p>Due: {formatTaskDay(a.suggested_date??a.due_date,format)}</p><div className="md-expanded-actions">{['accept','decline'].map(op=><Button key={op} variant={op==='accept'?'primary':'secondary'} disabled={Boolean(busy)} onClick={async()=>{setBusy(a.id);setError('');try{await daySuite(op,a.id);refresh()}catch(e){setError(suiteError(e))}finally{setBusy('')}}}>{op==='accept'?'Accept':'Decline'}</Button>)}</div><form className="md-suggest-date" onSubmit={async e=>{e.preventDefault();const date=String(new FormData(e.currentTarget).get('date')??'');setBusy(a.id);try{await daySuite('suggest_date',a.id,{date});refresh()}catch(e){setError(suiteError(e))}finally{setBusy('')}}}><label className="field">Suggest a new date<input type="date" name="date" min={today} required/></label><Button type="submit" variant="secondary" disabled={Boolean(busy)}>Suggest date</Button></form></article>)}
                    {handovers.map((h) => (
                      <Link key={h.id} to="/app/handovers">
                        Review handover: {h.title}
                      </Link>
                    ))}

                  </div>
                </section>}
                {(upcoming.length > 0) && <section className="md-day-group" aria-label="Coming up">
                  <h3>Coming up <span>{upcoming.length}</span></h3>
                  {upcoming.length ? (
                    <div className="md-task-list">
                      {upcoming.map((t) => card(t))}
                    </div>
                  ) : (
                    <p>No upcoming tasks in the next seven days.</p>
                  )}
                </section>}
                {Boolean(extras.data?.waiting.length)&&<section className="md-day-group" aria-label="Waiting on others"><h3>Waiting on others</h3><ul className="md-waiting-list">{extras.data!.waiting.map(a=><li key={a.id}><div><strong>{a.title}</strong><span>{a.recipient_name} · {a.status==='accepted'?'Accepted':'To review'}{a.suggested_date?` · Suggested ${formatTaskDay(a.suggested_date,format)}`:''}</span></div><Button variant="secondary" disabled={Boolean(busy)} onClick={async()=>{setBusy(a.id);try{await daySuite('nudge',a.id);setMessage('Nudge sent.')}catch(e){setError(suiteError(e))}finally{setBusy('')}}}>Nudge</Button><button className="md-text-button" disabled={Boolean(busy)} onClick={async()=>{if(!window.confirm('Withdraw this assignment?'))return;setBusy(a.id);try{await daySuite('cancel_assignment',a.id);refresh()}catch(e){setError(suiteError(e))}finally{setBusy('')}}}>Withdraw</button></li>)}</ul></section>}
                {(data?.covering ?? []).map((h) => (
                  <section
                    key={h.id}
                    className="md-day-group"
                    aria-label={`Covering for ${h.owner_name}`}
                  >
                    <h3>Covering for {h.owner_name}</h3>
                    <Button variant="secondary" disabled={Boolean(busy)} onClick={async()=>{if(!window.confirm('Hand this cover back to the owner?'))return;setBusy(h.id);try{await daySuite('cover_hand_back',h.id);refresh()}catch(e){setError(suiteError(e))}finally{setBusy('')}}}>Hand back</Button>
                    <ul className="md-cover-tasks">
                      {(data?.cover_tasks ?? [])
                        .filter((t) => t.owner_id === h.owner_id)
                        .map((t) => (
                          <li key={t.id}>
                            <strong>{t.title}</strong>
                            <span>
                              {h.owner_name} ·{" "}
                              {statuses.find(([v]) => v === t.status)?.[1] ??
                                "To do"}
                            </span>
                            <time>
                              {t.due_at ? new Intl.DateTimeFormat("en-GB", {
                                dateStyle: "medium",
                                timeZone: zone,
                              }).format(new Date(t.due_at)) : "No date"}
                            </time>
                          </li>
                        ))}
                    </ul>
                  </section>
                ))}
                {done.length > 0 && <details className="md-day-group md-done-group">
                  <summary>
                    Done today <span>{data?.counts.done ?? done.length}</span>
                  </summary>
                  {done.length ? (
                    <div className="md-task-list">
                      {done.map((t) => card(t))}
                    </div>
                  ) : (
                    <p>No tasks completed today.</p>
                  )}
                </details>}
              </>
            )}
          </>
        )}
      </section>
      {extras.error&&<p className="field-error" role="alert">Task tools could not be loaded. <button className="md-text-button" onClick={extras.retry}>Retry task tools</button></p>}
      <div className="md-feature-tools">{extras.data?.flags.rules&&<button className="md-text-button" onClick={()=>setRules(true)}>Rules</button>}{extras.data?.flags.calendar&&<button className="md-text-button" onClick={()=>setCalendar(true)}>Calendar feed</button>}<button className="md-text-button" onClick={()=>setTransfers(true)}>Import and export</button>{profile!.role!=='employee'&&extras.data?.flags.team&&<button className="md-text-button" aria-expanded={teamOpen} onClick={()=>setTeamOpen(v=>!v)}>Team</button>}</div>
      {teamOpen&&<TeamDayPanel/>}
      <footer className="md-footer"><button className="md-visibility" onClick={()=>access.current?.showModal()}>Who sees my tasks</button></footer>
      <CaptureSummary
        data={summary.data ? { ...summary.data, pending_drafts: 0 } : null}
      />
      {data?.checklist && completed < 4 && (
        <details className="md-setup">
          <summary>
            Get started <span>{completed} of 4 done</span>
          </summary>
          <ul>
            {setup.map(([k, l, path]) => (
              <li key={k}>
                <Link to={path}>
                  <WorkspaceIcon name={data.checklist![k] ? "tick" : "arrow"} />
                  {l}
                  {data.checklist![k] && (
                    <span className="sr-only">, done</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
      {templates&&<TemplatePicker today={today} close={()=>setTemplates(false)} saved={()=>{setTemplates(false);setMessage('Task added from template.');refresh()}}/>}
      {rules&&<RulesPanel close={()=>setRules(false)}/>}{planning&&<PlanMyDay aiEnabled={extras.data?.flags.ai??false} close={()=>setPlanning(false)}/>}{calendar&&<CalendarPanel close={()=>setCalendar(false)} enabled={extras.data?.calendar_enabled??false}/>}{transfers&&<ImportExportPanel close={()=>setTransfers(false)}/>}
      {assignment&&<AssignmentPanel ids={assignment.ids} task={assignment.task} close={()=>setAssignment(null)} saved={()=>{setAssignment(null);setSelectedIds([]);setMessage('Sent for acceptance.');refresh()}}/>}{comments&&<TaskComments id={comments} close={()=>setComments(null)}/>}
      {editor && (
        <TaskPanel
          key={editor.task?.id ?? "new"}
          task={editor.task}
          today={today}
          close={() => setEditor(null)}
          saved={() => {
            setEditor(null);
            setMessage("Task saved.");
            refresh();
          }}
        />
      )}
      {rolePicker && (
        <RoleTaskPicker
          today={today}
          close={() => setRolePicker(false)}
          saved={() => {
            setRolePicker(false);
            setMessage("Task added from My role.");
            refresh();
          }}
        />
      )}
      {(reminder || requested) && (
        <ReminderPanel
          id={(reminder || requested)!.id}
          title={(reminder || requested)!.title}
          zone={zone}
          alert={Boolean(requested)}
          initialReschedule={
            Boolean(requested) && params.get("task_action") === "reschedule"
          }
          close={() => {
            setReminder(null);
            setDismissed(true);
          }}
          changed={refresh}
        />
      )}
      {context && (
        <ContextPanel
          task={context}
          close={() => setContext(null)}
          saved={() => {
            setContext(null);
            setMessage("Added to context.");
            refresh();
          }}
        />
      )}
      {inspected && card(allRows.find(t=>t.id===inspected.id)??inspected,undefined,true)}
      {record && (
        <TaskRecord task={record} zone={zone} close={() => setRecord(null)} />
      )}
      <dialog
        ref={access}
        className="vw-dialog"
        aria-labelledby="md-access-title"
      >
        <h2 id="md-access-title">Who sees my tasks</h2>
        <WorkVisibilityDetails />
        <Button onClick={() => access.current?.close()}>Close</Button>
      </dialog>
    </div></TaskFormatContext.Provider>
  );
}

