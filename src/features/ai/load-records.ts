import { supabase } from '../../lib/supabase'
/** Fetch only confirmed own work through existing RLS. No Capture sources, drafts or personal notes. */
export async function loadOwnRecords(userId: string, companyId: string): Promise<string> {
  const [items, decisions, tasks] = await Promise.all([
    supabase.from('role_items').select('kind,title,details,due_date,recurrence,work_status,next_step,organisation,contact_details,contact_context').eq('owner_id', userId).eq('company_id', companyId).is('deleted_at', null).order('created_at', { ascending: false }).limit(100),
    supabase.from('decisions').select('title,reason,decided_on,decided_by,next_step').eq('owner_id', userId).eq('company_id', companyId).is('deleted_at', null).eq('status', 'live').order('decided_on', { ascending: false }).limit(100),
    supabase.from('actions').select('title,status,due_date,completed_at').eq('owner_id', userId).eq('company_id', companyId).is('deleted_at', null).order('created_at', { ascending: false }).limit(100),
  ])
  if (items.error || decisions.error || tasks.error) throw new Error('Records unavailable')
  const fields: Record<string, string> = {kind:'Category',title:'Title',details:'Details',due_date:'Due date',recurrence:'Repeats',work_status:'Status',next_step:'Next step',organisation:'Organisation',contact_details:'Contact',contact_context:'Contact notes',reason:'Why',decided_on:'Decision date',decided_by:'Owner',status:'Status',completed_at:'Completed'}
  const section = (title: string, rows: object[]) => `${title}\n${rows.length ? rows.map(row => Object.entries(row).filter(([,value]) => value !== null && value !== '').map(([key,value]) => `${fields[key] ?? key}: ${String(value)}`).join('\n')).join('\n\n') : 'No records.'}`
  return [`Prepared: ${new Date().toISOString()}`, 'Includes up to 100 latest records per category. For a weekly summary, use dated work from the last seven days; treat other records as current context.', section('Role records', items.data ?? []), section('Decisions', decisions.data ?? []), section('Tasks', tasks.data ?? [])].join('\n\n')
}
