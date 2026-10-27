/** Bounded plain text only. Keep the original private source unchanged. */
export function prepareCaptureText(raw: string) {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  const kept: string[] = []
  for (const line of lines) {
    if (/^\s*From:\s/i.test(line)) { if(kept.some(l=>l.trim()))break;continue }
    if (!kept.some(l=>l.trim()) && /^\s*(?:To|Subject|Sent|Date|Cc):/i.test(line)) continue
    if (/^\s*(?:On .{3,200} wrote:|Sent from my\b|_{4,}|-{2,}\s*Original Message|CONFIDENTIAL(?:ITY)?(?: NOTICE)?\b|Disclaimer:|--\s*$)/i.test(line)) break
    if (/^\s*>/.test(line)) continue
    kept.push(line)
  }
  const value = kept.join('\n').trim()
  // Code point iteration avoids breaking UTF8 characters at the gateway byte cap.
  let result = '', bytes = 0
  for (const char of value) { const n = new TextEncoder().encode(char).length; if (bytes + n > 16000) break; result += char; bytes += n }
  return result
}
export type CaptureProposal = { kind: 'decision' | 'action' | 'summary' | 'contact'; payload: Record<string,string> }
export function parseCaptureOutput(raw: string, source=''): CaptureProposal[] {
  if (raw.length > 60000) throw new Error('Draft response is too long')
  const value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''))
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid drafts')
  const text = (v: unknown, max=5000) => { if(v == null) return ''; if(typeof v !== 'string' || v.length > max) throw new Error('Invalid field'); return v.trim() }
  const date = (v:unknown) => { const s=text(v,40); if(!s) return ''; const d=new Date(`${s}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:'' }
  const rows:CaptureProposal[]=[]
  for(const key of ['decisions','tasks','summaries','external_contacts'] as const) {
    const list = value[key] ?? (key==='summaries'||key==='external_contacts'?[]:null)
    if(!Array.isArray(list)||list.length>30)throw new Error('Invalid drafts')
    for(const r of list) {
      if(!r||typeof r!=='object'||Array.isArray(r))throw new Error('Invalid draft')
      if(key==='decisions')rows.push({kind:'decision',payload:{title:text(r.decision,200),reason:text(r.why),decided_by:text(r.owner,200),decided_on:date(r.date),next_step:text(r.next_step)}})
      if(key==='tasks')rows.push({kind:'action',payload:{title:text(r.title,200),details:text(r.details),due_date:date(r.due_date)}})
      if(key==='summaries')rows.push({kind:'summary',payload:{title:text(r.title,200),details:text(r.details)}})
      if(key==='external_contacts')rows.push({kind:'contact',payload:{title:text(r.name,200),details:[text(r.organisation,200),text(r.contact_details,400),text(r.context)].filter(Boolean).join('\n')}})
      const row=rows.at(-1)!;const excerpt=text(r.source_excerpt,2000);if(excerpt&&source.includes(excerpt))row.payload.source_excerpt=excerpt;row.payload.source_owner=text(r.owner,200)
    }
  }
  if(rows.length>60||rows.some(r=>!r.payload.title))throw new Error('Invalid drafts')
  const seen=new Set<string>();return rows.filter(row=>{const key=JSON.stringify([row.kind,row.payload.title.toLocaleLowerCase(),row.payload.due_date||row.payload.decided_on||'',(row.payload.source_owner||'').toLocaleLowerCase()]);if(seen.has(key))return false;seen.add(key);return true})
}

