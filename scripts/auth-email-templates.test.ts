import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const root=new URL('../supabase/templates/',import.meta.url)
const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'))
describe('branded auth templates',()=>{
 it('keeps authentication links intact and uses email-compatible branding',()=>{
  for(const [type,entry] of Object.entries(manifest.templates) as [string,{file:string;subject:string}][]){
   const html=readFileSync(new URL(entry.file,root),'utf8')
   expect(html).toContain('#102a43');expect(html).toContain('#2f80ed');expect(html).toContain('max-width:600px');expect(html).toContain('role="presentation"')
   expect(html).not.toMatch(/<script|<iframe|<form|tracking|utm_/i)
   if(type==='reauthentication')expect(html).toContain('{{ .Token }}')
   else if(type.endsWith('_notification'))expect(html).toContain('href="https://vimbre.vercel.app/login"')
   else expect(html).toContain('href="{{ .ConfirmationURL }}"')
  }
 })
 it('uses the same invitation context for new-user and returning-user emails',()=>{
  for(const type of ['confirmation','magic_link','invite']){
   const html=readFileSync(new URL(manifest.templates[type].file,root),'utf8')
   for(const field of ['invitation_company_name','invitation_inviter_name','invitation_role_label'])expect(html).toContain(`.Data.${field} | html`)
   expect(html).toContain('Confirm and join team')
  }
  expect(manifest.templates.recovery.subject).toContain('Reset your password')
  expect(readFileSync(new URL('recovery.html',root),'utf8')).not.toContain('invitation_email_purpose')
 })
})
