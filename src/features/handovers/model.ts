import {supabase} from '../../lib/supabase'
import {trackEvent, trackTaskCompleted} from '../../lib/analytics'
import type {Json} from '../../lib/database.types'
export const sectionLabels=[['summary','Summary'],['priorities','What comes first'],['work','My work'],['tasks','Open tasks'],['decisions','Decisions to keep'],['contacts','Contacts'],['documents','Documents'],['dates','Deadlines while away'],['watch_outs','Watch outs'],['notes','Notes']] as const
export type Section=typeof sectionLabels[number][0]
export type Handover={share_draft?:{email:string;expires:string;sections:string[];format?:string};title_renamed?:boolean;return_unknown?:boolean;wizard_step?:number;selected_records?:SourceRecord[];priority_order?:string[];note_for_manager?:string;updated_at?:string;deleted_at?:string|null;structured?:boolean;id:string;owner_id:string;created_by:string;role_id:string|null;cover_id:string|null;reviewer_id:string|null;owner_name:string;cover_name:string|null;reviewer_name:string|null;title:string;body:string;starts_on:string;ends_on:string;status:string;display_status:string;handover_type:'leave'|'exit'|'sudden';sections:Record<Section,string>&{reason?:string;return_summary?:string};inclusions:string[];items:{id:string;kind:'task'|'decision';title:string;status?:string;approved?:boolean;do_not_change:boolean;checked?:boolean}[];version:number;review_comment:string;changed_since_approval:boolean;approved_at:string|null}
export type Person={id:string;name:string;reviewer:boolean;role?:string;department?:string;photo?:string}
export type Options={role:{id:string;holder_id:string;title:string;manager_id:string|null;cover_id:string|null};people:Person[];today?:string;readiness?:{done:number;total:number;left:number;review_days:number};policy?:HandoverPolicy;records?:SourceRecord[];notes?:SourceRecord[];templates?:{id:string;name:string}[];last_handover?:string|null;roles:{id:string;owner:string;title:string;name:string}[];tasks:{id:string;title:string;due_date:string;priority?:string}[];decisions:{id:string;title:string;reviewed_at?:string;do_not_change?:boolean}[]}
export async function handoverRpc(operation:string,id:string|null=null,data:Json={}){const r=await supabase.rpc('handover_workspace',{p_operation:operation,p_id:id,p_data:data});if(r.error)throw Error(r.error.code==='40001'?'This handover changed in another session. Reload before saving.':r.error.code==='42501'?'This handover is unavailable for your account.':['22007','22008','22P02'].includes(r.error.code)?'Check the dates and selected people. Your entries are still here.':r.error.code==='23514'&&!/^(Choose|Set|Dates|This)/.test(r.error.message)?'Check the title, dates and selected records. Your entries are still here.':r.error.message||'Could not save the handover. Your entries are still here.');const saved=r.data as unknown as Handover|null;if(operation==='save'&&saved?.id===id&&saved.version===1)trackEvent('handover_created',{source_type:'manual',context_type:saved.handover_type},saved.id);if(operation==='cover_task'&&data&&typeof data==='object'&&!Array.isArray(data))trackTaskCompleted(data.task,'cover');return r.data}
export const typeNames={leave:'Going on leave',exit:'Leaving the company',sudden:'Someone is suddenly away'}
export const statusNames:Record<string,string>={draft:'Draft',submitted:'Submitted',changes_requested:'Changes requested',approved:'Approved',active:'Active',completed:'Completed',cancelled:'Cancelled',pending:'Submitted',declined:'Changes requested'}
export function emptySections(){return Object.fromEntries(sectionLabels.map(([key])=>[key,''])) as Record<Section,string>}
export function parseHandoverDraft(text:string){let value:unknown;try{value=JSON.parse(text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''))}catch{throw Error('The draft could not be read. Your entries are still here. Choose Write manually.')}if(!value||typeof value!=='object'||Array.isArray(value))throw Error('The draft could not be read. Choose Write manually.');const sections=emptySections();for(const [key] of sectionLabels){const val=(value as Record<string,unknown>)[key];if(typeof val==='string')sections[key]=val.slice(0,6000)}if(!Object.values(sections).some(Boolean))throw Error('No draft sections were returned. Choose Write manually.');return sections}

export type SourceRecord={confirmed?:boolean;id:string;title:string;group:string;reviewed_at?:string;do_not_change?:boolean}
export type HandoverPolicy={approval_required:boolean;allow_top_no_approval:boolean;approver_roles:string[];minimum_notice_days:number;external_sharing:boolean;link_expiry_days:number;cover_visibility:'approval'|'assignment';required_sections:string[];cover_capacity:number;admin?:boolean}


export type CoverDutyState='waiting'|'upcoming'|'active'|'ended'|'cancelled'
export type CoverDutyRow={
 id:string;title:string;owner_id:string;owner_name:string;role_id:string|null;role_title:string|null;
 cover_id:string;cover_name:string|null;reviewer_id:string|null;reviewer_name:string|null;
 starts_on:string|null;ends_on:string|null;return_unknown?:boolean;handover_type:Handover['handover_type'];
 status:string;display_status:string;cover_response:'pending'|'accepted'|'declined';cover_visibility:'approval'|'assignment';
 state:CoverDutyState;full_access:boolean;task_count:number;item_count:number;completed_count:number;
 next_task_title:string|null;next_task_due:string|null;updated_at:string;covering_people_count?:number;
 cover_capacity?:number;sudden?:boolean;
}
export type CoverDutyTask={
 id:string;title:string;status:string;due_date:string|null;due_at:string|null;due_time?:string|null;details?:string;
 steps?:string[];links?:string[];completion_note?:string;do_not_change?:boolean;approved?:boolean;
 source_not_shared?:boolean;source_is_manual?:boolean;handback_pending?:boolean;completed_by_cover?:boolean;
}
export type CoverDutyNote={id:string;note_type:'note'|'decision';title:string;body:string;author_name:string;created_at:string}
export type CoverDutyComment={id:string;author:string;author_id:string;body:string;created_at:string}
export type CoverDutyActivity={operation:string;actor:string;at:string}
export type CoverDutyBriefing={
 handover:CoverDutyRow&{sections:Record<string,string>;priority_order:string[];review_comment?:string;owner_returned?:boolean;cover_summary?:string};
 full_access:boolean;tasks:CoverDutyTask[];notes:CoverDutyNote[];comments:CoverDutyComment[];
 activity:CoverDutyActivity[];handbacks:{id:string;task_id:string;task_title:string;reason:string;status:string;created_at:string}[];
 counts?:{active:number;upcoming:number;past:number;waiting:number};
 team?:boolean;
}
export type CoverDutyAvailability={id:string;starts_on:string;ends_on:string;note:string}
export type CoverDutyPoolPerson={id:string;person_id:string;person_name:string;department_id:string|null;department_name:string|null;priority:number}

export async function coverDutyRpc<T=unknown>(operation:string,id:string|null=null,data:Json={}):Promise<T>{
 const r=await supabase.rpc('cover_duties_action',{p_operation:operation,p_id:id,p_data:data});
 if(r.error){
  const code=(r.error as {code?:string}).code;
  throw Error(code==='42501'?'This cover information is not available for your account.':code==='40001'?'This handover changed in another session. Reload before saving.':r.error.message||'Cover duties could not be updated. Your entries are still here.');
 }
 if(operation==='task_done'&&data&&typeof data==='object'&&!Array.isArray(data))trackTaskCompleted(data.task_id,'cover');
 return r.data as T;
}
