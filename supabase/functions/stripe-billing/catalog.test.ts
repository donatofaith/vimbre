import {describe,it,expect} from 'vitest'
import {plans,planForPrice,remainingTrial,subscriptionAccess,TRIAL_DAYS} from './catalog'
describe('sandbox billing policy',()=>{
 it('uses the client approved three-day trial without restarting it',()=>{const start=Date.parse('2026-10-28T10:00:00Z');const end=new Date(start+TRIAL_DAYS*86400000).toISOString();expect(remainingTrial(end,start)).toBe(start/1000+3*86400);expect(remainingTrial(end,start+86400000)).toBeUndefined();expect(remainingTrial(end,start+4*86400000)).toBeUndefined()})
 it('only maps approved sandbox company bundles',()=>{expect(Object.values(plans).map(p=>p.amount)).toEqual([2900,9900,24900]);expect(planForPrice(plans.growth.price)).toBe('growth');expect(planForPrice('price_untrusted')).toBeUndefined()})
 it('never grants paid access for failed, pending, expired or paused states',()=>{for(const status of ['past_due','unpaid','incomplete','paused','canceled'])expect(subscriptionAccess(status,200,200,100)).toBe(false);expect(subscriptionAccess('active',null,200,100)).toBe(true);expect(subscriptionAccess('active',null,90,100)).toBe(false);expect(subscriptionAccess('trialing',90,200,100)).toBe(false)})
})
