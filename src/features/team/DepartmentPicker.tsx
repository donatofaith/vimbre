import { useEffect, useId, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { safeSearch } from './team-utils'
type Option = { id: string; name: string }
export function DepartmentPicker({ initial, required = false, onChange }: { initial?: Option | null; required?: boolean; onChange?:(id:string)=>void }) {
  const id = useId()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(initial?.id ?? '')
  const [result, setResult] = useState<{ search: string; rows: Option[]; error: boolean } | null>(null)
  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase.from('departments').select('id,name').is('archived_at', null).ilike('name', `%${safeSearch(search)}%`).order('name').limit(20)
      if (!cancelled) setResult({ search, rows: data ?? [], error: Boolean(error) })
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [search])
  const rows = result?.rows ?? []
  const initialMissing = initial && !rows.some(row => row.id === initial.id)
  return <div className="field"><label htmlFor={id}>Department{required ? ' (required)' : ' (optional)'}</label><input id={`${id}-search`} type="search" aria-label="Search department choices" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search departments" /><select id={id} name="department_id" required={required} value={selected} onChange={event => {setSelected(event.target.value);onChange?.(event.target.value)}}><option value="">No department</option>{initialMissing && <option value={initial.id}>{initial.name}</option>}{rows.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select>{result?.error && <p role="alert">Departments could not be loaded. Try searching again.</p>}{result?.search === search && rows.length === 20 && <p className="muted">Type a more specific name to narrow the choices.</p>}</div>
}
