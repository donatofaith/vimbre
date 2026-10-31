export type CaptureSource={source_provider?:string;source_reference?:string;sender?:string;result_state?:string;tasks?:number;decisions?:number;id:string;title:string;source_text:string;source_date:string;source_type:string;deleted_at:string|null;trashed_at?:string|null;channel:string;status:string;items_created?:number;draft_attempts:number;error?:string|null;record_id?:string|null;department_id?:string|null;file_reference?:string|null}
export type CaptureDraft={origin?:string;id:string;kind:string;status:string;version:number;payload:Record<string,string|null>;action_id?:string|null;assignment_id?:string|null;decision_id?:string|null;summary_id?:string|null}
export type CaptureDetail={job?:{state:string;error?:string|null}|null;source:CaptureSource;items:CaptureDraft[]}
export type Choice={id:string;title:string}
export type CaptureOptions={today:string;remaining:number;ai_enabled:boolean;forwarding:boolean;upload:boolean;address:string|null;records:Choice[];departments:Choice[];contacts:Choice[]}
export const draftLabels:Record<string,string>={decision:'Decision',action:'Task',summary:'Conversation summary',contact:'External contact'}
export const statusLabels:Record<string,string>={received:'Needs review',needs_review:'Needs review',drafts_ready:'Needs review',saved:'Saved',archived:'Archived',deleted:'Deleted',failed:'Could not read',could_not_read:'Could not read',no_actions:'No actions found'}

