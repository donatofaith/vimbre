import {createClient} from '@supabase/supabase-js'
import {pushHandler} from './handler.ts'
const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10000)})}})
Deno.serve(pushHandler({fetch,async claim(hash){const r=await client.rpc('myday_push_claim',{p_token_hash:hash});if(r.error)throw Error('Denied');return r.data},async rpc(action,id=null,data={}){const r=await client.rpc('myday_delivery',{p_action:action,p_id:id,p_data:data});if(r.error)throw Error('Delivery unavailable');return r.data}}))
