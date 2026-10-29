import {createContext,useContext,useEffect,useState} from 'react'
import type {ReactNode} from 'react'
import {Navigate,useLocation,useNavigate} from 'react-router-dom'
import {supabase} from '../../lib/supabase'
import {useAuth} from '../auth/AuthProvider'
import {Button} from '../../components/ui/Button'

type Access={plan:string;needs_choice:boolean;access_ends_at:string|null}
type State={data:Access|null;error:boolean;retry:()=>void;reload:()=>Promise<void>}
const Context=createContext<State|null>(null)
export function BillingAccessProvider({children}:{children:ReactNode}){
 const {profile,company}=useAuth(),location=useLocation()
 const companyId=company?.id
 const owner=Boolean(profile&&company?.created_by===profile.id)
 const [data,setData]=useState<{company:string;value:Access}|null>(null),[error,setError]=useState(false),[revision,setRevision]=useState(0)
 useEffect(()=>{if(!owner||!companyId||!navigator.onLine)return;let cancelled=false
  void supabase.rpc('billing_access',{p_operation:'status'}).then(({data:value,error:failure})=>{if(cancelled)return;if(failure){setError(true);return}setError(false);setData({company:companyId,value:value as unknown as Access})})
  return()=>{cancelled=true}
 },[owner,companyId,revision])
 const current=data?.company===company?.id?data?.value??null:null
 const atBilling=location.pathname==='/app/billing'
 if(owner&&navigator.onLine&&!atBilling){
  if(error)return <main className="standalone"><h1>Plans could not be loaded</h1><p>Please retry to open your workspace.</p><Button onClick={()=>{setError(false);setRevision(n=>n+1)}}>Retry</Button></main>
  if(!current)return <main className="standalone" role="status">Loading your plan…</main>
  if(current.needs_choice)return <Navigate to="/app/billing?flow=signup" replace/>
 }
 return <Context.Provider value={{data:current,error,retry:()=>{setError(false);setRevision(n=>n+1)},reload:async()=>{const r=await supabase.rpc('billing_access',{p_operation:'status'});if(r.error)throw r.error;if(company)setData({company:company.id,value:r.data as unknown as Access})}}}>{children}</Context.Provider>
}
export function FreeWorkspacePlan({section='plan'}:{section?:'plan'|'code'}){
 const state=useContext(Context),navigate=useNavigate()
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[code,setCode]=useState(''),[message,setMessage]=useState('')
 async function choose(operation:'choose_free'|'redeem'){
  setBusy(true);setError('');setMessage('')
  try{const r=await supabase.rpc('billing_access',{p_operation:operation,...(operation==='redeem'?{p_code:code.trim()}: {})});if(r.error)throw r.error;await state?.reload();window.dispatchEvent(new Event('vimbre:ai-usage'));if(operation==='choose_free')navigate('/app');else{setCode('');setMessage('Your company access is active.')}}
  catch{setError(operation==='redeem'?'This code could not be applied. Check that it belongs to your company and has not expired or been used.':'Your plan could not be saved. Please retry.')}
  finally{setBusy(false)}
 }
 return <>
  {state?.error&&<p role="alert">Free plan details could not be loaded. <Button variant="secondary" onClick={state.retry}>Retry plan details</Button></p>}
  {section==='plan'&&<section className="card billing-summary" aria-label="Free plan"><div><h2>Free · £0</h2><p>Up to 3 people · 100 chat messages per month · 100 MB of uploads.</p><p>15 AI requests per month, up to 3 per day, shared by your company. AI spending safeguards apply.</p><p>No card required. Tasks, role records and manual handovers included.</p></div><Button variant="secondary" disabled={busy||!state?.data} onClick={()=>void choose('choose_free')}>{busy?'Saving…':state?.data?.plan==='free'?'Continue with Free':'Open workspace'}</Button></section>}
  {section==='plan'&&state?.data?.access_ends_at&&<p role="status">Complimentary {state.data.plan} access until {new Date(state.data.access_ends_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}. Plan allowances and AI spending safeguards apply.</p>}
  {section==='code'&&<form className="card billing-access-code" onSubmit={e=>{e.preventDefault();void choose('redeem')}}><label htmlFor="billing-access-code">Company access code</label><p>Apply a code issued for this company. A code does not cancel an existing Stripe subscription. Discount codes can be entered at Stripe Checkout.</p><div><input id="billing-access-code" value={code} onChange={e=>setCode(e.target.value)} autoComplete="off" maxLength={100} required disabled={busy}/><Button type="submit" disabled={busy||!code.trim()}>Apply code</Button></div></form>}
  {error&&<p role="alert" className="field-error">{error}</p>}{message&&<p role="status">{message}</p>}
 </>
}
