import {createClient} from '@supabase/supabase-js'
export const supabase=createClient('https://demo.invalid','demo-public-placeholder',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async()=>{throw new Error('Demo workspace is offline')}}})
