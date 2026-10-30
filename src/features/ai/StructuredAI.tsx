import {trackContextGenerated} from '../../lib/analytics'
import { useId, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { runAI } from '../../lib/ai-gateway'
import type { AITask, AIDocument } from '../../lib/ai-gateway'
import { localDate } from '../records/record-utils'
import { parseStructured } from './structured-output'
import type { DraftKind, StructuredDraft } from './structured-output'
import { validateAIInput } from './ai-output'
import './ai.css'
export function StructuredAI({kind, choose, cached, onDrafts, loadRecords, referenceDate}: {kind:DraftKind; choose:(draft:StructuredDraft,file?:File,index?:number)=>void; loadRecords?:()=>Promise<string>; referenceDate?:string; cached?:StructuredDraft[]|null; onDrafts?:(rows:StructuredDraft[])=>void}) {
 const id=useId(), pending=useRef(false), reference=useRef<{key:string;id:string}|null>(null)
 const [source,setSource]=useState(''), [rows,setRows]=useState<StructuredDraft[]|null>(cached??null), [busy,setBusy]=useState(false), [error,setError]=useState(''), [limited,setLimited]=useState(false)
 const [file,setFile]=useState<File|null>(null)
 async function generate() {
  if(pending.current)return
  const invalid=validateAIInput(source || (file?'Describe the attached document.':''))
  if(invalid){setError(invalid);return}
  pending.current=true;setBusy(true);setError('');setLimited(false)
  try {
   let document:AIDocument|undefined
   let text=source
   if(file) {
    if(file.size>2097152)throw new Error('Choose a PDF or text file smaller than 2 MB.')
    if(file.name.toLowerCase().endsWith('.pdf')) {
     const bytes=new Uint8Array(await file.arrayBuffer())
     if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('Choose a valid PDF file.')
     let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192))
     document={media_type:'application/pdf',data:btoa(binary)}
     text=[source,`File name: ${file.name}`].filter(Boolean).join('\n')
    }else if(/\.(txt)$/i.test(file.name)){text=[source,await file.text()].filter(Boolean).join('\n')}
    else throw new Error('Choose a PDF or text file. Other files can still be uploaded when you save a document.')
   }
   text=`Reference date: ${referenceDate??localDate()}\n${text}`
   const sizeError=validateAIInput(text);if(sizeError)throw new Error(sizeError)
   const key=JSON.stringify([kind,text,document?.data]);if(reference.current?.key!==key)reference.current={key,id:crypto.randomUUID()}
   const response=await runAI((kind==='task'?'tasks_extract':`role_${kind}`) as AITask,text,reference.current!.id,document)
   if(!response.ok){setError(response.message);setLimited(response.code==='limit_reached');return}
   const drafts=parseStructured(response.text,kind);trackContextGenerated(kind==='task'?'tasks_extract':`role_${kind}`,response.request_id,document?'document':'text');setRows(drafts);onDrafts?.(drafts);reference.current=null
  }catch(reason){setError(reason instanceof Error?reason.message:'The draft could not be prepared. You can add it manually.')}
  finally{pending.current=false;setBusy(false)}
 }
 async function loadRoleContext(){if(!loadRecords||pending.current)return;pending.current=true;setBusy(true);setError('');try{const text=await loadRecords();const invalid=validateAIInput(text);if(invalid)throw new Error(invalid);setSource(text);setRows(null);reference.current=null}catch{setError('Your role records could not be loaded. Paste the notes you want to use.')}finally{pending.current=false;setBusy(false)}}
 return <section className="vai-panel" aria-label="Draft with Vimbre AI"><h2>Use Vimbre AI</h2>{loadRecords&&<Button variant="secondary" disabled={busy} onClick={()=>void loadRoleContext()}>Suggest tasks for my role</Button>}
  <div className="field"><label htmlFor={id}>{kind==='responsibility'?'Job title, job description or notes':kind==='task'?'Email or notes':'Email, notes or a short description'}</label><textarea id={id} rows={7} disabled={busy} value={source} onChange={event=>{setSource(event.target.value);setRows(null);reference.current=null}} /></div>
  {kind==='document'&&<div className="field"><label htmlFor={`${id}-file`}>PDF or text file</label><input id={`${id}-file`} disabled={busy} type="file" accept=".pdf,.txt" onChange={event=>{setFile(event.target.files?.[0]??null);setRows(null);reference.current=null}}/><p className="field-hint">Up to 2 MB. File content is sent to Vimbre AI when you generate a draft. Pasted links are not opened.</p></div>}
  <Button disabled={busy||(!source.trim()&&!file)} onClick={()=>void generate()}>{busy?'Preparing drafts…':'Generate drafts'}</Button>
  {error&&<p className="field-error" role="alert">{error}</p>}{limited&&<a href="mailto:support@vimbre.com?subject=Vimbre%20AI%20allowance">Contact support</a>}
  {rows&&<><p role="status">{rows.length?'Draft from Vimbre AI. Check before saving.':'No items found. Add more detail or add an item manually.'}</p><ul className="vai-proposals">{rows.map((row,index)=><li key={index}><h3>{row.title}</h3><p>{row.details||row.reason}</p>{kind==='task'&&<p className="field-hint">{[row.department_name,row.external_contact_name,row.due_date&&new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${row.due_date}T12:00:00Z`)),row.due_time].filter(Boolean).join(' · ')}</p>}<Button variant="secondary" onClick={()=>choose({...row},file??undefined,index)}>Review draft</Button></li>)}</ul></>}
 </section>
}
