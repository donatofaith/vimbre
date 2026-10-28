import {it,expect} from 'vitest'
import {billingReturnPath} from './return-path'
it('preserves only a known plan across authentication',()=>{expect(billingReturnPath('?plan=growth')).toBe('/app/billing?plan=growth');expect(billingReturnPath('?plan=https://evil.invalid')).toBe('/app');expect(billingReturnPath('?plan=enterprise','/app?task=safe')).toBe('/app?task=safe')})
