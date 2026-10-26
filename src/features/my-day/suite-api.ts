import {supabase} from '../../lib/supabase'
import type {Json} from '../../lib/database.types'
export type DayPerson={id:string;name:string;role:string}
export type Assignment={id:string;title:string;details?:string;due_date:string|null;suggested_date:string|null;status:string;creator_name?:string;recipient_name?:string;recipient_task?:string;task_status?:string}
export type DayNotice={id:string;title:string;body:string;task_id:string|null;assignment_id:string|null;created_at:string}
export type SuiteOverview={briefing?:{body:string;created_at:string}|null;settings:Record<string,string|boolean>;flags:Record<string,boolean>;incoming:Assignment[];waiting:Assignment[];notifications:DayNotice[];away:{id:string;starts_on:string;status:string}[];calendar_enabled:boolean}
const reads=new Set(['overview','notifications','mention_people','templates','rules','people','comments','task_extra','team','ai_source','ai_cache_get'])
export async function daySuite<T=unknown>(operation:string,id:string|null=null,data:Record<string,unknown>={}):Promise<T>{
 if(!navigator.onLine)throw Error('This action needs a connection.');
 const result=await supabase.rpc('myday_suite',{p_operation:operation,p_id:id,p_data:data as Json}).abortSignal(AbortSignal.timeout(operation==='import'?30000:15000));if(result.error)throw result.error;
 if(!reads.has(operation))window.dispatchEvent(new Event('vimbre:work-changed'));
 return result.data as unknown as T
}
export function suiteError(error:unknown){const e=error as {code?:string;message?:string};if(e.message==='This action needs a connection.')return e.message;if(e.code==='42501')return 'This action is unavailable for your account or company settings.';if(e.message?.includes('once a day'))return 'You can nudge once a day.';if(e.message?.includes('Set a due date'))return 'Set a due date on an open task first.';return 'Your change could not be saved. Check the fields and try again.'}
export async function sourceHash(text:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('')}
