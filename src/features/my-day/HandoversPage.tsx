import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui/Button";
import { RoleDrawer } from "../records/RoleDrawer";
import { AIDraftPanel } from "../ai/AIDraftPanel";
import { loadOwnRecords } from "../ai/load-records";
import { formatRecordDate } from "../records/record-utils";
import "./my-day.css";
type Handover = {
  id: string;
  owner_id: string;
  cover_id: string;
  reviewer_id: string;
  owner_name: string;
  cover_name: string;
  reviewer_name: string;
  title: string;
  body: string;
  starts_on: string;
  ends_on: string;
  status: string;
};
type Person = {
  id: string;
  full_name: string;
  role: string;
  department_id: string | null;
};
const statusLabels: Record<string, string> = {
  draft: "Draft",
  pending: "Waiting for approval",
  approved: "Approved",
  declined: "Changes requested",
  cancelled: "Cancelled",
};
export function HandoversPage() {
  return <Handovers />;
}
export function CoverPage() {
  return <Handovers cover />;
}
function Handovers({ cover = false }: { cover?: boolean }) {
  const { profile, company } = useAuth(),
    [rows, setRows] = useState<Handover[] | null>(null),
    [revision, setRevision] = useState(0),
    [editor, setEditor] = useState<Handover | true | null>(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [today, setToday] = useState("");
  useEffect(() => {
    let live = true;
    const load = () => {
      void supabase.rpc("myday_handovers").then(({ data, error }) => {
        const v = data as unknown as { rows: Handover[]; today: string };
        if (live) {
          setRows(v?.rows ?? []);
          setToday(v?.today ?? "");
          setError(error ? "Handovers could not be loaded. Try again." : "");
        }
      });
    };
    load();
    const t = setInterval(load, 60000);
    window.addEventListener("focus", load);
    return () => {
      live = false;
      clearInterval(t);
      window.removeEventListener("focus", load);
    };
  }, [revision]);
  async function act(h: Handover, op: string) {
    if (busy) return;
    setBusy(h.id);
    setError("");
    try {
      const { error } = await supabase.rpc("myday_handover", {
        p_id: h.id,
        p_operation: op,
      });
      if (error) throw error;
      setRevision((v) => v + 1);
      window.dispatchEvent(new Event("vimbre:work-changed"));
    } catch {
      setError("The handover could not be updated. Refresh and try again.");
    } finally {
      setBusy("");
    }
  }
  const shown = cover
    ? rows?.filter((h) => h.cover_id === profile!.id && h.status === "approved")
    : rows?.filter(
        (h) => h.owner_id === profile!.id || h.reviewer_id === profile!.id,
      );
  return (
    <section className="md-work-section">
      <div className="md-section-heading">
        <h1 tabIndex={-1}>{cover ? "Cover duties" : "Handovers"}</h1>
        {!cover && (
          <Button onClick={() => setEditor(true)}>Prepare handover</Button>
        )}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
          <button onClick={() => setRevision((v) => v + 1)}>Retry</button>
        </p>
      )}
      {!rows ? (
        <p role="status">Loading handovers…</p>
      ) : !shown?.length ? (
        <p>{cover ? "No approved cover duties." : "No handovers yet."}</p>
      ) : (
        <div className="md-task-list">
          {shown.map((h) => (
            <details className="md-handover-card" key={h.id}>
              <summary>
                <strong>{h.title}</strong>
                <span>{statusLabels[h.status]}</span>
              </summary>
              <p>
                {h.owner_name} · Cover: {h.cover_name}
              </p>
              <p>
                <time>{formatRecordDate(h.starts_on)}</time> to{" "}
                <time>{formatRecordDate(h.ends_on)}</time>
              </p>
              <p className="record-text">{h.body}</p>
              {cover && h.starts_on <= today && h.ends_on >= today && (
                <Link to="/app">View today’s cover tasks</Link>
              )}
              <div className="md-expanded-actions">
                {h.owner_id === profile!.id && (
                  <>
                    {["draft", "declined"].includes(h.status) && (
                      <Button variant="secondary" onClick={() => setEditor(h)}>
                        Edit handover
                      </Button>
                    )}
                    {h.status === "draft" && (
                      <Button
                        disabled={Boolean(busy)}
                        onClick={() => void act(h, "submit")}
                      >
                        Send for approval
                      </Button>
                    )}
                    {h.status !== "cancelled" && (
                      <Button
                        variant="secondary"
                        disabled={Boolean(busy)}
                        onClick={() => void act(h, "cancel")}
                      >
                        Cancel handover
                      </Button>
                    )}
                  </>
                )}
                {h.reviewer_id === profile!.id && h.status === "pending" && (
                  <>
                    <Button
                      disabled={Boolean(busy)}
                      onClick={() => void act(h, "approve")}
                    >
                      Approve handover
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={Boolean(busy)}
                      onClick={() => void act(h, "decline")}
                    >
                      Request changes
                    </Button>
                  </>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
      {editor && (
        <HandoverEditor
          key={editor === true ? "new" : editor.id}
          handover={editor === true ? undefined : editor}
          close={() => setEditor(null)}
          saved={() => {
            setEditor(null);
            setRevision((v) => v + 1);
            window.dispatchEvent(new Event("vimbre:work-changed"));
          }}
        />
      )}
      {!cover && (
        <details className="md-day-group">
          <summary>Draft from My role</summary>
          <AIDraftPanel
            task="handover_draft"
            loadRecords={() => loadOwnRecords(profile!.id, company!.id)}
          />
        </details>
      )}
    </section>
  );
}
function HandoverEditor({
  handover,
  close,
  saved,
}: {
  handover?: Handover;
  close: () => void;
  saved: () => void;
}) {
  const { profile } = useAuth(),
    [id] = useState(() => handover?.id ?? crypto.randomUUID()),
    [people, setPeople] = useState<Person[] | null>(null),
    [peoplePage, setPeoplePage] = useState(0),
    [hasMore, setHasMore] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [body, setBody] = useState(handover?.body ?? "");
  useEffect(() => {
    let live = true;
    void supabase
      .rpc("myday_people", { p_query: "", p_page: peoplePage })
      .then(({ data, error }) => {
        if (live) {
          const next = Array.isArray(data) ? (data as unknown as Person[]) : [];
          setPeople((v) => (peoplePage ? [...(v ?? []), ...next] : next));
          setHasMore(next.length === 100);
          if (error)
            setError(
              "People could not be loaded. Close this panel and try again.",
            );
        }
      });
    return () => {
      live = false;
    };
  }, [profile, peoplePage]);
  const reviewers = people?.filter(
    (p) =>
      p.role === "hr_admin" ||
      (p.role === "manager" &&
        p.department_id &&
        p.department_id === profile!.department_id),
  );
  return (
    <RoleDrawer context="Handovers" title="Prepare handover" close={close}>
      <form
        className="auth-form md-task-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const { error } = await supabase.rpc("myday_handover", {
              p_id: id,
              p_operation: "save",
              p_data: {
                title: String(f.get("title")),
                body,
                cover_id: String(f.get("cover")),
                reviewer_id: String(f.get("reviewer")),
                starts_on: String(f.get("start")),
                ends_on: String(f.get("end")),
              },
            });
            if (error) throw error;
            saved();
          } catch {
            setError(
              "Check the dates, cover person and reviewer, then try again. Your draft is still here.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Prepare handover</h2>
        <label>
          Title
          <input
            data-autofocus=""
            name="title"
            required
            maxLength={200}
            defaultValue={handover?.title}
            placeholder="e.g. Operations cover"
          />
        </label>
        <div className="field">
          <label htmlFor="ho-cover">Cover person</label>
          <select id="ho-cover" name="cover" required defaultValue={handover?.cover_id ?? ""}>
            <option value="">Choose a teammate</option>
            {people?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ho-reviewer">Reviewer</label>
          <select
            id="ho-reviewer"
            name="reviewer"
            required
            defaultValue={handover?.reviewer_id ?? ""}
          >
            <option value="">Choose a manager or administrator</option>
            {reviewers?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        {hasMore && (
          <Button
            variant="secondary"
            onClick={() => setPeoplePage((v) => v + 1)}
          >
            Load more people
          </Button>
        )}
        <div className="form-grid">
          <label>
            Start date
            <input
              name="start"
              type="date"
              required
              defaultValue={handover?.starts_on}
            />
          </label>
          <label>
            End date
            <input
              name="end"
              type="date"
              required
              defaultValue={handover?.ends_on}
            />
          </label>
        </div>
        <label>
          Handover notes
          <textarea
            rows={8}
            maxLength={16000}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What needs attention, recent decisions and what to do first"
          />
        </label>
        {!people && <p role="status">Loading people…</p>}
        {people && !reviewers?.length && (
          <p>
            No reviewer is available. Ask your company administrator to add
            another manager or administrator.
          </p>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="md-panel-actions">
          <Button
            type="submit"
            disabled={busy || !people || !reviewers?.length}
          >
            {busy ? "Saving…" : "Save handover"}
          </Button>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
        </div>
      </form>
    </RoleDrawer>
  );
}
