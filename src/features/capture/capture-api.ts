import {supabase} from '../../lib/supabase'
import {rememberIntegrationStart, trackTaskCreated} from '../../lib/analytics'
import type {CaptureDetail} from './capture-types'
import type {Json} from '../../lib/database.types'
export type ImportedSource={title:string;text:string;date:string;source_type:string;preview?:string;sender?:string;provider?:string}
export type Connection={id:string;provider:string;connected_at:string}
export type Tool={provider:string;name:string;configured:boolean;connection:Connection|null;setup_reason?:string;retired?:boolean}
export type SearchRow={id:string;reference:string;container:string;title:string;sender:string;preview:string;date:string;url:string;kind:'container'|'item';captured?:string|null;cache?:string}
export type SearchFilters={query:string;after:string;before:string;person:string;place:string;folder:string;mime:string;unread:boolean;attachment:boolean;likely:boolean;notCaptured:boolean}
export type ConnectionResult={document?:string;title?:string;ok?:boolean;code?:string;allowed?:string[];providers?:Tool[];rows?:SearchRow[];url?:string;state?:string;source?:ImportedSource;preview?:string;next?:string|null;cache?:string}
const errors:Record<string,string>={calendar_permission:'Approve calendar access in Settings, then try the plan again.',calendar_unavailable:'Calendar busy times could not be checked. Retry before planning.',setup_required:'This tool is not ready to connect. Paste the conversation instead.',access_denied:'Your company has not enabled this tool, or the account is unavailable.',sign_in:'Sign in again to manage your connections.',connection_busy:'This connection is busy. Try again in a moment.',reconnect:'Reconnect this account in Settings to continue.',search_expired:'These results have expired. Search again to refresh them.',rate_limited:'Too many requests. Wait a few minutes, then try again.',provider_busy:'This tool has asked us to wait. Try again shortly.',source_too_large:'This conversation is too long. Paste the relevant part instead.',source_empty:'No readable text was found. Paste the conversation instead.',unsupported_file:'This file cannot be previewed here. Download it and choose Upload.',unavailable:'The tool could not be reached. Your selection has been kept.'}
export async function connectionCall(body:Record<string,unknown>):Promise<ConnectionResult>{const r=await supabase.functions.invoke('capture-connect',{body,signal:AbortSignal.timeout(45000)});let value=r.data as ConnectionResult|null;if(r.error){try{value=await r.error.context?.clone().json()}catch{/* Never display provider payloads. */}}if(!value?.ok)throw new Error(errors[value?.code||'']||'The request could not be completed. Please retry.');if(body.action==='connect')rememberIntegrationStart(value.state,body.provider);return value}
export async function captureCall<T>(action:string,data:Json={},id:string|null=null):Promise<T>{const r=await supabase.rpc('capture_workspace',{p_action:action,p_id:id,p_data:data});if(r.error)throw r.error;return r.data as unknown as T}
export async function connectAccount(tool:Tool){const r=await connectionCall({action:'connect',provider:tool.provider});if(!r.url||!/^https:\/\/(login\.microsoftonline\.com|slack\.com|trello\.com|github\.com|api\.notion\.com|app\.asana\.com)\//.test(r.url)||!r.state||!/^[a-f0-9]{64}$/.test(r.state))throw new Error('This connection could not be started.');sessionStorage.setItem('vimbre:tool-connect-state',r.state);sessionStorage.setItem('vimbre:tool-connect-return','settings');window.location.assign(r.url)}
export async function confirmCapture(id:string,items:{id:string;version:number}[]) {
 const result=await supabase.rpc('capture_pipeline',{p_operation:'confirm',p_id:id,p_data:{items}});
 if(result.error)throw result.error;
 const detail=result.data as unknown as CaptureDetail;
 if(Array.isArray(detail?.items))for(const item of detail.items){
  if(items.some(selected=>selected.id===item.id)&&item.kind==='action'&&item.status==='confirmed'&&item.action_id)trackTaskCreated('capture-draft:'+item.id,'capture');
 }
 return detail;
}
