import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { safeSearch } from "../team/team-utils";
import type { ForOption } from "./types";
export function ForPicker({
  value,
  onChange,
  filter = false,
  suggestion = "",
}: {
  value: ForOption | null;
  onChange: (v: ForOption | null) => void;
  filter?: boolean;
  suggestion?: string;
}) {
  const { profile, company } = useAuth(),
    id = useId(),
    input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(value?.label ?? suggestion),
    [rows, setRows] = useState<ForOption[]>([]);
  const [error, setError] = useState(false),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(-1);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      const term = safeSearch(
        query.replace(/ \((Department|External contact)\)$/, ""),
      );
      const [deps, contacts] = await Promise.all([
        supabase
          .from("departments")
          .select("id,name")
          .eq("company_id", company!.id)
          .is("archived_at", null)
          .ilike("name", `%${term}%`)
          .order("name")
          .limit(20),
        supabase
          .from("role_items")
          .select("id,title")
          .eq("company_id", company!.id)
          .eq("owner_id", profile!.id)
          .eq("kind", "external_contact")
          .is("deleted_at", null)
          .ilike("title", `%${term}%`)
          .order("title")
          .limit(20),
      ]);
      if (alive) {
        setError(Boolean(deps.error || contacts.error)||!Array.isArray(deps.data)||!Array.isArray(contacts.data));
        setRows([
          ...(Array.isArray(deps.data)?deps.data:[]).map((r) => ({
            id: r.id,
            kind: "department" as const,
            name: r.name,
            label: `${r.name} (Department)`,
          })),
          ...(Array.isArray(contacts.data)?contacts.data:[]).map((r) => ({
            id: r.id,
            kind: "contact" as const,
            name: r.title,
            label: `${r.title} (External contact)`,
          })),
        ]);
      }
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, profile?.id, company?.id]);
  useEffect(() => {
    input.current?.setCustomValidity(
      !filter && query && !value
        ? "Choose a department or external contact from the list."
        : "",
    );
  }, [filter, query, value]);
  function choose(row: ForOption | null) {
    setQuery(row?.label ?? "");
    onChange(row);
    setOpen(false);
    setActive(-1);
    input.current?.focus();
  }
  const options: (ForOption | null)[] = [null, ...rows];
  return (
    <div
      className="field md-for-picker"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <label htmlFor={id}>{filter ? "Filter by" : "For"}</label>
      <input
        ref={input}
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-activedescendant={
          open && active >= 0 ? `${id}-option-${active}` : undefined
        }
        value={query}
        autoComplete="off"
        placeholder="Department or external contact"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(null);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            setActive(-1);
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((v) =>
              e.key === "ArrowDown"
                ? Math.min(v + 1, options.length - 1)
                : Math.max(v - 1, 0),
            );
          }
          if (
            e.key === "Enter" &&
            open &&
            active >= 0 &&
            active < options.length
          ) {
            e.preventDefault();
            choose(options[active]);
          }
        }}
      />
      {open && (
        <ul
          id={`${id}-options`}
          role="listbox"
          aria-label={
            filter ? "Filter choices" : "Departments and external contacts"
          }
          className="md-for-options"
        >
          {options.map((row, index) => (
            <li
              key={row ? `${row.kind}:${row.id}` : "none"}
              role="presentation"
            >
              <button
                type="button"
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={active === index}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(row)}
              >
                {row?.label ??
                  (filter
                    ? "All departments and external contacts"
                    : "No department or external contact")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && error && (
        <p className="field-error" role="alert">
          Choices could not be loaded. Try searching again.
        </p>
      )}
      {open && !error && query && !rows.length && (
        <p className="field-hint">No matches.</p>
      )}
      {query && !value && !open && (
        <p className="field-error">
          Choose a department or external contact from the list.
        </p>
      )}
    </div>
  );
}
