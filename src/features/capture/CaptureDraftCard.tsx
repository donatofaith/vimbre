import {SegmentedControl} from '../../components/ui/SegmentedControl'
import {RoleDrawer} from '../records/RoleDrawer'
import {useEffect,useState} from 'react'
import type {FormEvent} from 'react'
import {supabase} from '../../lib/supabase'
import {useAuth} from '../auth/AuthProvider'
import {Input} from '../../components/ui/Input'
import {Button} from '../../components/ui/Button'
import type {CaptureDraft,CaptureOptions,Choice} from './capture-types'
import {draftLabels} from './capture-types'
export function ChoiceField({label,name,rows,value='',onChange}:{label:string;name:string;rows:Choice[];value?:string;onChange?:(v:string)=>void}) {
 return <label className="field vc-choice"><span>{label}</span><select aria-label={label} name={name} defaultValue={value} onChange={e=>onChange?.(e.target.value)}><option value="">None</option>{rows.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
}
export function CaptureDraftCard({draft,options,people,busy,accepted,duplicate,accept,discard,unaccept,cancel,sourceText='',sender='',sourceDate=''}:{draft?:CaptureDraft;options:CaptureOptions;people:Choice[];busy:boolean;accepted:boolean;duplicate:boolean;accept:(data:Record<string,string>)=>Promise<void>;discard:()=>void;unaccept?:()=>void;cancel?:()=>void;sourceText?:string;sender?:string;sourceDate?:string}) {
 const {profile}=useAuth()
 const [kind,setKind]=useState(draft?.kind??'action'),[editing,setEditing]=useState(!draft),[expanded,setExpanded]=useState(!draft),[error,setError]=useState('')
 const p=draft?.payload??{},v=(key:string)=>p[key]??''
 const [priority,setPriority]=useState(v('priority')||'normal')
 const [owner,setOwner]=useState(v('owner_id')||profile!.id),[choices,setChoices]=useState(options),[choiceError,setChoiceError]=useState(false)
 useEffect(()=>{if(owner===profile!.id)return;let alive=true;void supabase.rpc('capture_pipeline',{p_operation:'options',p_data:{owner_id:owner}}).then(({data,error})=>{if(alive){setChoiceError(Boolean(error));if(!error&&data&&typeof data==='object'&&'today' in data)setChoices(data as unknown as CaptureOptions)}});return()=>{alive=false}},[owner,profile])
 const activeChoices=owner===profile!.id?options:choices
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError('');const data=Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string,string>;try{await accept({...data,kind,owner_reviewed:'true'});setEditing(false)}catch{setError('This draft could not be updated. Your changes are still here.')}}
 const form=(<form onSubmit={e=>void submit(e)}><div className="vc-section-heading"><span className="vc-chip">{draftLabels[kind]}</span>{accepted&&<span className="vc-accepted">Accepted</span>}</div>
  {!v('source_owner')&&draft?.origin==='ai'&&v('owner_reviewed')!=='true'&&!accepted&&<span className="vc-missing">No owner</span>}
  {v('source_excerpt')&&sourceText.includes(v('source_excerpt'))&&<blockquote className="vc-source-quote"><mark>{v('source_excerpt')}</mark><footer>{[sender,sourceDate].filter(Boolean).join(' · ')}</footer></blockquote>}
  {kind==='action'&&!v('due_date')&&<span className="vc-missing">No date</span>}
  {duplicate&&<p className="vc-warning" role="status">A similar item already exists. Check it before confirming.</p>}
  {!editing?<><h3>{v('title')}</h3><p className="vc-note">Owner: {v('owner_id')===profile!.id?'Me':people.find(person=>person.id===v('owner_id'))?.title||'Choose owner'}{v('source_owner')&&v('source_owner')!==profile!.full_name?` · Mentioned: ${v('source_owner')}`:''}{kind==='action'?` · ${v('due_date')||'No date'} · ${({'at_time':'Reminder at due time','30_minutes':'Reminder 30 minutes before','1_hour':'Reminder 1 hour before','day_before':'Reminder the day before'} as Record<string,string>)[v('reminder_option')||'at_time']}`:''}</p><p className="vc-prewrap">{v(kind==='decision'?'reason':'details')}</p><div className="form-actions">{!accepted&&<Button variant="secondary" disabled={busy} onClick={()=>void accept({...Object.fromEntries(Object.entries(p).map(([k,value])=>[k,value||''])),kind,owner_reviewed:'true'}).catch(()=>setError('This draft could not be accepted. Try again.'))}>Accept</Button>}<Button variant="secondary" disabled={busy} onClick={()=>{setEditing(true);setExpanded(true)}}>Edit</Button><Button variant="secondary" disabled={busy} onClick={discard}>Dismiss</Button></div></>:<>
  <fieldset disabled={busy} className="vc-fields"><input type="hidden" name="source_excerpt" value={v('source_excerpt')}/><input type="hidden" name="source_owner" value={v('source_owner')}/>
   <div className="field"><span>Type</span><input type="hidden" name="type" value={kind}/><SegmentedControl label="Type" value={kind} onChange={setKind} options={[{value:'decision',label:'Decision'},{value:'action',label:'Task'},...(kind==='summary'?[{value:'summary',label:'Conversation summary'}]:[]),...(kind==='contact'?[{value:'contact',label:'External contact'}]:[])]}/></div>
   <Input label="Title" name="title" defaultValue={v('title')} placeholder="e.g. Share the supplier review notes" maxLength={200} required/>
   <label className="field"><span>{kind==='decision'?'Why':'Details'}</span><textarea aria-label={kind==='decision'?'Why':'Details'} name={kind==='decision'?'reason':'details'} defaultValue={v(kind==='decision'?'reason':'details')} required={kind==='decision'} rows={3} maxLength={5000}/></label>
   {kind==='decision'&&<><div className="form-grid"><Input label="Decision date" name="decided_on" type="date" defaultValue={v('decided_on')||options.today} required/><Input label="Who decided?" name="decided_by" defaultValue={v('decided_by')} maxLength={200}/></div><Input label="Next step" name="next_step" defaultValue={v('next_step')} maxLength={5000}/></>}
   <div className="form-grid"><label className="field"><span>Owner</span><select aria-label="Owner" name="owner_id" value={owner} onChange={e=>setOwner(e.target.value)}><option value={profile!.id}>Me</option>{people.filter(r=>r.id!==profile!.id).map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label><ChoiceField label="Record" name="record_id" key={'record:'+owner} rows={activeChoices.records} value={owner===(v('owner_id')||profile!.id)?v('record_id'):''}/></div>
   {kind==='action'&&<><div className="form-grid"><Input label="Due date" name="due_date" type="date" defaultValue={v('due_date')}/><Input label="Due time (optional)" name="due_time" type="time" defaultValue={v('due_time')}/></div><div className="form-grid"><div className="field"><span>Priority</span><input type="hidden" name="priority" value={priority}/><SegmentedControl label="Priority" value={priority} onChange={setPriority} options={[{value:'low',label:'Low'},{value:'normal',label:'Normal'},{value:'high',label:'High'}]}/></div><label className="field"><span>Reminder</span><select aria-label="Reminder" name="reminder_option" defaultValue={v('reminder_option')||'at_time'}><option value="at_time">At due time</option><option value="30_minutes">30 minutes before</option><option value="1_hour">1 hour before</option><option value="day_before">Day before</option></select></label></div></>}
   <div className="form-grid"><ChoiceField label="Department" name="department_id" rows={options.departments} value={v('department_id')}/><ChoiceField label="External contact" name="external_contact_id" key={'contact:'+owner} rows={activeChoices.contacts} value={owner===(v('owner_id')||profile!.id)?v('external_contact_id'):''}/></div>
   {kind==='contact'&&<><Input label="Contact email" name="contact_email" type="email" defaultValue={v('contact_email')}/><Input label="Contact phone" name="contact_phone" defaultValue={v('contact_phone')}/></>}
   {choiceError&&<p className="field-error" role="alert">This owner’s Records and contacts could not be loaded. Choose the owner again.</p>}{error&&<p className="field-error" role="alert">{error}</p>}
   <div className="form-actions"><Button type="submit" variant="secondary">Accept</Button><Button variant="secondary" onClick={discard}>Dismiss</Button>{cancel&&<Button variant="secondary" onClick={cancel}>Cancel</Button>}</div>
  </fieldset></>}
  </form>);
 return <li className="vc-review-card" data-accepted={accepted}>
  {draft&&<div className="vc-draft-row"><label className="vc-check-target"><input type="checkbox" checked={accepted} disabled={busy} aria-label={`Accept draft: ${v('title')}`} onChange={e=>{if(!e.target.checked){unaccept?.();return}void accept({...Object.fromEntries(Object.entries(p).map(([key,value])=>[key,value||''])),kind,owner_reviewed:'true'}).catch(()=>setError('This draft could not be accepted. Try again.'))}}/></label><button type="button" className="vc-draft-title" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}><strong>{v('title')}</strong><span>{v('owner_id')===profile!.id?'Me':people.find(person=>person.id===v('owner_id'))?.title||'Choose owner'} · {v('due_date')||'No date'}{kind==='action'&&<> · <span className="vc-priority-chip">{v('priority')||'normal'}</span></>}</span></button><button type="button" className="vc-draft-expand" aria-label={`${expanded?'Collapse':'Expand'} ${v('title')}`} aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'⌃':'⌄'}</button></div>}

 {editing?<RoleDrawer context="Capture" title={draft?'Edit draft':'Add draft'} close={()=>{if(draft)setEditing(false);else cancel?.()}}>{form}</RoleDrawer>:<div hidden={!expanded}>{form}</div>}
 {!expanded&&!editing&&error&&<p role="alert" className="field-error">{error}</p>}
 </li>
}
