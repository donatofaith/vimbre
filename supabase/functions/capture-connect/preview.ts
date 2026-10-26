import {api,mailText,read} from './providers.ts'
import type {Provider,Tokens} from './providers.ts'
import type {SearchRow} from './search.ts'
import {prepareCaptureText} from '../_shared/capture-text.ts'
const plain=(v:unknown)=>String(v??'').replace(/<[^>]*>/g,' ').replaceAll('&nbsp;',' ').replaceAll('&amp;','&')
const enc=encodeURIComponent
export async function preview(p:Provider,t:Tokens,row:SearchRow){
 let text='',source=row.id
 if(p==='gmail'){
  const d=await api(p,t,`threads/${enc(row.id)}?format=full`)
  if((d.messages||[]).length>30)throw Error('source_too_large');const messages=(d.messages||[]);source=messages.at(-1)?.id||row.id
  // Strip quoted copies per message, while retaining each selected thread participant's contribution.
  text=messages.map((m:any)=>prepareCaptureText(mailText(m.payload||{}))).filter(Boolean).join('\n\n')
 }else if(p==='outlook'){
  const filter="conversationId eq '"+row.reference.replaceAll("'","''")+"'"
  const d=await api(p,t,'me/messages?'+new URLSearchParams({'$filter':filter,'$select':'id,body,receivedDateTime','$top':'30'}))
  if(d['@odata.nextLink'])throw Error('source_too_large');const messages=(d.value||[]).sort((a:any,b:any)=>String(a.receivedDateTime).localeCompare(String(b.receivedDateTime)));source=messages.at(-1)?.id||row.id
  text=messages.map((m:any)=>prepareCaptureText(m.body?.contentType==='html'?plain(m.body.content):String(m.body?.content||''))).filter(Boolean).join('\n\n')
 }else if(p==='drive'&&row.mime==='application/vnd.google-apps.spreadsheet')text=await api(p,t,`files/${enc(row.id)}/export?mimeType=text/csv`,true)
 else if(p==='teams'&&row.container.startsWith('channel:')){
  const [,rawTeam,rawChannel]=row.container.split(':');const team=decodeURIComponent(rawTeam||''),channel=decodeURIComponent(rawChannel||'');if(!team||!channel)throw Error('invalid_source')
  const path=`teams/${enc(team)}/channels/${enc(channel)}/messages/${enc(row.id)}`,d=await api(p,t,path),replies=await api(p,t,path+'/replies?$top=30');text=[d,...(replies.value||[])].map((m:any)=>plain(m.body?.content)).join('\n\n')
 }else {const value=await read(p,t,row.id,row.container);text=value.text}
 if(!text.trim())throw Error('source_empty')
 if(new TextEncoder().encode(text).length>50000)throw Error('source_too_large')
 return {title:row.title.slice(0,200),text:prepareCaptureText(text),date:row.date?.slice(0,10)||new Date().toISOString().slice(0,10),sender:row.sender,source_type:p==='gmail'||p==='outlook'?'email':'note',reference:row.reference,source,container:row.container,url:row.url,provider:p}
}
