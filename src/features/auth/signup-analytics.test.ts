import {beforeEach,expect,it,vi}from 'vitest'
const mocks=vi.hoisted(()=>({rpc:vi.fn(),consent:vi.fn(),track:vi.fn()}))
vi.mock('../../lib/supabase',()=>({supabase:{rpc:mocks.rpc}}))
vi.mock('../../lib/analytics',()=>({analyticsConsent:mocks.consent,trackAccountCreated:mocks.track}))
import {trackNewSignup,trackVerifiedSignup}from './signup-analytics'
beforeEach(()=>{vi.clearAllMocks();mocks.consent.mockReturnValue('accepted');mocks.rpc.mockResolvedValue({data:true,error:null})})
it('claims the server-issued receipt only after a new signup response',async()=>{const user={id:'new',identities:[{}],app_metadata:{vimbre_signup_receipt:'receipt'}};await trackNewSignup(user);expect(mocks.rpc).toHaveBeenCalledWith('claim_signup_analytics',{p_receipt:'receipt'});expect(mocks.track).toHaveBeenCalledWith(user)})
it('does not track failed, obfuscated or receiptless signup responses',async()=>{for(const user of [null,{id:'old',identities:[]},{id:'no-receipt',identities:[{}]}])await trackNewSignup(user);expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.track).not.toHaveBeenCalled()})
it('requires consent and a fresh server claim',async()=>{mocks.consent.mockReturnValue('declined');await trackNewSignup({id:'a',identities:[{}],app_metadata:{vimbre_signup_receipt:'receipt'}});expect(mocks.rpc).not.toHaveBeenCalled();mocks.consent.mockReturnValue('accepted');mocks.rpc.mockResolvedValue({data:false,error:null});await trackVerifiedSignup({id:'a',email_confirmed_at:'2026-11-03'});expect(mocks.track).not.toHaveBeenCalled()})
it('does not track when the claim fails or the account is unconfirmed',async()=>{await trackVerifiedSignup({id:'unconfirmed'});expect(mocks.rpc).not.toHaveBeenCalled();mocks.rpc.mockRejectedValue(Error('Unavailable'));await trackNewSignup({id:'a',identities:[{}],app_metadata:{vimbre_signup_receipt:'receipt'}});expect(mocks.track).not.toHaveBeenCalled()})
