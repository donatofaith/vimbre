import {RoleUpcoming} from '../records/RoleUpcoming'
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
import { UpcomingPreview } from "./UpcomingPreview";
import { TaskCard, TaskRecord } from "./TaskCard";
import { RoleTaskPicker } from "./RoleTaskPicker";
import { changeTask, taskError } from "./api";
import {
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
  ["overdue", "Overdue"],
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
    [priority, setPriority] = useState(""),
    [page, setPage] = useState(0),
    [revision, setRevision] = useState(0),
    [clock, setClock] = useState(() => new Date());
  const [layout, setLayout] = useState<"list" | "board">(() => {
    try {
      const v = localStorage.getItem("vimbre:myday-view");
      if (v === "list") return v;
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
    [rolePicker, setRolePicker] = useState(false),
    [dismissed, setDismissed] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
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
    const t = setTimeout(() => setMessage(""), 5000);
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
      setMessage(
        op === "pin"
          ? values.pinned
            ? "Task pinned."
            : "Task unpinned."
          : op === "context"
            ? "Added to context."
            : "Task updated.",
      );
      refresh();
    } catch (e) {
      setError(
        op === "pin" && (e as { code?: string }).code === "22023"
          ? "You can pin up to three unfinished tasks. Unpin one to pin another."
          : taskError(e),
      );
    } finally {
      setBusy("");
      pending.current = false;
    }
  }
  const rows = data?.rows ?? [],
    allRows = [...rows, ...(data?.done_today ?? []), ...(data?.upcoming ?? [])],
    selected = rows.find((t) => t.id === taskId),
    requested =
      !dismissed &&
      params.has("task_action") &&
      selected?.status !== "done" &&
      !selected?.deleted_at
        ? selected
        : null;
  function card(task: Task, rank?: number) {
    return (
      <TaskCard
        key={task.id}
        task={task}
        zone={zone}
        now={clock}
        rank={rank}
        initialOpen={task.id === taskId}
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
    handovers = data?.handovers_waiting ?? [],
    decisions = data?.decisions_waiting ?? 0;
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
      {filter === "today" && !search && !forValue && !source && !priority && (
        <>
          <UpcomingPreview owner={profile!.id} company={profile!.company_id} today={today}/>
          <Link className="button button-primary" to="/app/capture">
            Capture
          </Link>
        </>
      )}
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
              ? `${data.counts.todo + data.counts.progress} tasks, ${decisions + waiting + handovers.length} to review`
              : "Loading your tasks…"}
          </p>
        </div>
        <Link className="button button-primary" to="/app/capture">
          <WorkspaceIcon name="capture" />
          Capture
        </Link>
      </header>
      {message && (
        <p className="notice" role="status">
          {message}
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
          <div className="md-heading-tools">
            <button
              hidden
              className="md-visibility"
              onClick={() => access.current?.showModal()}
            >
              <WorkspaceIcon name="eye" />
              Who sees my tasks
            </button>
            <Button variant="secondary" onClick={() => setEditor({})}>
              Add a task
            </Button>
            <button
              className="md-text-button"
              onClick={() => setRolePicker(true)}
            >
              Add from My role
            </button>
          </div>
        </div>
        <div className="md-toolbar">
          <div className="md-filters" aria-label="Task filters"><label htmlFor="md-primary-filter">Filter </label><select id="md-primary-filter" value={filter} onChange={e => {setFilter(e.target.value);setPage(0)}}>{filters.map(([v,l]) => <option key={v} value={v}>{l} ({data?.tab_counts?.[v] ?? 0})</option>)}</select></div><div hidden><nav className="md-filters" aria-label="Legacy task views">
            {filters.map(([v, l]) => (
              <button
                key={v}
                aria-label={l}
                aria-pressed={filter === v}
                onClick={() => {
                  setFilter(v);
                  setPage(0);
                }}
              >
                {l}
                <span className="md-tab-count">
                  {data?.tab_counts?.[v] ?? 0}
                </span>
              </button>
            ))}
          </nav></div>
          <div className="md-view-toggle" aria-label="Task layout">
            {(["list", "board"] as const).map((v) => (
              <button
                key={v}
                aria-pressed={layout === v}
                onClick={() => {
                  setLayout(v);
                  try {
                    localStorage.setItem("vimbre:myday-view", v);
                  } catch {}
                }}
              >
                {v === "list" ? "List" : "Board"}
              </button>
            ))}
          </div>
        </div>
        <details className="md-filter-disclosure">
          <summary>
            More filters
            {search || forValue || source || priority ? " · Active" : ""}
          </summary>
          <div className="md-filter-row">
            <div className="field">
              <label htmlFor="md-search">Search tasks</label>
              <input
                id="md-search"
                type="search"
                placeholder="Search your tasks"
                maxLength={100}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <ForPicker
              filter
              value={forValue}
              onChange={(v) => {
                setFor(v);
                setPage(0);
              }}
            />
            <div className="field">
              <label htmlFor="md-source">Source</label>
              <select
                id="md-source"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">All sources</option>
                {Object.entries(sourceLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {v === "recurring_deadline" ? "Recurring deadline" : l}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="md-filter-priority">Priority</label>
              <select
                id="md-filter-priority"
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">All priorities</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
            {(query || forValue || source || priority) && (
              <button
                className="md-text-button"
                onClick={() => {
                  setQuery("");
                  setSearch("");
                  setFor(null);
                  setSource("");
                  setPriority("");
                  setPage(0);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </details>
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
            {filter === "today" && <h3 className="md-group-title">Today</h3>}
            {rows.length ? (
              layout === "board" && filter !== "archived" ? (
                board(rows)
              ) : (
                <div className="md-task-list">
                  {rows.map((t, i) => card(t, t.rank ?? page * 60 + i + 1))}
                </div>
              )
            ) : (
              empty
            )}
            {data && data.count > 60 && (
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
                <section className="md-day-group" aria-label="To review">
                  <h3>Waiting on you</h3>
                  <div className="md-waiting-links">
                    {decisions > 0 && (
                      <Link to="/app/capture">
                        {decisions} {decisions === 1 ? "decision" : "decisions"}{" "}
                        to confirm
                      </Link>
                    )}
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
                    {!waiting && !handovers.length && !decisions && (
                      <p>Nothing waiting for your review.</p>
                    )}
                  </div>
                </section>
                <section className="md-day-group" aria-label="Coming up">
                  <h3>Coming up</h3><RoleUpcoming/>
                  {upcoming.length ? (
                    <div className="md-task-list">
                      {upcoming.map((t) => card(t))}
                    </div>
                  ) : (
                    <p>No upcoming tasks in the next seven days.</p>
                  )}
                </section>
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
                <details className="md-day-group md-done-group">
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
                </details>
              </>
            )}
          </>
        )}
      </section>
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
      {record && (
        <TaskRecord task={record} zone={zone} close={() => setRecord(null)} />
      )}
      <dialog
        ref={access}
        className="vw-dialog"
        aria-labelledby="md-access-title"
      >
        <h2 id="md-access-title">What my manager can see</h2>
        <WorkVisibilityDetails />
        <Button onClick={() => access.current?.close()}>Close</Button>
      </dialog>
    </div>
  );
}
