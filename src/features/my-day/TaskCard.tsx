import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { WorkspaceIcon } from "../../components/ui/WorkspaceIcon";
import { supabase } from "../../lib/supabase";
import { RoleDrawer } from "../records/RoleDrawer";
import { safeRecordUrl } from "../records/record-utils";
import { sourceLabels, statuses, taskDate } from "./types";
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
  const [history, setHistory] = useState<
      | {
          id: number;
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
          {taskDate(task, zone)} ·{" "}
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
                  {h.previous_status
                    ? `${label(h.previous_status)} → ${label(h.status)}`
                    : `Recorded as ${label(h.status)}`}
                </strong>
                <time dateTime={h.created_at}>
                  {new Intl.DateTimeFormat("en-GB", {
                    dateStyle: "medium",
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
export function TaskCard({
  task,
  zone,
  busy,
  rank,
  initialOpen = false,
  now,
  act,
  edit,
  remind,
  context,
  quickContext,
  record,
  drag,
}: {
  task: Task;
  zone: string;
  busy: boolean;
  rank?: number;
  initialOpen?: boolean;
  now: Date;
  act: (task: Task, op: string, values: Record<string, unknown>) => void;
  edit: (task: Task) => void;
  remind: (task: Task) => void;
  context: (task: Task) => void;
  quickContext: (task: Task, outcome: string) => void;
  record: (task: Task) => void;
  drag: (id: string) => void;
}) {
  const [outcome, setOutcome] = useState(task.completion_note ?? ""),
    [open, setOpen] = useState(initialOpen),
    id = useId(),
    source = task.source_role_id ?? task.stable_role_item_id ?? task.recurring_id;
  const overdue =
    task.status !== "done" && !task.deleted_at && new Date(task.due_at) < now;
  return (
    <article
      className={`md-task-card md-compact-card${open ? " is-expanded" : ""}`}
      draggable={!task.deleted_at && !busy}
      onDragStart={(e) => {
        drag(task.id);
        e.dataTransfer.setData("text/plain", task.id);
      }}
      onDragEnd={() => drag("")}
    >
      <div className="md-task-summary">
        {rank !== undefined && (
          <span className="md-rank" aria-label={`Rank ${rank}`}>
            {rank}
          </span>
        )}
        <button
          className="md-task-title"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
        >
          {task.title}
          <span aria-hidden="true">{open ? "⌃" : "⌄"}</span>
        </button>
      </div>
      <div className="md-task-meta">
        <span className="md-source">
          From {sourceLabels[task.source_kind ?? "manual"]}
        </span>
        <span
          hidden
          className={`md-priority md-priority-${task.priority ?? "normal"}`}
        >
          {task.priority === "high"
            ? "High"
            : task.priority === "low"
              ? "Low"
              : "Normal"}
        </span>
        {task.pinned_at && <span className="md-pin-badge">Starred</span>}
        {task.department_name && (
          <span className="md-for-chip">{task.department_name}</span>
        )}
        {task.external_contact_name && (
          <span className="md-for-chip">{task.external_contact_name}</span>
        )}
        <time dateTime={task.due_at}>{taskDate(task, zone)}</time>
        {overdue && <span className="md-overdue">Overdue</span>}
      </div>
      <div className="md-card-controls">
        <label className="sr-only" htmlFor={`${id}-status`}>
          Status for {task.title}
        </label>
        <select
          id={`${id}-status`}
          aria-label={`Status for ${task.title}`}
          value={task.deleted_at ? "archived" : task.status}
          disabled={busy || Boolean(task.deleted_at)}
          onChange={(e) =>
            act(task, e.target.value === "archived" ? "archive" : "status", {
              status: e.target.value,
            })
          }
        >
          {statuses.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
          <option value="archived">Deleted</option>
        </select>
        {!task.deleted_at && task.status !== "done" && (
          <button
            className="md-text-button"
            disabled={busy}
            aria-pressed={Boolean(task.pinned_at)}
            aria-label={`${task.pinned_at ? "Unstar" : "Star"} ${task.title}`}
            onClick={() => act(task, "pin", { pinned: !task.pinned_at })}
          >
            {task.pinned_at ? "Unstar" : "Star"}
          </button>
        )}
        {task.deleted_at && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => act(task, "restore", {})}
          >
            Restore
          </Button>
        )}
      </div>
      {open && (
        <div className="md-task-expanded" id={id}>
          {task.details && <p className="record-text">{task.details}</p>}
          {source && (
            <Link
              to={`/app/role-record?section=${task.source_role_kind ?? "recurring_deadline"}&record=${source}${task.source_role_profile_id ? `&role=${task.source_role_profile_id}` : ""}`}
            >
              My role record
            </Link>
          )}
          {safeRecordUrl(task.source_url) && (
            <a
              href={safeRecordUrl(task.source_url)!}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open source
            </a>
          )}
          <div className="md-expanded-actions">
            {!(task.status === "done" && task.context_added_at) && (
              <button className="md-text-button" onClick={() => record(task)}>
                Record
              </button>
            )}
            {!task.deleted_at && (
              <>
                <button className="md-text-button" onClick={() => edit(task)}>
                  Edit task
                </button>
                {task.status !== "done" && (
                  <button
                    className="md-remind-button"
                    onClick={() => remind(task)}
                  >
                    <WorkspaceIcon name="bell" />
                    Remind me
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {!task.deleted_at && task.status === "done" && (
        <div className="md-card-bottom">
          {task.context_added_at ? (
            <>
              <span className="md-context-added">
                <WorkspaceIcon name="tick" />
                Added to context
              </span>
              <button className="md-text-button" onClick={() => record(task)}>
                Record
              </button>
            </>
          ) : (
            <div className="md-quick-context">
              <label>
                What happened? (optional)
                <input
                  maxLength={5000}
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                />
              </label>
              <span className="field-hint">
                Save to My notes, private to you.
              </span>
              <button
                className="md-text-button"
                disabled={busy}
                onClick={() => quickContext(task, outcome)}
              >
                Add to context
              </button>
              {open && (
                <button
                  className="md-text-button md-muted"
                  onClick={() => context(task)}
                >
                  Choose where to save
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
