import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { WorkspaceIcon } from "../../components/ui/WorkspaceIcon";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { StructuredAI } from "../ai/StructuredAI";
import type { StructuredDraft } from "../ai/structured-output";
import { RoleDrawer } from "../records/RoleDrawer";
import { CaptureSummary, RoleChecklist } from "../workspace/MyDayOverview";
import { useMyDaySummary } from "../workspace/useMyDaySummary";
import { WorkVisibilityDetails } from "../workspace/WorkVisibilityDetails";
import { AIDraftPanel } from "../ai/AIDraftPanel";
import { loadOwnRecords } from "../ai/load-records";
import { TaskPanel } from "./TaskPanel";
import { ForPicker } from "./ForPicker";
import { ContextPanel } from "./ContextPanel";
import { ReminderPanel } from "./ReminderPanel";
import { changeTask, taskError } from "./api";
import {
  greetingInZone,
  parseDay,
  statuses,
  sourceLabels,
  taskDate,
  dateInZone,
} from "./types";
import type { DayData, Task, ForOption } from "./types";
import "./my-day.css";
const filters = [
  ["today", "Today"],
  ["week", "This week"],
  ["overdue", "Overdue"],
  ["all", "All"],
  ["archived", "Archived"],
] as const;
export function MyDayPage() {
  const [params] = useSearchParams();
  const { profile } = useAuth();
  return <MyDayContent key={`${profile!.id}:${params.get("task") ?? ""}`} />;
}
function MyDayContent() {
  const { profile, company } = useAuth(),
    [params] = useSearchParams();
  const [clock, setClock] = useState(() => new Date());
  const taskId = params.get("task") ?? "";
  const linked = params.get("decision") ?? "";
  const [filter, setFilter] = useState(taskId || linked ? "all" : "today"),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [forValue, setFor] = useState<ForOption | null>(null),
    [page, setPage] = useState(0),
    [revision, setRevision] = useState(0);
  const [layout, setLayout] = useState<"list" | "board">(() => {
    try {
      const v = localStorage.getItem("vimbre:myday-view");
      if (v === "list" || v === "board") return v;
    } catch {}
    return window.matchMedia("(max-width: 767px)").matches ? "list" : "board";
  });
  const [result, setResult] = useState<{
      key: string;
      data: DayData | null;
      error: boolean;
    } | null>(null),
    [editor, setEditor] = useState<{
      task?: Task;
      draft?: StructuredDraft;
    } | null>(null),
    [aiOpen, setAI] = useState(false),
    [drafts, setDrafts] = useState<StructuredDraft[] | null>(null);
  const [context, setContext] = useState<Task | null>(null),
    [reminder, setReminder] = useState<Task | null>(null),
    [summaryOpen, setSummaryOpen] = useState(false),
    [dismissedAction, setDismissedAction] = useState(false);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const access = useRef<HTMLDialogElement>(null),
    dragging = useRef("");
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  const summary = useMyDaySummary(profile!.id, revision, true);
  const key = `${filter}:${search}:${forValue?.kind}:${forValue?.id}:${page}`;
  const current = result?.key === key ? result : null;
  const data = current?.data ?? null;
  const zone = data?.timezone ?? "Europe/London";
  const today = data?.today ?? dateInZone(zone);
  const refresh = () => {
    setRevision((v) => v + 1);
    window.dispatchEvent(new Event("vimbre:work-changed"));
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.rpc("myday_tasks", {
        p_filter: filter,
        p_query: search,
        p_for: forValue ? `${forValue.kind}:${forValue.id}` : "",
        p_page: page,
        p_task: taskId || null,
        p_decision: linked || null,
      });
      if (alive)
        setResult({
          key,
          data: parseDay(data),
          error: Boolean(error) || !parseDay(data),
        });
    };
    void load();
    const onReturn = () => {
      if (!document.hidden) {
        setClock(new Date());
        void load();
      }
    };
    const timer = setInterval(onReturn, 60000);
    window.addEventListener("focus", onReturn);
    window.addEventListener("vimbre:work-changed", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("vimbre:work-changed", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [key, filter, search, forValue, page, taskId, linked, revision]);
  useEffect(() => {
    if (params.get("visibility") === "manager") access.current?.showModal();
  }, [params]);
  async function act(
    task: Task,
    operation: string,
    values: Record<string, unknown>,
  ) {
    if (busy) return;
    setBusy(task.id);
    setError("");
    try {
      await changeTask(task.id, operation, values);
      setMessage(
        operation === "status"
          ? "Task updated."
          : operation === "archive"
            ? "Task archived."
            : "Task restored.",
      );
      if (operation === "status" && values.status === "done")
        setContext({ ...task, status: "done" });
      refresh();
    } catch (e) {
      setError(taskError(e));
    } finally {
      setBusy("");
    }
  }
  function changeLayout(value: "board" | "list") {
    setLayout(value);
    try {
      localStorage.setItem("vimbre:myday-view", value);
    } catch {}
  }
  const rows = data?.rows ?? [];
  const selected = rows.find((row) => row.id === taskId);
  const requestedReminder =
    !dismissedAction && params.has("task_action") ? selected : null;
  function taskCard(task: Task) {
    return (
      <article
        className="md-task-card"
        key={task.id}
        draggable={!task.deleted_at && !busy}
        onDragStart={(e) => {
          dragging.current = task.id;
          e.dataTransfer.setData("text/plain", task.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => {
          dragging.current = "";
        }}
      >
        <div className="md-card-top">
          <span
            className={`md-source md-source-${task.source_kind ?? "manual"}`}
          >
            <WorkspaceIcon
              name={
                task.source_kind === "email"
                  ? "capture"
                  : task.source_kind === "recurring_deadline"
                    ? "calendar"
                    : "record"
              }
            />
            {sourceLabels[task.source_kind ?? "manual"]}
          </span>
          {task.status !== "done" &&
            task.due_at &&
            new Date(task.due_at) < clock && (
              <span className="md-overdue">Overdue</span>
            )}
        </div>
        <button className="md-task-title" onClick={() => setEditor({ task })}>
          {task.title}
        </button>
        {(task.department_name || task.external_contact_name) && (
          <span className="md-for-chip">
            {task.department_name || task.external_contact_name}
          </span>
        )}
        <div className="md-card-date">
          <WorkspaceIcon name="calendar" />
          <time dateTime={task.due_at ?? task.due_date}>
            {taskDate(task, zone)}
          </time>
        </div>
        {task.details && <p className="md-card-details">{task.details}</p>}
        {task.deleted_at ? (
          <Button
            variant="secondary"
            disabled={Boolean(busy)}
            onClick={() => void act(task, "restore", {})}
          >
            Restore task
          </Button>
        ) : (
          <>
            <div className="md-card-controls">
              <label className="sr-only" htmlFor={`status-${task.id}`}>
                Status for {task.title}
              </label>
              <select
                id={`status-${task.id}`}
                aria-label={`Status for ${task.title}`}
                value={task.status}
                disabled={Boolean(busy)}
                onChange={(e) =>
                  void act(task, "status", { status: e.target.value })
                }
              >
                {statuses.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {task.status !== "done" && (
                <button
                  className="md-remind-button"
                  onClick={() => setReminder(task)}
                >
                  <WorkspaceIcon name="bell" />
                  Remind me
                </button>
              )}
            </div>
            <div className="md-card-bottom">
              {task.status === "done" ? (
                task.context_added_at ? (
                  <span className="md-context-added">
                    <WorkspaceIcon name="tick" />
                    Added to context
                  </span>
                ) : (
                  <button
                    className="md-text-button"
                    onClick={() => setContext(task)}
                  >
                    Add to context
                  </button>
                )
              ) : (
                <button
                  className="md-text-button"
                  onClick={() => void act(task, "status", { status: "done" })}
                  disabled={Boolean(busy)}
                >
                  Mark done
                </button>
              )}
              <button
                className="md-text-button md-muted"
                onClick={() => {
                  if (window.confirm(`Archive “${task.title}”?`))
                    void act(task, "archive", {});
                }}
                disabled={Boolean(busy)}
              >
                Archive
              </button>
            </div>
          </>
        )}
      </article>
    );
  }
  const taskArea = (
    <section className="md-work-section" aria-labelledby="md-tasks-heading">
      <div className="md-section-heading">
        <h2 id="md-tasks-heading">Your tasks</h2>
        <button
          className="md-visibility"
          onClick={() => access.current?.showModal()}
        >
          <WorkspaceIcon name="eye" />
          What my manager can see
        </button>
      </div>
      <div className="md-toolbar">
        <nav className="md-filters" aria-label="Task views">
          {filters.map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setPage(0);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="md-view-toggle" aria-label="Task layout">
          {(["list", "board"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={layout === value}
              onClick={() => changeLayout(value)}
            >
              {value === "list" ? "List" : "Board"}
            </button>
          ))}
        </div>
      </div>
      <div className="md-filter-row">
        <div className="field">
          <label htmlFor="md-search">Search tasks</label>
          <input
            id="md-search"
            type="search"
            placeholder="Search your tasks"
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
      </div>
      {(taskId || linked) && (
        <Link className="md-text-button" to="/app">
          All tasks
        </Link>
      )}
      {!current ? (
        <div className="md-empty" role="status">
          Loading tasks…
        </div>
      ) : current.error ? (
        <div className="md-empty">
          <p role="alert">Tasks could not be loaded.</p>
          <Button onClick={refresh}>Retry tasks</Button>
        </div>
      ) : layout === "board" && filter !== "archived" ? (
        <div className="md-board">
          {statuses.map(([status, label]) => (
            <section
              className={`md-board-column md-column-${status}`}
              key={status}
              aria-label={label}
              onDragOver={(e) => {
                if (dragging.current) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const task = rows.find((t) => t.id === dragging.current);
                dragging.current = "";
                if (task && task.status !== status)
                  void act(task, "status", { status });
              }}
            >
              <h3>
                {label}
                <span>
                  {rows.filter((row) => row.status === status).length}
                </span>
              </h3>
              <div className="md-column-cards">
                {rows.filter((row) => row.status === status).map(taskCard)}
                {!rows.some((row) => row.status === status) && (
                  <p className="md-column-empty">
                    {status === "done"
                      ? "No tasks finished in the last seven days."
                      : status === "in_progress"
                        ? "No tasks in progress."
                        : filter === "today"
                          ? "Nothing due today."
                          : "No tasks to do."}
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : rows.length ? (
        <div className="md-task-list">{rows.map(taskCard)}</div>
      ) : (
        <div className="md-empty">
          <WorkspaceIcon name="tick" />
          <p>
            {filter === "today"
              ? "Nothing due today."
              : filter === "overdue"
                ? "No overdue tasks."
                : filter === "archived"
                  ? "No archived tasks."
                  : "No tasks match these filters."}
          </p>
        </div>
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
    </section>
  );
  return (
    <div className="md-page">
      <header className="md-page-heading">
        <div>
          <span className="md-date-label">
            {new Intl.DateTimeFormat("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: zone,
            }).format(clock)}
          </span>
          <h1 tabIndex={-1}>
            {greetingInZone(zone)}, {profile!.full_name.trim().split(/\s+/)[0]}
          </h1>
          <p className="md-live-line">
            {data
              ? data.counts.todo + data.counts.progress + data.counts.overdue
                ? `${data.counts.todo} to do, ${data.counts.progress} in progress, ${data.counts.overdue} overdue.`
                : "Nothing due today."
              : current?.error
                ? ""
                : "Loading your tasks…"}
          </p>
        </div>
        <div className="md-main-actions">
          <Button onClick={() => setAI(true)}>
            <WorkspaceIcon name="record" />
            Use Vimbre AI
          </Button>
          <Button variant="secondary" onClick={() => setEditor({})}>
            <WorkspaceIcon name="plus" />
            Add a task
          </Button>
          <Link className="button button-secondary" to="/app/capture">
            <WorkspaceIcon name="capture" />
            Capture an email or notes
          </Link>
        </div>
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
      <CaptureSummary data={summary.data ? {...summary.data,forwarding_address:null} : null} />
      {data && !data.has_work && (
        <RoleChecklist
          data={summary.data}
          error={Boolean(summary.error)}
          retry={summary.retry}
        />
      )}
      {data && data.context_waiting.length > 0 && (
        <section
          className="md-context-pending"
          aria-label="Completed tasks to add to context"
        >
          <div>
            <WorkspaceIcon name="tick" />
            <strong>
              {data.context_waiting.length} completed{" "}
              {data.context_waiting.length === 1 ? "task" : "tasks"} to add to
              context
            </strong>
          </div>
          <div>
            {data.context_waiting.map((task) => (
              <button key={task.id} onClick={() => setContext(task)}>
                {task.title}
                <WorkspaceIcon name="arrow" />
              </button>
            ))}
          </div>
        </section>
      )}
      {taskArea}
      <CaptureSummary data={summary.data ? {...summary.data,pending_drafts:0} : null} />
      <footer className="md-footer-links">
        {data?.has_work && (
          <details>
            <summary>Get started</summary>
            <RoleChecklist
              data={summary.data}
              error={Boolean(summary.error)}
              retry={summary.retry}
            />
          </details>
        )}
        <div>
          <Link to="/app/handovers">My handovers</Link>
          <Link to="/app/my-cover-duties">Cover duties</Link>
          <button onClick={() => setSummaryOpen(true)}>Weekly summary</button>
        </div>
      </footer>
      {editor && (
        <TaskPanel
          key={editor.task?.id ?? "new"}
          task={editor.task}
          draft={editor.draft}
          today={today}
          close={() => setEditor(null)}
          saved={() => {
            if (editor.draft && drafts?.length) setAI(true);
            setEditor(null);
            setMessage("Task saved.");
            refresh();
          }}
        />
      )}
      {aiOpen && (
        <RoleDrawer
          context="My day"
          title="Use Vimbre AI"
          close={() => setAI(false)}
        >
          <StructuredAI
            kind="task"
            referenceDate={today}
            cached={drafts}
            onDrafts={setDrafts}
            loadRecords={async () => {
              const { data, error } = await supabase
                .from("role_items")
                .select("kind,title,details,recurrence,due_date,next_step")
                .eq("owner_id", profile!.id)
                .eq("company_id", company!.id)
                .in("kind", [
                  "responsibility",
                  "workstream",
                  "recurring_deadline",
                ])
                .is("deleted_at", null)
                .limit(100);
              if (error) throw error;
              return `Time zone: ${zone}\n${(data ?? []).map((r) => `${r.kind === "responsibility" ? "Responsibility" : r.kind === "workstream" ? "Open work" : "Recurring deadline"}: ${r.title}\n${r.details}\n${r.recurrence ? `Repeats: ${r.recurrence}\n` : ""}${r.due_date ? `Due: ${r.due_date}\n` : ""}${r.next_step ? `Next step: ${r.next_step}` : ""}`).join("\n\n")}`;
            }}
            choose={(draft, _file, index) => {
              setDrafts((v) => v?.filter((_, i) => i !== index) ?? null);
              setAI(false);
              setEditor({ draft });
            }}
          />
        </RoleDrawer>
      )}
      {(reminder || requestedReminder) && (
        <ReminderPanel
          id={(reminder || requestedReminder)!.id}
          title={(reminder || requestedReminder)!.title}
          zone={zone}
          alert={Boolean(requestedReminder)}
          close={() => {
            setReminder(null);
            setDismissedAction(true);
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
      {summaryOpen && (
        <RoleDrawer
          context="My day"
          title="Weekly summary"
          close={() => setSummaryOpen(false)}
        >
          <AIDraftPanel
            task="weekly_summary"
            loadRecords={() => loadOwnRecords(profile!.id, company!.id)}
          />
        </RoleDrawer>
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
