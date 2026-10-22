import { describe,it,expect,vi } from 'vitest'
import { mailHandler } from '../supabase/functions/my-day-mail/handler'
import { reminderMail } from '../supabase/functions/my-day-mail/template'
const batch={batch:'batch',email:'fixture@example.invalid',name:'Alex <admin>',items:[{task_id:'1',title:'Share <notes> & report',phase:'due' as const,due_at:'2026-10-22T09:00:00Z'}]}
const req=()=>new Request('https://example.invalid',{method:'POST',headers:{Authorization:`Bearer ${'a'.repeat(64)}`}})
describe('task email delivery',()=>{
 it('escapes untrusted names and titles and uses safe signed in app links',()=>{const mail=reminderMail(batch);expect(mail.htmlContent).toContain('&lt;notes&gt; &amp; report');expect(mail.htmlContent).not.toContain('<notes>');expect(mail.htmlContent).toContain('https://vimbre.com/app?task=1&task_action=done');expect(mail.subject).toBe('Due now: Share <notes> & report')})
 it('groups reminders for one recipient',()=>{expect(reminderMail({...batch,items:[...batch.items,...batch.items]}).subject).toBe('2 task reminders from Vimbre')})
 it('never claims a batch without credentials or bearer authentication',async()=>{const claim=vi.fn();const handler=mailHandler({configured:false,claim,finish:vi.fn(),send:vi.fn()});expect((await handler(req())).status).toBe(503);expect(claim).not.toHaveBeenCalled();expect((await handler(new Request('https://example.invalid',{method:'POST'}))).status).toBe(401)})
 it('does not retry an ambiguous send',async()=>{const send=vi.fn().mockRejectedValue(new Error('timeout')),finish=vi.fn();const handler=mailHandler({configured:true,claim:async()=>batch,finish,send});expect((await handler(req())).status).toBe(503);expect(send).toHaveBeenCalledTimes(1);expect(finish).toHaveBeenCalledWith('batch','uncertain')})
 it('marks confirmed success and explicit rejections separately',async()=>{for(const code of [201,400]){const finish=vi.fn();await mailHandler({configured:true,claim:async()=>batch,finish,send:async()=>new Response('',{status:code})})(req());expect(finish).toHaveBeenCalledWith('batch',code===201?'sent':'failed')}})
})
