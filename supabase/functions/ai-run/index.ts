import { createClient } from '@supabase/supabase-js'
import { createGateway } from './gateway.ts'
import { providerAdapter } from './adapters/index.ts'
import type { Attempt, Reservation } from './types.ts'
const secret = (name: string) => Deno.env.get(name)
// Bound database/Auth I/O separately from the 30-second provider deadline.
const boundedFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10000) })
Deno.serve(createGateway({
  async identify(token) {
    const caller=createClient(secret('SUPABASE_URL')??'',secret('SUPABASE_ANON_KEY')??'',{global:{headers:{Authorization:`Bearer ${token}`},fetch:boundedFetch},auth:{persistSession:false,autoRefreshToken:false}})
    const {data,error}=await caller.auth.getUser(token)
    if(error||!data.user?.email_confirmed_at||data.user.is_anonymous)return null
    const {data:profile,error:failure}=await caller.from('profiles').select('id,company_id,active').eq('id',data.user.id).single()
    return failure||!profile?.active?null:{userId:profile.id,companyId:profile.company_id}
  },
  async begin(userId,requestId,task,fingerprint): Promise<Reservation> {
    const service=createClient(secret('SUPABASE_URL')??'',secret('SUPABASE_SERVICE_ROLE_KEY')??'',{global:{fetch:boundedFetch},auth:{persistSession:false,autoRefreshToken:false}})
    const {data,error}=await service.rpc('ai_gateway_begin',{p_user:userId,p_request:requestId,p_task:task,p_fingerprint:fingerprint})
    if(error)throw new Error('AI configuration unavailable')
    return data as Reservation
  },
  async finish(usageId: string,attempts: Attempt[]) {
    const service=createClient(secret('SUPABASE_URL')??'',secret('SUPABASE_SERVICE_ROLE_KEY')??'',{global:{fetch:boundedFetch},auth:{persistSession:false,autoRefreshToken:false}})
    const {error}=await service.rpc('ai_gateway_finish',{p_usage:usageId,p_attempts:attempts})
    if(error)throw new Error('AI usage could not be recorded')
  },
  adapter(provider) {return providerAdapter(provider,secret)},
}))
