import {useEffect,useState} from 'react'
import {useAuth} from '../auth/AuthProvider'
import {supabase} from '../../lib/supabase'
import {Button} from '../../components/ui/Button'
const cache=new Map<string,{url:string;until:number}>()
export function useCompanyLogo(path:string|null|undefined){
 const [value,setValue]=useState<{path:string;url:string}|null>(null)
 useEffect(()=>{let live=true;if(!path)return;const cached=cache.get(path);if(cached&&cached.until>Date.now()){setValue({path,url:cached.url});return}void supabase.storage.from('company-logos').createSignedUrl(path,3600).then(({data,error})=>{if(!live||error||!data)return;cache.set(path,{url:data.signedUrl,until:Date.now()+3000000});setValue({path,url:data.signedUrl})});return()=>{live=false}},[path])
 return value?.path===path?value?.url:undefined
}
export function CompanyLogo(){
 const {company,refresh}=useAuth(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const url=useCompanyLogo(company?.logo_path)
 async function upload(file:File){
  if(!company||busy)return
  setBusy(true);setError('');setMessage('');let uploaded:string|null=null
  try{
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024)throw Error('Choose a PNG, JPG or WebP image up to 2 MB.')
   const bitmap=await createImageBitmap(file)
   if(!bitmap.width||!bitmap.height){bitmap.close();throw Error('This image could not be read.')}
   const scale=Math.min(1,256/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();throw Error('Image upload is unavailable in this browser.')};ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close()
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',.85));if(!blob||blob.type!=='image/webp'||blob.size>262144)throw Error('This image could not be resized. Try a smaller image.')
   const path=company.id+'/'+crypto.randomUUID()+'.webp'
   const result=await supabase.storage.from('company-logos').upload(path,blob,{contentType:'image/webp',upsert:false});if(result.error)throw Error('The logo could not be uploaded. Please retry.');uploaded=path
   const saved=await supabase.from('companies').update({logo_path:path}).eq('id',company.id).select('id').single();if(saved.error||!saved.data)throw Error('The logo could not be saved. Please retry.')
   uploaded=null
   if(company.logo_path)void supabase.storage.from('company-logos').remove([company.logo_path])
   setMessage('Company logo updated.');refresh()
  }catch(reason){if(uploaded)void supabase.storage.from('company-logos').remove([uploaded]);setError(reason instanceof Error?reason.message:'The logo could not be uploaded.')}
  finally{setBusy(false)}
 }
 async function remove(){if(!company?.logo_path||busy)return;setBusy(true);setError('');setMessage('');try{const r=await supabase.from('companies').update({logo_path:null}).eq('id',company.id).select('id').single();if(r.error||!r.data)throw Error();void supabase.storage.from('company-logos').remove([company.logo_path]);setMessage('Company logo removed.');refresh()}catch{setError('The logo could not be removed. Please retry.')}finally{setBusy(false)}}
 return <section className="company-logo-setting"><h3>Company logo</h3><div className="company-logo-row">{url?<img src={url} alt={`${company?.name} logo`} width={64} height={64}/>:<span className="company-logo-placeholder" aria-hidden="true">{company?.name.slice(0,1)}</span>}<div className="field"><label htmlFor="company-logo">Upload logo</label><input id="company-logo" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void upload(file)}}/><small>PNG, JPG or WebP · up to 2 MB</small></div>{company?.logo_path&&<Button variant="secondary" disabled={busy} onClick={()=>void remove()}>Remove logo</Button>}</div>{busy&&<p role="status">Saving logo…</p>}{message&&<p role="status">{message}</p>}{error&&<p className="field-error" role="alert">{error}</p>}</section>
}
