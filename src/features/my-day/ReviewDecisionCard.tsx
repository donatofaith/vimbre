import {useState} from 'react'
import {Link} from 'react-router-dom'
import {Button} from '../../components/ui/Button'
import {daySuite,suiteError} from './suite-api'
import type {DayData} from './types'
type Draft=NonNullable<DayData['review_drafts']>[number]
export function ReviewDecisionCard({draft,disabled,refresh,approve,dismiss}:{draft:Draft;disabled:boolean;refresh:()=>void;approve:()=>Promise<void>;dismiss:()=>Promise<void>}){
 const [note,setNote]=useState(draft.payload.review_comment??''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const dirty=note!==(draft.payload.review_comment??'')
 async function run(action:()=>Promise<unknown>){if(busy||disabled)return;setBusy(true);setError('');try{await action();refresh()}catch(e){setError(suiteError(e))}finally{setBusy(false)}}
 return <article className="md-review-decision"><span className="md-review-type">Decision · Awaiting your review</span><h4>{draft.payload.title}</h4>{draft.payload.reason?<p><strong>Why:</strong> {draft.payload.reason}</p>:<p className="field-error">Add the reason in Capture before saving this decision.</p>}{draft.payload.next_step&&<p><strong>Next:</strong> {draft.payload.next_step}</p>}<form onSubmit={e=>{e.preventDefault();void run(()=>daySuite('review_note',draft.id,{version:draft.version,note}))}}><label className="field">Your review comment<textarea value={note} maxLength={4000} rows={2} disabled={busy||disabled} onChange={e=>setNote(e.target.value)}/></label><Button type="submit" variant="primary" disabled={busy||disabled||!dirty}>Save comment</Button></form>{draft.duplicate&&<p className="field-error">A matching item already exists. Review it in Capture.</p>}{error&&<p role="alert" className="field-error">{error}</p>}<div className="md-expanded-actions"><Button disabled={busy||disabled||dirty||draft.duplicate||!draft.payload.reason?.trim()} onClick={()=>void run(approve)}>Approve and record</Button><Link to={`/app/capture?capture=${draft.capture_id}`}>Review in Capture</Link><Button variant="secondary" disabled={busy||disabled} onClick={()=>void run(dismiss)}>Dismiss</Button></div></article>
}
