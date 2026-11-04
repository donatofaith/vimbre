import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase'
import {fileSize} from './chat-files'
export type ChatFile={id:string;name:string;path:string;size:number;mime:string}
export function ChatAttachment({file}:{file:ChatFile}){
 const [preview,setPreview]=useState<{path:string;url:string}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{let live=true;if(file.mime.startsWith('image/'))void supabase.storage.from('chat-attachments').createSignedUrl(file.path,300).then(({data})=>{if(live&&data)setPreview({path:file.path,url:data.signedUrl})});return()=>{live=false}},[file.path,file.mime])
 async function download(){setBusy(true);setError('');try{const result=await supabase.storage.from('chat-attachments').download(file.path);if(result.error||!result.data)throw Error('This file could not be downloaded. Try again.');const url=URL.createObjectURL(result.data),link=document.createElement('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div className="chat-attachment"><button type="button"disabled={busy}onClick={()=>void download()}>{preview?.path===file.path&&<img src={preview.url}alt={file.name}loading="lazy"/>}<span>{file.name}<small>{fileSize(file.size)} · {busy?'Downloading…':'Download'}</small></span></button>{error&&<p role="alert">{error}</p>}</div>
}
