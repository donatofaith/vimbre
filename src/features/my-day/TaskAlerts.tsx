import { useState } from "react";
import { Link } from "react-router-dom";
import type { Alert } from "./useTaskAlerts";
import { Button } from "../../components/ui/Button";
import { ReminderPanel } from "./ReminderPanel";
import { changeTask } from "./api";
import "./my-day.css";
export function TaskAlerts({
  alerts,
  zone,
  changed,
  close,
}: {
  alerts: Alert[];
  zone: string;
  changed: () => void;
  close: () => void;
}) {
  const [selected, setSelected] = useState<(Alert & {reschedule?:boolean}) | null>(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function done(a: Alert) {
    if (busy) return;
    setBusy(a.id);
    setError("");
    try {
      await changeTask(a.task_id, "status", { status: "done" });
      changed();
    } catch {
      setError("The task could not be updated. Please retry.");
    } finally {
      setBusy("");
    }
  }
  return (
    <section aria-labelledby="task-alerts-title">
      <h3 id="task-alerts-title">Tasks</h3>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <ul>
        {alerts.map((a) => (
          <li key={a.id} className="md-alert">
            <Link to={`/app?task=${a.task_id}`} onClick={close}>
              <strong>
                {a.phase === "due"
                  ? `Due now: ${a.title}`
                  : `Is this done? ${a.title} is still open.`}
              </strong>
            </Link>
            <div className="md-alert-actions">
              <Button
                variant="secondary"
                disabled={Boolean(busy)}
                onClick={() => void done(a)}
              >
                Done
              </Button>
              <Button
                variant="secondary"
                disabled={Boolean(busy)}
                onClick={() => {
                  setSelected(a);
                }}
              >
                Snooze
              </Button>
              {a.phase === "check_in" && (
                <Button
                  variant="secondary"
                  disabled={Boolean(busy)}
                  onClick={() => setSelected({...a,reschedule:true})}
                >
                  Not yet
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {selected && (
        <ReminderPanel
          id={selected.task_id}
          title={selected.title}
          zone={zone}
          alert
          initialReschedule={selected.reschedule}
          close={() => setSelected(null)}
          changed={changed}
        />
      )}
    </section>
  );
}
