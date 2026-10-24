import { createClient } from '@supabase/supabase-js'
import { inboundHandler } from './handler.ts'
const secret=(name:string)=>Deno.env.get(name)
Deno.serve(inboundHandler(secret('CAPTURE_INBOUND_TOKEN'),async value=>{
 const service=createClient(secret('SUPABASE_URL')??'',secret('SUPABASE_SERVICE_ROLE_KEY')??'',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10000)})}})
 const {error}=await service.rpc('capture_receive_v2',{p_address:value.address,p_sender:value.sender,p_message_hash:value.messageHash,p_title:value.title,p_text:value.text,p_sent_date:value.sentDate??null})
 if(error)throw new Error('Receipt unavailable')
}))
