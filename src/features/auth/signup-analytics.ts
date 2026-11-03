import {supabase} from '../../lib/supabase'
import {analyticsConsent,trackAccountCreated} from '../../lib/analytics'
const pending=new Set<string>()
/** Only new, confirmed registrations have a server claim; refresh and login cannot mint one. */
export async function trackVerifiedSignup(user:{id:string;identities?:unknown[];email_confirmed_at?:string;user_metadata?:Record<string,unknown>}){
 if(!user.email_confirmed_at||analyticsConsent()!=='accepted'||pending.has(user.id))return
 pending.add(user.id)
 try{const r=await supabase.rpc('claim_signup_analytics');if(!r.error&&r.data===true)trackAccountCreated({...user,identities:[{}]})}catch{/* Account entry never depends on analytics. */}finally{pending.delete(user.id)}
}

/** The single-use receipt is issued by Auth on INSERT; it cannot authorize any account access. */
export async function trackNewSignup(user:{id:string;identities?:unknown[];app_metadata?:Record<string,unknown>;user_metadata?:Record<string,unknown>}|null){
 const receipt=user?.app_metadata?.vimbre_signup_receipt
 if(!user?.identities?.length||typeof receipt!=='string'||analyticsConsent()!=='accepted'||pending.has(user.id))return
 pending.add(user.id)
 try{const r=await supabase.rpc('claim_signup_analytics',{p_receipt:receipt});if(!r.error&&r.data===true)trackAccountCreated(user)}catch{/* A failed analytics request cannot interrupt signup. */}finally{pending.delete(user.id)}
}
