export type RoleKind = 'responsibility'|'workstream'|'external_contact'|'document'|'recurring_deadline'|'decision'
export type RoleTab = 'handled'|'decision'|'external_contact'|'document'|'recurring_deadline'
export const roleTabs: [RoleTab,string,string][] = [
 ['handled','What I handle','List what you do, how often, and how to do it.'],
 ['decision','Decisions','What was decided, why, and what happens next.'],
 ['external_contact','External contacts','People outside the company who someone covering you may deal with.'],
 ['document','Documents','Where the important files live.'],
 ['recurring_deadline','Deadlines','Dates someone covering you must not miss.'],
]
export type RoleRow = {id:string;kind?:RoleKind;title:string;details?:string;reason?:string;decided_by?:string;decided_on?:string;due_date?:string;recurrence?:string;organisation?:string;contact_details?:string;contact_context?:string;url?:string;next_step?:string;source_url?:string;status?:string;deleted_at:string|null;reviewed_at:string|null;capture_id?:string;replaces_id?:string;replaced_by_id?:string;role_fields:Record<string,string>}
export type Field = [string,string,string?,boolean?]
export const fields:Record<RoleKind,Field[]> = {
 responsibility:[['details','What it involves','textarea'],['recurrence','How often','frequency'],['clients','Clients or projects'],['tools','Tools used'],['steps','Short steps','textarea']],
 workstream:[['details','What it involves','textarea'],['recurrence','How often','frequency'],['clients','Clients or projects'],['tools','Tools used'],['steps','Short steps','textarea']],
 decision:[['reason','Why','textarea',true],['decided_by','Decided by','text',true],['decided_on','Date','date',true],['effective_date','Effective date','date'],['applies_to','Applies to'],['next_step','What happens next','textarea'],['source_url','Link to the source','url'],['outcome','Outcome','textarea'],['review_date','Review date','date']],
 external_contact:[['organisation','Organisation'],['contact_role','Role'],['contact_details','Email or phone','text',true],['contact_context','What they care about','textarea'],['last_contacted','Last contacted','date'],['details','Notes','textarea']],
 document:[['url','Link','url',true],['tool','Which tool it is in'],['details','What it is for','textarea'],['last_checked','Last checked date','date']],
 recurring_deadline:[['due_date','Date','date',true],['recurrence','Repeat rule','repeat'],['details','What’s needed','textarea'],['reminder','Reminder','reminder']],
}
export const emptyCopy:Record<RoleTab,string> = {handled:'Nothing here yet. Add the work someone would need to pick up.',decision:'No decisions yet. Record one when something is agreed.',external_contact:'No external contacts yet.',document:'No documents yet.',recurring_deadline:'No deadlines yet.'}
export function rowFields(row:RoleRow):Record<string,string>{const result:Record<string,string>={};for(const [key,value] of Object.entries(row)){if(typeof value==='string')result[key]=value}return {...row.role_fields,...result}}
export function rowsFor(tab:RoleTab,items:RoleRow[],decisions:RoleRow[]){return tab==='decision'?decisions:items.filter(i=>tab==='handled'?i.kind==='responsibility'||i.kind==='workstream':i.kind===tab)}
export function areaReady(rows:RoleRow[],review?:{nothing_to_add:boolean;reviewed_at:string},now=Date.now()){const cutoff=now-90*86400000;return Boolean(review?.nothing_to_add&&Date.parse(review.reviewed_at)>=cutoff)||rows.some(r=>!r.deleted_at&&r.status!=='replaced'&&r.status!=='reversed'&&r.reviewed_at&&Date.parse(r.reviewed_at)>=cutoff)}
