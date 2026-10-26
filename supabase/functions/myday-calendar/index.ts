import {createClient} from '@supabase/supabase-js'
import {createCalendarHandler} from './handler.ts'
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
Deno.serve(createCalendarHandler(async token=>{const {data,error}=await db.rpc('myday_calendar_feed',{p_token:token});if(error)throw Error('calendar_unavailable');return data}))
