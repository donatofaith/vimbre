import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { RoleDrawer } from "../records/RoleDrawer";
import { addDays,dateInZone } from "./types";
import { localReminder, morningTomorrow } from "./reminder-time";
import { changeTask, taskError } from "./api";
export function ReminderPanel({
  id,
  title,
  zone,
  close,
  changed,
  alert = false,
  initialReschedule = false,
}: {
  id: string;
  title: string;
  zone: string;
  close: () => void;
  changed: () => void;
  alert?: boolean;
  initialReschedule?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reschedule, setReschedule] = useState(initialReschedule),
    [pickingSnooze,setPickingSnooze] = useState(false),
    [date, setDate] = useState(()=>addDays(dateInZone(zone),1)),
    [time, setTime] = useState("09:00");
  async function apply(operation: string, data: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await changeTask(id, operation, data);
      changed();
      close();
    } catch (e) {
      setError(taskError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <RoleDrawer context="My day" title={initialReschedule?"Reschedule task":"Remind me"} close={close}>
      <section className="md-task-panel">
        <h2>{alert ? "Task reminder" : "Remind me"}</h2>
        <p className="md-reminder-task">{title}</p>
        {alert && (
          <Button
            disabled={busy}
            onClick={() => void apply("status", { status: "done" })}
          >
            Done
          </Button>
        )}
        <h3>Snooze</h3>
        <div className="md-snooze-options">
          {[
            [15, "15 minutes"],
            [180, "Later today"],
          ].map(([minutes, label]) => (
            <Button
              key={label}
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void apply("snooze", {
                  until: new Date(
                    Date.now() + Number(minutes) * 60000,
                  ).toISOString(),
                })
              }
            >
              {label}
            </Button>
          ))}
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void apply("snooze", { until: morningTomorrow(zone) })
            }
          >
            Tomorrow morning
          </Button>
          <Button variant="secondary" disabled={busy} onClick={()=>void apply("snooze", {until:localReminder(addDays(dateInZone(zone),7),"09:00",zone)})}>Next week</Button>
          <Button variant="secondary" disabled={busy} onClick={()=>{setPickingSnooze(true);setReschedule(true)}}>Choose a date</Button>
        </div>
        <Button
          variant="secondary"
          onClick={() => {setPickingSnooze(false);setReschedule((v) => !v)}}
          disabled={busy}
        >
          Not yet
        </Button>
        {reschedule && (
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              if(pickingSnooze){try{const until=localReminder(date,time,zone);if(Date.parse(until)<=Date.now()){setError("Choose a future reminder time.");return}void apply("snooze",{until})}catch(e){setError((e as Error).message)}}else void apply("reschedule", { due_date: date, due_time: time });
            }}
          >
            <Input
              label={pickingSnooze?"Reminder date":"New due date"}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <Input
              label={pickingSnooze?"Reminder time":"New due time"}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
            <Button type="submit" disabled={busy}>
              {pickingSnooze?"Save reminder":"Save new date and time"}
            </Button>
          </form>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </RoleDrawer>
  );
}
