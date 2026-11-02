import {Link} from 'react-router-dom'
import {HandoverMeta,HandoverSections} from './HandoverBriefing'
import {emptySections} from './model'
import type {Handover} from './model'
import './handover-example.css'

const example:Handover={
 id:'example',owner_id:'example-owner',created_by:'example-owner',role_id:null,cover_id:'example-cover',reviewer_id:'example-reviewer',
 owner_name:'Alex Morgan',cover_name:'Sam Taylor',reviewer_name:'Jordan Ellis',title:'Operations handover',body:'',
 starts_on:'2026-11-09',ends_on:'2026-11-23',handover_type:'leave',status:'approved',display_status:'approved',version:1,
 changed_since_approval:false,approved_at:'2026-11-06T15:00:00Z',review_comment:'',inclusions:[],
 sections:{...emptySections(),
 summary:'Sam is covering supplier deliveries, invoice checks and the November client launch while Alex is on leave. The launch delivery and invoice deadline come first.',
 priorities:'1. Confirm the launch delivery by 10 Nov, 12:00. The client launch on 12 Nov depends on this shipment. If the supplier cannot confirm, contact Jordan the same day.\n\n2. Check the supplier invoice by 11 Nov. Match it against the purchase order before Finance processes payment.\n\n3. Share the weekly operations update on 13 Nov. Include delivery changes, outstanding invoices and any decision needed from Jordan.',
 work:'Client launch — delivery arrangements are in progress. The order is placed; the delivery slot still needs written confirmation.\n\nSupplier accounts — check new invoices against approved orders and update the supplier tracker. Finance makes the payments.\n\nWeekly operations update — send progress, blockers and upcoming dates to the team each Friday.',
 tasks:'Confirm launch delivery — In progress · Due 10 Nov, 12:00\nCheck November supplier invoice — To do · Due 11 Nov\nSend weekly operations update — To do · Due 13 Nov, 15:00',
 decisions:'Keep the current supplier for the client launch. Jordan approved this on 6 Nov because a replacement would miss the launch date. Do not change the supplier without Jordan’s approval.\n\nSupplier reviews move to monthly. The weekly tracker remains in use for delivery issues and invoice checks.',
 contacts:'Jordan Ellis · Operations manager — delivery delays, supplier changes and spending approval.\nCasey Patel · Finance — invoice discrepancies and payment status.\nMorgan Reed · Supplier account contact — delivery slot and order confirmation.',
 documents:'Supplier tracker — Operations / Procurement / November\nApproved purchase order — Operations / Client launch / PO-1042\nWeekly update template — Operations / Team updates',
 dates:'10 Nov, 12:00 — supplier delivery confirmation\n11 Nov, 16:00 — invoice checks complete\n12 Nov, 09:00 — client launch delivery\n13 Nov and 20 Nov, 15:00 — weekly operations update\n23 Nov — Alex returns',
 watch_outs:'The invoice total must match PO-1042. Hold any mismatch for Finance; do not authorise the difference.\n\nThe launch venue accepts deliveries from 08:00 to 10:00 only. Ask the supplier for a named driver and confirmed arrival time.\n\nIf the delivery date changes, tell Jordan before updating the client.',
 notes:'The supplier confirmed stock availability on 6 Nov. Written delivery confirmation is still outstanding. Record any new commitments in the supplier tracker so Alex can pick them up on return.',
 },
 items:[{id:'sample-delivery',kind:'task',title:'Confirm launch delivery',status:'in_progress',approved:true,do_not_change:false},{id:'sample-invoice',kind:'task',title:'Check November supplier invoice',status:'open',approved:true,do_not_change:false},{id:'sample-decision',kind:'decision',title:'Keep the current supplier for the client launch',approved:true,do_not_change:true}],
}
export function HandoverExample(){
 return <div className="ho-wizard ho-example"><Link to="/app/handovers">← Handovers</Link><div className="ho-example-label"><span className="ho-chip">Example handover</span><Link className="button button-primary"to="/app/handovers/start?new=1">Start handover</Link></div><article className="ho-detail"><header><span className="ho-chip">Approved</span><h1>{example.title}</h1></header><HandoverMeta handover={example}/><HandoverSections handover={example}/><section><h3>Included records</h3>{example.items.map(item=><p key={item.id}>{item.title}{item.do_not_change?' · Do not change':item.status==='in_progress'?' · In progress':' · To do'}</p>)}</section></article></div>
}
