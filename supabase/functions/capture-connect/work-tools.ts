import type {Tokens} from './providers.ts'
import type {Filters,SearchPage,SearchRow} from './search.ts'
export type WorkProvider='github'|'notion'|'asana'
export const isWorkProvider=(p:string):p is WorkProvider=>['github','notion','asana'].includes(p)
const bases={github:'https://api.github.com/',notion:'https://api.notion.com/v1/',asana:'https://app.asana.com/api/1.0/'}
const enc=encodeURIComponent
const clean=(v:unknown,n=300)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').slice(0,n)
const numeric=(v:string)=>{if(!/^\d+$/.test(v))throw Error('invalid_source');return v}
const page=(cursor:string)=>{const n=cursor?Number(cursor):1;if(!Number.isInteger(n)||n<1||n>100)throw Error('invalid_source');return n}
const repo=(v:string)=>{if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(v)||v.split('/').some(x=>x==='.'||x==='..'))throw Error('invalid_source');return v.split('/').map(enc).join('/')}
const notionId=(v:string)=>{if(!/^[a-f0-9-]{32,36}$/i.test(v))throw Error('invalid_source');return enc(v)}
export async function workRequest(p:WorkProvider,t:Tokens,path:string,body?:unknown){
 // Paths are constructed here; provider pagination URLs and content URLs are never fetched.
 if(!/^[a-z]/i.test(path)||path.includes('://')||path.includes('..')||path.includes('#'))throw Error('invalid_source')
 const headers:Record<string,string>={Authorization:'Bearer '+t.access_token,Accept:'application/json'}
 if(p==='github'){headers.Accept='application/vnd.github+json';headers['X-GitHub-Api-Version']='2022-11-28'}
 if(p==='notion')headers['Notion-Version']='2025-09-03'
 if(body)headers['Content-Type']='application/json'
 const response=await fetch(bases[p]+path,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)})
 if(!response.ok)throw Error(response.status===401?'reconnect':response.status===429?'provider_busy':'provider_unavailable')
 const reader=response.body?.getReader();if(!reader)throw Error('provider_unavailable');let size=0,text='';const decoder=new TextDecoder()
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000)throw Error('source_too_large');text+=decoder.decode(value,{stream:true})}text+=decoder.decode()}finally{await reader.cancel().catch(()=>{})}
 return JSON.parse(text)
}
const row=(id:string,title:string,container='',kind:'item'|'container'='item'):SearchRow=>({id,reference:container?container+':'+id:id,container,title:clean(title),sender:'',preview:'',date:'',url:'',kind})
const rich=(v:any[])=>Array.isArray(v)?v.map(x=>x.plain_text??x.text?.content??'').join(''):''
const notionTitle=(r:any)=>rich(Object.values(r.properties||{}).flatMap((v:any)=>v.type==='title'?v.title:[]))||'Untitled page'
export async function workPlaces(p:WorkProvider,t:Tokens,parent:string,cursor:string):Promise<SearchPage>{
 if(p==='notion')return {rows:[],next:null}
 if(p==='github'){
  const n=page(cursor),d=await workRequest(p,t,'user/repos?'+new URLSearchParams({per_page:'20',page:String(n),sort:'updated'}))
  return {rows:d.map((r:any)=>row(r.full_name,r.full_name,'','container')),next:d.length===20?String(n+1):null}
 }
 const params=new URLSearchParams({limit:'20',opt_fields:'gid,name',...(cursor?{offset:cursor}:{})}),d=await workRequest(p,t,parent?`workspaces/${numeric(parent)}/projects?${params}&archived=false`:'workspaces?'+params)
 return {rows:(d.data||[]).map((r:any)=>row(r.gid,r.name,parent,'container')),next:d.next_page?.offset||null}
}
export async function workSearch(p:WorkProvider,t:Tokens,f:Filters,cursor:string):Promise<SearchPage>{
 let rows:SearchRow[]=[],next:string|null=null
 if(p==='notion'){
  const d=await workRequest(p,t,'search',{query:f.query,page_size:20,filter:{property:'object',value:'page'},sort:{direction:'descending',timestamp:'last_edited_time'},...(cursor?{start_cursor:cursor}:{})})
  rows=(d.results||[]).filter((r:any)=>!r.archived&&!r.in_trash).map((r:any)=>({...row(r.id,notionTitle(r)),date:r.last_edited_time||'',url:r.url||''}));next=d.has_more?d.next_cursor:null
 }else if(p==='github'){
  if(!f.place)return {rows:[],next:null};const n=page(cursor),d=await workRequest(p,t,`repos/${repo(f.place)}/issues?`+new URLSearchParams({state:'all',sort:'updated',direction:'desc',per_page:'20',page:String(n),...(f.after?{since:f.after+'T00:00:00Z'}:{})}))
  rows=d.map((r:any)=>({...row(String(r.number),r.title,f.place),sender:clean(r.user?.login),preview:clean(r.body,240),date:r.updated_at||'',url:r.html_url||''}));next=d.length===20?String(n+1):null
 }else{
  if(!f.place)return {rows:[],next:null}
  const params=new URLSearchParams({limit:'20',opt_fields:'gid,name,modified_at,assignee.name,permalink_url',...(cursor?{offset:cursor}:{})}),d=await workRequest(p,t,`projects/${numeric(f.place)}/tasks?`+params)
  rows=(d.data||[]).map((r:any)=>({...row(r.gid,r.name,f.place),sender:clean(r.assignee?.name),date:r.modified_at||'',url:r.permalink_url||''}));next=d.next_page?.offset||null
 }
 // GitHub and Asana filter within each provider page; retain next cursor even for an empty page.
 rows=rows.filter(r=>(p==='notion'||!f.query||(r.title+' '+r.preview).toLowerCase().includes(f.query.toLowerCase()))&&(!f.after||r.date>=f.after)&&(!f.before||r.date<f.before))
 return {rows,next}
}
export async function workRead(p:WorkProvider,t:Tokens,source:string,container:string){
 let title='',text='',url='',date=''
 if(p==='github'){
  const path=`repos/${repo(container)}/issues/${numeric(source)}`,d=await workRequest(p,t,path),comments=await workRequest(p,t,path+'/comments?per_page=30')
  if(comments.length>=30)throw Error('source_too_large')
  title=d.title;url=d.html_url;date=d.updated_at;text=[title,d.body,...comments.map((r:any)=>r.body)].filter(Boolean).join('\n\n')
 }else if(p==='asana'){
  const id=numeric(source),d=(await workRequest(p,t,`tasks/${id}?opt_fields=name,notes,modified_at,permalink_url`)).data,comments=await workRequest(p,t,`tasks/${id}/stories?limit=30&opt_fields=text,type`)
  if(comments.next_page)throw Error('source_too_large')
  title=d.name;url=d.permalink_url;date=d.modified_at;text=[title,d.notes,...(comments.data||[]).filter((r:any)=>r.type==='comment').map((r:any)=>r.text)].filter(Boolean).join('\n\n')
 }else{
  const id=notionId(source),d=await workRequest(p,t,'pages/'+id);title=notionTitle(d);date=d.last_edited_time;url=d.url
  let count=0,requests=0;const parts:string[]=[]
  async function blocks(block:string,depth=0){
   if(depth>5||++requests>15)throw Error('source_too_large')
   const children=await workRequest('notion',t,'blocks/'+notionId(block)+'/children?page_size=100');if(children.has_more)throw Error('source_too_large')
   for(const b of children.results||[]){if(++count>200)throw Error('source_too_large');if(b.type==='child_page'||b.type==='child_database')continue;const v=b[b.type]||{};const content=rich(v.rich_text||v.caption||[]);if(content)parts.push(content);if(b.type==='table_row')parts.push((v.cells||[]).map(rich).join(' | '));if(b.has_children)await blocks(b.id,depth+1)}
  }
  await blocks(source);text=[title,...parts].join('\n\n')
 }
 if(!text.trim())throw Error('source_empty');if(text.length>16000)throw Error('source_too_large')
 return {title:clean(title,200),text,date:date?.slice(0,10)||new Date().toISOString().slice(0,10),url,source_type:'note'}
}
