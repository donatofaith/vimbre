import {it,expect} from 'vitest'
import {deliverBillingTrials,trialMail} from './billing-worker'
const job={id:'fixture',email:'billing@example.invalid',name:'Owner',kind:'ending' as const,plan:'Starter',amount:29,trial_ends_at:'2026-10-31T12:00:00Z'}
it('explains the charge, date, frequency and how to cancel',()=>{const mail=trialMail(job);expect(mail.title).toContain('tomorrow');expect(mail.body).toContain('£29.00 per month');expect(mail.body).toContain('31 October 2026');expect(mail.body).toContain('https://vimbre.com/app/billing')})
it('does not blindly retry an uncertain email send',async()=>{const states:string[]=[];await deliverBillingTrials({rpc:async(op,_id,state)=>{if(op==='claim')return[job];states.push(state!);return{}},send:async()=>{throw Error('Timeout')}});expect(states).toEqual(['uncertain'])})
