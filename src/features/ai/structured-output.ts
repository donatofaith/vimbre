import { safeRecordUrl } from '../records/record-utils'
export type DraftKind = 'responsibility' | 'workstream' | 'external_contact' | 'document' | 'recurring_deadline' | 'decision' | 'task'
export type StructuredDraft = Record<string, string>
const fields: Record<DraftKind, Record<string, number>> = {
 responsibility:{title:200,details:5000,recurrence:200}, workstream:{title:200,details:5000,work_status:30,next_step:5000},
 external_contact:{title:200,organisation:200,details:5000,contact_details:400,contact_context:5000}, document:{title:200,details:5000,url:2048},
 recurring_deadline:{title:200,recurrence:200,due_date:10,details:5000}, decision:{title:300,reason:5000,decided_on:10,decided_by:200,next_step:5000,source_url:2048}, task:{title:300,details:5000,due_date:10},
}
export function parseStructured(raw: string, kind: DraftKind): StructuredDraft[] {
 const invalid = () => new Error('The draft could not be read. Try again or add it manually.')
 if(raw.length>60000) throw invalid()
 let data: unknown
 try {data=JSON.parse(raw.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```$/, ''))}catch{throw invalid()}
 if(!data || typeof data!=='object' || Array.isArray(data) || !('items' in data) || !Array.isArray(data.items) || data.items.length>12)throw invalid()
 return data.items.map((value:unknown)=>{
  if(!value || typeof value!=='object' || Array.isArray(value))throw invalid()
  const input=value as Record<string,unknown>, row:StructuredDraft={}
  for(const [key,max] of Object.entries(fields[kind])) {
   const text=input[key]??''; if(typeof text!=='string' || text.length>max)throw invalid()
   row[key]=text.trim()
   if(key==='due_date'||key==='decided_on') {const d=new Date(`${row[key]}T00:00:00Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(row[key]) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==row[key])row[key]=''}
   if(key==='url'||key==='source_url')row[key]=safeRecordUrl(row[key])??''
  }
  if(!row.title)throw invalid()
  if(kind==='workstream'&&!['in_progress','waiting','on_hold','done'].includes(row.work_status))row.work_status='in_progress'
  if(kind==='responsibility'&&!['Daily','Weekly','Monthly','As needed'].includes(row.recurrence))row.recurrence='As needed'
  return row
 })
}
