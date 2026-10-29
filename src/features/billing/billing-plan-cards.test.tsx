import {expect,it} from 'vitest'
import {renderToString} from 'react-dom/server'
import {BillingPlanCards} from './BillingPlanCards'
const render=(plan?:string)=>renderToString(<BillingPlanCards currentPlan={plan} members={2} busy="" ready existing={false} onOpen={()=>{}}/>);
it('marks complimentary Starter active and offers higher plan upgrades',()=>{const html=render('starter');expect(html).toMatch(/aria-label="Starter plan"[^]*?data-active|data-active="true" aria-label="Starter plan"/);expect(html.match(/Currently active/g)).toHaveLength(1);expect(html).toContain('Upgrade to Growth');expect(html).toContain('Upgrade to Business');expect(html).toContain('Free plan')})
it('marks Free active for a free company',()=>{const html=render('free');expect(html).toContain('data-active="true" aria-label="Free plan"');expect(html.match(/Currently active/g)).toHaveLength(1);expect(html).toContain('Upgrade to Starter')})
it('does not invent an active plan before status loads',()=>expect(render()).not.toContain('Currently active'))
