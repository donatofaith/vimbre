import {it,expect} from 'vitest'
import {billingReturnPath} from './return-path'
it('preserves only a known plan across authentication',()=>{expect(billingReturnPath('?plan=growth')).toBe('/app/billing?plan=growth');expect(billingReturnPath('?plan=https://evil.invalid')).toBe('/app');expect(billingReturnPath('?plan=enterprise','/app?task=safe')).toBe('/app?task=safe')})

import {billingSignupCallback} from './return-path'
it('new signup confirms into billing and preserves its selected plan',()=>{expect(billingSignupCallback('https://vimbre.com','?plan=growth')).toBe('https://vimbre.com/auth/callback?flow=signup&plan=growth');expect(billingReturnPath('?flow=signup')).toBe('/app/billing');expect(billingReturnPath('?flow=signup&plan=growth')).toBe('/app/billing?plan=growth')})
