import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { RoleDrawer } from "../records/RoleDrawer";
import { safeRecordUrl } from "../records/record-utils";
import type { StructuredDraft } from "../ai/structured-output";
import { ForPicker } from "./ForPicker";
import type { Task, ForOption } from "./types";
import { addDays } from "./types";
import { changeTask, taskError } from "./api";
export function TaskPanel({
  task,
  draft,
  today,
  close,
  saved,
}: {
  task?: Task;
  draft?: StructuredDraft;
  today: string;
  close: () => void;
  saved: () => void;
}) {
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
    if (busy) return;
    setBusy(true);
    setError("");
    const fd = new FormData(event.currentTarget),
      get = (k: string) => String(fd.get(k) ?? "").trim();
    const url = get("source_url"), links=get("links").split("\n").map(s=>s.trim()).filter(Boolean);
    if (url && !safeRecordUrl(url) || links.some(link=>!safeRecordUrl(link))) {
      setError("Use a valid http or https link.");
      setBusy(false);
      return;
    }
    try {
      await changeTask(id, task ? "edit" : "create", {
        title: get("title"),
        base_updated_at: task?.updated_at,
        due_date: date,
        due_time: date?time:"",
        details: get("details"),
        status: get("status"),
        priority: "normal",
        time_needed_minutes: get("time_needed_minutes")?Number(get("time_needed_minutes")):null,
        label: get("label"),
        steps: get("steps").split("\n").map(s=>s.trim()).filter(Boolean),
        links,
        reminder_option: get("reminder_option"),
        completion_note: get("completion_note"),
        source_url: url,
        department_id: forValue?.kind === "department" ? forValue.id : null,
        external_contact_id: forValue?.kind === "contact" ? forValue.id : null,
        source_kind: task?.source_kind ?? (draft ? "ai" : "manual"),
      });
      saved();
    } catch (reason) {
      setError(taskError(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <RoleDrawer
      context="My day"
      title={task ? "Edit task" : "Add a task"}
      close={close}
    >
      <section className="md-task-panel">
        <h2>{task ? "Edit task" : "Add a task"}</h2>
        {draft && (
          <p className="md-draft-note">
            Draft from Vimbre AI. Check before saving.
          </p>
        )}
        <form className="auth-form" onSubmit={save}>
          <Input
            autoFocus
            data-autofocus=""
            label="What needs to be done?"
            name="title"
            required
            maxLength={300}
            defaultValue={task?.title ?? draft?.title}
            placeholder="e.g. Share the supplier review notes"
          />
          <div className="field">
            <label htmlFor="md-date">Due date</label>
            <div className="md-date-chips">
              {[
                ["Today", today],
                ["Tomorrow", addDays(today, 1)],
                ["Next week", addDays(today, 7)],
              ].map(([label, value]) => (
                <button
                  type="button"
                  key={label}
                  aria-pressed={date === value}
                  onClick={() => setDate(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              id="md-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Input
            label="Time (optional)"
            disabled={!date}
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          <ForPicker
            suggestion={draft?.department_name || draft?.external_contact_name}
            value={forValue}
            onChange={setFor}
          />
          <details className="md-more" open={task ? true : undefined}>
            <summary>More options</summary>
            <div className="auth-form">
              <div className="field">
                <label htmlFor="md-details">Details</label>
                <textarea
                  id="md-details"
                  name="details"
                  rows={4}
                  maxLength={5000}
                  defaultValue={task?.details ?? draft?.details}
                />
              </div>
              <div className="field">
                <label htmlFor="md-status">Status</label>
                <select
                  id="md-status"
                  name="status"
                  disabled={!task}
                  defaultValue={task?.status ?? "open"}
                >
                  <option value="open">To do</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                  {task && <option value="archived">Deleted</option>}
                </select>
              </div>
              <div className="field">
                <label htmlFor="md-reminder">Remind me</label>
                <select
                  id="md-reminder"
                  name="reminder_option"
                  defaultValue={task?.reminder_option ?? "at_time"}
                >
                  <option value="at_time">At due time</option>
                  <option value="30_minutes">30 minutes before</option>
                  <option value="1_hour">1 hour before</option>
                  <option value="day_before">The day before at 9:00</option>
                </select>
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
              <label className="field">Time needed<select aria-label="Time needed" name="time_needed_minutes" defaultValue={task?.time_needed_minutes??""}><option value="">Not set</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option></select><span className="field-hint">For planning. No time tracking.</span></label>
              <label className="field">Steps<textarea name="steps" rows={4} maxLength={5000} defaultValue={(task?.steps??[]).join("\n")} placeholder="One step per line"/></label>
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
          <div className="md-panel-actions">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save task"}
            </Button>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel edit
            </Button>
          </div>
        </form>
      </section>
    </RoleDrawer>
  );
}
