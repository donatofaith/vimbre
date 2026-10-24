import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import "./my-day.css";
type Preferences = {
  timezone: string;
  reminder_time: string;
  email_enabled: boolean;
  email_delivery_ready: boolean;
};
export function WorkPreferences() {
  const [prefs, setPrefs] = useState<Preferences | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    void supabase.rpc("myday_preferences", {}).then(({ data, error }) => {
      if (!alive) return;
      if (error || !data || typeof data !== "object" || !("timezone" in data)) {
        setError("Reminder settings could not be loaded.");
        return;
      }
      setPrefs(data as unknown as Preferences);
    });
    return () => {
      alive = false;
    };
  }, []);
  async function save() {
    if (!prefs || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    const { error } = await supabase.rpc("myday_preferences", {
      p_save: {
        timezone: prefs.timezone,
        reminder_time: prefs.reminder_time,
        email_enabled: prefs.email_enabled,
      },
    });
    if (error) setError("Could not save reminder settings. Please retry.");
    else {
      setMessage("Reminder settings saved.");
      window.dispatchEvent(new Event("vimbre:work-changed"));
    }
    setBusy(false);
  }
  const zones = Array.from(
    new Set([
      "Europe/London",
      "Africa/Lagos",
      ...(Intl.supportedValuesOf?.("timeZone") ?? []),
      ...(prefs ? [prefs.timezone] : []),
    ]),
  );
  return (
    <section
      className="card settings-card md-preferences"
      aria-labelledby="md-preferences-title"
    >
      <h2 id="md-preferences-title">My reminders</h2>
      {!prefs && !error && <p role="status">Loading reminder settings…</p>}
      {prefs && (
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="field">
            <label htmlFor="md-timezone">Time zone</label>
            <select
              id="md-timezone"
              value={prefs.timezone}
              onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Default reminder time"
            type="time"
            required
            value={prefs.reminder_time.slice(0, 5)}
            onChange={(e) =>
              setPrefs({ ...prefs, reminder_time: e.target.value })
            }
          />
          <label className="md-email-choice">
            <input
              type="checkbox"
              checked={prefs.email_enabled}
              onChange={(e) =>
                setPrefs({ ...prefs, email_enabled: e.target.checked })
              }
            />
            Email me task reminders
          </label>
          {!prefs.email_delivery_ready && (
            <p className="notice">
              Email delivery is not enabled for this workspace. Reminders appear in Notifications.
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save reminder settings"}
          </Button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </section>
  );
}
