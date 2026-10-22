import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
export type Alert = {
  id: string;
  task_id: string;
  title: string;
  phase: "due" | "check_in";
  created_at: string;
};
export function useTaskAlerts() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Alert[]>([]),
    [zone, setZone] = useState("Europe/London"),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!profile) return;
    let alive = true;
    const load = async () => {
      const [a, p] = await Promise.all([
        supabase.rpc("myday_alerts", {}),
        supabase.rpc("myday_preferences", {}),
      ]);
      if (!alive) return;
      setError(Boolean(a.error) || !Array.isArray(a.data));
      if (Array.isArray(a.data)) setRows(a.data as unknown as Alert[]);
      if (
        p.data &&
        typeof p.data === "object" &&
        "timezone" in p.data &&
        typeof p.data.timezone === "string"
      )
        setZone(p.data.timezone);
    };
    void load();
    const changed = () => {
      if (!document.hidden) void load();
    };
    const timer = setInterval(changed, 60000);
    window.addEventListener("vimbre:work-changed", changed);
    document.addEventListener("visibilitychange", changed);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("vimbre:work-changed", changed);
      document.removeEventListener("visibilitychange", changed);
    };
  }, [profile, revision]);
  return { rows, zone, error, refresh: () => setRevision((v) => v + 1) };
}
