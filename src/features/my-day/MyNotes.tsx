import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui/Button";
import { formatRecordDate } from "../records/record-utils";
type Note = { id: string; title: string; details: string; created_at: string };
export function MyNotes() {
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(0),
    [result, setResult] = useState<{ rows: Note[]; count: number } | null>(
      null,
    ),
    [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void supabase
      .rpc("myday_notes", { p_page: page })
      .then(({ data, error }) => {
        if (!alive) return;
        const v = data as unknown as { rows: Note[]; count: number };
        setError(Boolean(error) || !Array.isArray(v?.rows));
        setResult(Array.isArray(v?.rows) ? v : null);
      });
    return () => {
      alive = false;
    };
  }, [open, page]);
  return (
    <section className="card md-private-notes">
      <h2>
        <button
          className="md-text-button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="My notes from completed tasks"
        >
          Notes from completed tasks
        </button>
      </h2>
      {open && (
        <>
          <p className="muted">
            Private outcomes saved from your completed tasks.
          </p>
          {error ? (
            <p className="field-error" role="alert">
              Notes could not be loaded.
            </p>
          ) : !result ? (
            <p role="status">Loading notes…</p>
          ) : result.rows.length ? (
            result.rows.map((n) => (
              <article key={n.id} className="md-outcome-note">
                <h3>{n.title}</h3>
                <time dateTime={n.created_at}>
                  {formatRecordDate(n.created_at.slice(0, 10))}
                </time>
                <p>{n.details}</p>
              </article>
            ))
          ) : (
            <p>No task outcomes saved here yet.</p>
          )}
          {result && result.count > 20 && (
            <div className="pagination">
              <Button
                variant="secondary"
                disabled={!page}
                onClick={() => setPage((v) => v - 1)}
              >
                Previous notes
              </Button>
              <span>Page {page + 1}</span>
              <Button
                variant="secondary"
                disabled={(page + 1) * 20 >= result.count}
                onClick={() => setPage((v) => v + 1)}
              >
                Next notes
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
