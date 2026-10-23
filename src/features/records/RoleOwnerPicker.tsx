import { useId, useRef, useState } from 'react'
import { WorkspaceIcon } from '../../components/ui/WorkspaceIcon'
export type RoleOwner = { id: string; full_name: string; department_id: string | null; role_description: string; role_start_date: string | null }
export function RoleOwnerPicker({ name, rows, query, search, choose, error, disabled }: { name: string; rows: RoleOwner[]; query: string; search: (text: string) => void; choose: (row: RoleOwner) => void; error: boolean; disabled: boolean }) {
  const [open, setOpen] = useState(false), [active, setActive] = useState(-1)
  const id = useId(), trigger = useRef<HTMLButtonElement>(null)
  function select(row: RoleOwner) { choose(row); setOpen(false); setActive(-1); trigger.current?.focus() }
  return <div className="vr-owner-picker" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus() } }}>
    <button ref={trigger} type="button" className="button button-secondary" aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? id : undefined} disabled={disabled} onClick={() => { setOpen(value => !value); search(''); setActive(-1) }}>Viewing: {name}<WorkspaceIcon name="people" /></button>
    {open && <div className="vr-owner-popover"><label htmlFor={`${id}-search`}>Search team members</label><input id={`${id}-search`} autoFocus value={query} placeholder="Search by name" role="combobox" aria-expanded={open} aria-controls={id} aria-autocomplete="list" aria-activedescendant={active >= 0 && active < rows.length ? `${id}-${active}` : undefined} onChange={event => { search(event.target.value); setActive(-1) }} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(value => event.key === 'ArrowDown' ? Math.min(value + 1, rows.length - 1) : Math.max(value - 1, 0)) } if (event.key === 'Enter' && rows[active]) { event.preventDefault(); select(rows[active]) } }} />
      <ul id={id} role="listbox" aria-label="Team members">{rows.map((row, index) => <li key={row.id} role="presentation"><button type="button" id={`${id}-${index}`} role="option" aria-selected={index === active} onClick={() => select(row)}>{row.full_name}</button></li>)}</ul>
      {error ? <p role="alert">Team choices could not be loaded. Try searching again.</p> : !rows.length && <p role="status">No matching team members.</p>}
    </div>}
  </div>
}
