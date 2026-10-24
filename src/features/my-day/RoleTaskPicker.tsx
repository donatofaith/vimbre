import { useEffect, useState } from "react";
import { RoleDrawer } from "../records/RoleDrawer";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";

import { taskError } from "./api";
export function RoleTaskPicker({
  today,
  close,
  saved,
}: {
  today: string;
  close: () => void;
  saved: () => void;
}) {
  const
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [date, setDate] = useState(today),
    [rows, setRows] = useState<
      { id: string; title: string; kind: string }[] | null
    >(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      void supabase.rpc('role_workspace', {p_operation:'task_choices', p_data:{query,page}})
        .then(({ data, error }) => {
          if (live) {
            setRows((data ?? []) as unknown as {id:string;title:string;kind:string}[]);
            setError(error ? "Your role could not be loaded. Try again." : "");
          }
        });
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, page]);
  return (
    <RoleDrawer context="My day" title="Add from My role" close={close}>
      <section className="md-task-panel">
        <h2>Add from My role</h2>
        <div className="field">
          <label htmlFor="role-task-date">Due date</label>
          <input
            id="role-task-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="role-task-search">Search your role</label>
          <input
            id="role-task-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {!rows ? (
          <p role="status">Loading your role…</p>
        ) : rows.length ? (
          <ul className="md-role-options">
            {rows.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.title}</strong>
                  <span>
                    {r.kind === "responsibility"
                      ? "Responsibility"
                      : r.kind === "workstream"
                        ? "Project"
                        : "Recurring deadline"}
                  </span>
                </div>
                <Button
                  disabled={Boolean(busy) || !date}
                  onClick={async () => {
                    setBusy(r.id);
                    setError("");
                    try {
                      const { error } = await supabase.rpc("myday_role_task", {
                        p_record: r.id,
                        p_date: date,
                      });
                      if (error) throw error;
                      saved();
                    } catch (e) {
                      setError(taskError(e));
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  {busy === r.id ? "Adding…" : "Add task"}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No matching responsibilities, projects or deadlines.</p>
        )}
        <div className="pagination">
          <Button
            variant="secondary"
            disabled={!page}
            onClick={() => setPage((v) => v - 1)}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            disabled={!rows || rows.length < 20}
            onClick={() => setPage((v) => v + 1)}
          >
            Next
          </Button>
        </div>
      </section>
    </RoleDrawer>
  );
}
