import {TaskCard} from '../my-day/TaskCard'
import type {Task} from '../my-day/types'
import '../my-day/my-day.css'
import type { RefObject } from 'react'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { Card } from '../../components/ui/Card'
import { WorkspaceIcon } from '../../components/ui/WorkspaceIcon'
import { storySummary } from './landing-content'

const previewNow=new Date('2026-11-09T12:00:00Z')
const noChange=()=>{}
export function DraftActions() {
 const rows=[['Share the review notes','Alex','2026-11-12'],['Schedule the monthly supplier review','Sam','2026-11-16'],['Update the supplier review agenda','Alex','2026-11-20']]
 return <ul className="rs-demo-action-list">{rows.map(([title,owner,date],index)=>{
  const task:Task={id:`example-${index}`,title,details:'',due_date:date,due_time:null,due_at:date+'T09:00:00Z',remind_at:'',status:'open',source_kind:'manual',source_url:null,completion_note:'',completed_at:null,deleted_at:null,department_id:null,external_contact_id:null,reminder_option:'at_time',context_added_at:null,context_kind:null,context_record_id:null}
  return <li className="rs-demo-action-row rs-demo-product-row" key={title} data-draft-row><TaskCard task={task} zone="Europe/London" now={previewNow} busy act={noChange} edit={noChange} remind={noChange} context={noChange} quickContext={noChange} record={noChange} drag={noChange} inspect={noChange}/><small>Owner: {owner}</small></li>
 })}</ul>
}

/** An illustrative, isolated preview. It never reads an inbox or submits app data. */
export function HeroStory({ rootRef, paused, ready, toggle }: {
  rootRef: RefObject<HTMLDivElement | null>
  paused: boolean
  ready: boolean
  toggle: () => void
}) {
 return <div className="rs-hero-visual"><div ref={rootRef} className="rs-story-shell rs-signature">
  <div className="rs-story-stage" aria-hidden="true" inert><div className="rs-demo-window">
   <div className="rs-demo-bar"><BrandLogo/><small className="rs-example">Example</small></div>
   <div className="rs-demo-layout"><div className="rs-demo-sidebar">{[['home','My day'],['capture','Capture'],['record','My role']].map(([icon,label])=><span key={label}><WorkspaceIcon name={icon}/>{label}</span>)}</div>
    <div className="rs-demo-viewport rs-signature-viewport">
     <div className="rs-demo-scene" data-scene="email"><p className="rs-demo-page-label">Bring it in</p><Card className="rs-demo-email"><span className="rs-demo-overline"><WorkspaceIcon name="email"/>Monthly supplier reviews · 6 replies</span><h3>Re: Changing supplier reviews</h3><p><strong>Alex:</strong> Could we move supplier reviews to monthly?</p><p className="rs-demo-quoted">Earlier reply: weekly reviews take too much time.</p><p><strong>Sam:</strong> Yes. I will schedule the first review for <mark>16 Nov 2026</mark>.</p><p><strong>Alex:</strong> I will share the notes by <mark>12 Nov 2026</mark> and update the agenda by <mark>20 Nov 2026</mark>.</p></Card></div>
     <div className="rs-signature-paper" data-signature-paper/>
     <div className="rs-signature-label" data-scene="draft"><span className="rf-screen-kicker">Vimbre AI drafts</span><h3>Three actions to review</h3></div>
     <div className="rs-signature-label" data-scene="cover"><span className="rf-screen-kicker">Operations handover</span><h3>What comes first</h3></div>
     <div className="rs-signature-actions"><DraftActions/></div>
     <div className="rs-check-stamp" data-scene="confirmed"><WorkspaceIcon name="tick"/><strong>Check before saving</strong></div>
    </div>
   </div>
  </div></div>
  <p className="sr-only">{storySummary}</p><button className="rs-story-control" type="button" disabled={!ready} aria-label={paused?'Play hero story':'Pause hero story'} onClick={toggle}><svg viewBox="0 0 24 24" aria-hidden="true">{paused?<path d="m9 5 10 7-10 7z"/>:<path d="M8 5v14M16 5v14"/>}</svg>{paused?'Play':'Pause'}</button>
 </div></div>
}
