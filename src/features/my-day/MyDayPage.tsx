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
  ["done", "Done"],
  ["all", "All"],
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
    [inspected,setInspected]=useState<Task|null>(null),
    [rolePicker, setRolePicker] = useState(false),
    [dismissed, setDismissed] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [quick, setQuick] = useState(false), [quickText,setQuickText]=useState(""),
    [undo, setUndo] = useState<{task: Task; until: number} | null>(null);
  const access = useRef<HTMLDialogElement>(null),
    dragging = useRef(""),
    pending = useRef(false);
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
  const refresh = () => {
    setRevision((v) => v + 1);
    window.dispatchEvent(new Event("vimbre:work-changed"));
  };
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
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.metaKey||e.ctrlKey||e.altKey||e.target instanceof HTMLElement&&e.target.closest('input,textarea,select,[contenteditable="true"],dialog'))return;if(e.key.toLowerCase()==="n"){e.preventDefault();setQuick(true)}if(e.key==="/"){e.preventDefault();document.getElementById("md-search")?.focus()}if(e.key.toLowerCase()==="c")window.location.assign("/app/capture")};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key)},[]);
  useEffect(() => {
    if (params.get("visibility") === "manager") access.current?.showModal();
  }, [params]);
  async function act(task: Task, op: string, values: Record<string, unknown>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(task.id);
    setError("");
    try {
      await changeTask(task.id, op, values);
      if (op === "archive" || op === "status" && values.status === "done") setUndo({task,until:Date.now()+10000});
      if(op === "undo") setUndo(null);
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
  function card(task: Task, rank?: number, panelOnly=false) {
    return (
      <TaskCard
        key={task.id}
        task={task}
        inspect={panelOnly?undefined:setInspected}
        panelOnly={panelOnly}
        onClose={()=>setInspected(null)}
        zone={zone}
        now={clock}
        rank={rank}
        initialOpen={panelOnly || task.id === taskId}
        busy={Boolean(busy)}
        act={(t, o, v) => void act(t, o, v)}
        edit={(t) => setEditor({ task: t })}
        remind={setReminder}
        context={setContext}
        quickContext={(t, outcome) =>
          void act(t, "context", {
            kind: "note",
            title: t.title,
            details: outcome.trim() || t.completion_note || "Completed.",
          })
        }
        record={setRecord}
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
  const done = data?.done_today ?? [],
    upcoming = data?.upcoming ?? [],
    waiting = data?.drafts_waiting ?? summary.data?.pending_drafts ?? 0,
    handovers = data?.handovers_waiting ?? [];
  const overdueRows = data?.overdue_rows ?? [];
  const todayRows = filter === "today" ? rows.filter(t => !overdueRows.some(o => o.id === t.id)) : rows;
  function list(items: Task[]) {return <div className="md-task-list">{items.map(t=>card(t))}</div>}
  function weekView(items: Task[]) {return <div className="md-week">{Array.from({length:7},(_,i)=>{const date=addDays(today,i), group=items.filter(t=>(t.due_time?dateInZone(zone,new Date(t.due_at)):t.due_date)===date);return <section key={date}><h3>{new Intl.DateTimeFormat(undefined,{weekday:"short",day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z"))}</h3>{group.length?list(group):<p className="md-muted">No tasks</p>}</section>})}</div>}
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
    <div className="md-page">
      <header className="md-page-heading">
        <div>
          <h1 tabIndex={-1}>
            {greetingInZone(zone)}, {profile!.full_name.trim().split(/\s+/)[0]}
          </h1>
          <p className="md-live-line">
            {data
              ? `${data.counts.today ?? data.counts.todo + data.counts.progress} today, ${data.counts.overdue} overdue, ${waiting + handovers.length} to review`
              : "Loading your tasks…"}
          </p>
        </div>

      </header>
      {message && (
        <p className="notice" role="status">
          {message} {undo && Date.now()<undo.until && <button className="md-text-button" onClick={()=>void act(undo.task,"undo",{})}>Undo</button>}
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
          <label className="md-menu-label">View<select aria-label="Task view" value={layout} onChange={e=>{const value=e.target.value as "list"|"board"|"week";setLayout(value);if(value==="week")setFilter("week");try{localStorage.setItem("vimbre:myday-view",value)}catch{}}}><option value="list">List</option><option value="board">Board</option><option value="week">Week</option></select></label>
          <details className="md-add-menu"><summary aria-label="Add">＋</summary><div><button onClick={()=>setEditor({})}>Add task</button><Link to="/app/capture">Capture</Link><button onClick={()=>setRolePicker(true)}>Add from My role</button></div></details>
        </div>
        {quick && <form className="md-quick-add" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy("quick");setError("");try{const task=parseQuickTask(quickText,today);if(!task.title)throw new Error();await changeTask(crypto.randomUUID(),"create",{...task,reminder_option:"at_time"});setQuickText("");setQuick(false);refresh()}catch(e){setError(taskError(e))}finally{setBusy("")}}}><label>Quick add<input autoFocus value={quickText} onChange={e=>setQuickText(e.target.value)} maxLength={300} placeholder="Send quote Friday 3pm" required/></label><Button type="submit" disabled={Boolean(busy)}>Add task</Button></form>}
        <details className="md-filter-disclosure"><summary>More filters{search||forValue||source ? " · Active":""}</summary><div className="md-filter-row"><ForPicker filter value={forValue} onChange={v=>{setFor(v);setPage(0)}}/><label>From<select value={source} onChange={e=>{setSource(e.target.value);setPage(0)}}><option value="">All sources</option>{Object.entries(sourceLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>{(query||forValue||source)&&<button className="md-text-button" onClick={()=>{setQuery("");setSearch("");setFor(null);setSource("");setPage(0)}}>Clear filters</button>}</div></details>
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
            {filter === "today" && overdueRows.length>0 && <section className="md-day-group" aria-label="Overdue"><h3>Overdue <span>{overdueRows.length}</span></h3><button className="md-text-button" disabled={Boolean(busy)} onClick={async()=>{for(const task of overdueRows) await act(task,"tomorrow",{date:today})}}>Move all to today</button>{list(overdueRows)}</section>}
            {filter === "today" && <h3 className="md-group-title">Today <span>{todayRows.length}</span></h3>}
            {todayRows.length ? (layout === "board" && filter !== "archived" ? board(todayRows) : layout === "week" ? weekView(todayRows) : list(todayRows)) : empty}
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
                {(waiting > 0 || handovers.length > 0) && <section className="md-day-group" aria-label="To review">
                  <h3>To review</h3>
                  <div className="md-waiting-links">
                    {waiting > 0 && (
                      <Link to="/app/capture">
                        {waiting} {waiting === 1 ? "draft" : "drafts"} to review
                      </Link>
                    )}
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
                {(data?.covering ?? []).map((h) => (
                  <section
                    key={h.id}
                    className="md-day-group"
                    aria-label={`Covering for ${h.owner_name}`}
                  >
                    <h3>Covering for {h.owner_name}</h3>
                    <Link to="/app/my-cover-duties">View cover</Link>
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
                              {new Intl.DateTimeFormat("en-GB", {
                                dateStyle: "medium",
                                timeZone: zone,
                              }).format(new Date(t.due_at))}
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
    </div>
  );
}

