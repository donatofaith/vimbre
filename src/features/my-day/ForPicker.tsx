import { useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { safeSearch } from '../team/team-utils'
import type { ForOption } from './types'
export function ForPicker({value,onChange,filter=false,suggestion=''}:{value:ForOption|null;onChange:(v:ForOption|null)=>void;filter?:boolean;suggestion?:string}){
 const {profile,company}=useAuth(),id=useId(),input=useRef<HTMLInputElement>(null);const [query,setQuery]=useState(value?.label??suggestion),[rows,setRows]=useState<ForOption[]>([]),[error,setError]=useState(false),[open,setOpen]=useState(false)
 useEffect(()=>{let alive=true;const timer=setTimeout(async()=>{
  const term=safeSearch(query.replace(/ \((Department|External contact)\)$/,''));const [deps,contacts]=await Promise.all([
   supabase.from('departments').select('id,name').eq('company_id',company!.id).is('archived_at',null).ilike('name',`%${term}%`).order('name').limit(20),
   supabase.from('role_items').select('id,title').eq('company_id',company!.id).eq('owner_id',profile!.id).eq('kind','external_contact').is('deleted_at',null).ilike('title',`%${term}%`).order('title').limit(20)])
  if(alive){setError(Boolean(deps.error||contacts.error));setRows([...(deps.data??[]).map(r=>({id:r.id,kind:'department' as const,name:r.name,label:`${r.name} (Department)`})),...(contacts.data??[]).map(r=>({id:r.id,kind:'contact' as const,name:r.title,label:`${r.title} (External contact)`}))])}
 },200);return()=>{alive=false;clearTimeout(timer)}},[query,profile,company])
 useEffect(()=>{input.current?.setCustomValidity(!filter&&query&&!value?'Choose a department or external contact from the list.':'')},[filter,query,value])
 return <div className="field md-for-picker" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false)}}><label htmlFor={id}>{filter?'Filter by':'For'}</label><input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} value={query} autoComplete="off" placeholder="Department or external contact" onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);onChange(null);setOpen(true)}} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);if(e.key==='ArrowDown'){e.preventDefault();document.getElementById(`${id}-options`)?.querySelector('button')?.focus()}}}/>
 {open&&<ul id={`${id}-options`} className="md-for-options"><li><button type="button" onClick={()=>{setQuery('');onChange(null);setOpen(false)}}>{filter?'All departments and external contacts':'No department or external contact'}</button></li>{rows.map(row=><li key={`${row.kind}:${row.id}`}><button type="button" onClick={()=>{setQuery(row.label);onChange(row);setOpen(false)}}>{row.label}</button></li>)}{error&&<li role="alert">Choices could not be loaded. Try searching again.</li>}{!error&&query&&!rows.length&&<li>No matches.</li>}</ul>}
 {query&&!value&&!open&&<p className="field-error">Choose a department or external contact from the list.</p>}
 </div>
}
