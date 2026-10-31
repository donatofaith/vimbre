import {useEffect,useState} from 'react'
import {useAuth} from '../auth/AuthProvider'
import {supabase} from '../../lib/supabase'
import {Button} from '../../components/ui/Button'
import {workspaceStructureLabel} from './team-structure'
import type {WorkspaceStructure} from './team-structure'
export function CompanyStructure({field=false}:{field?:boolean}){
 const {company}=useAuth(),id=company?.id
 const [result,setResult]=useState<{company:string;value:WorkspaceStructure|null}|null>(null),[revision,setRevision]=useState(0)
 useEffect(()=>{if(!id)return;let live=true
  void supabase.rpc('company_workspace_structure').then(({data,error})=>{if(!live)return;const v=data as unknown as WorkspaceStructure|null;setResult({company:id,value:!error&&typeof v?.plan==='string'&&typeof v.team_mode==='string'?v:null})})
  const reload=()=>setRevision(v=>v+1)
  window.addEventListener('vimbre:ai-usage',reload)
  return()=>{live=false;window.removeEventListener('vimbre:ai-usage',reload)}
 },[id,revision,company?.updated_at])
 const current=result?.company===id?result:null
 if(current&&!current.value)return <p role="alert">Workspace plan could not be loaded. <Button variant="secondary" onClick={()=>setRevision(v=>v+1)}>Retry</Button></p>
 const label=current?.value?workspaceStructureLabel(current.value):'Loading workspace plan…'
 return field?<div className="field"><label htmlFor="team-mode">Team structure</label><input id="team-mode" value={label} readOnly/></div>:<p aria-label="Workspace plan and structure">{label}</p>
}
