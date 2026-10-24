const fileLimit=10*1024*1024
export function validateCaptureFile(file:Pick<File,'name'|'size'>){if(file.size>fileLimit)throw new Error('This file is over 10 MB. Upload a smaller file or paste the text.');if(!/\.(pdf|docx|txt|vtt|srt)$/i.test(file.name))throw new Error('Choose a PDF, DOCX, TXT, VTT or SRT file.')}
function bounded(value:string){const text=value.trim();if(!text)throw new Error('No text could be read from this file. Paste the text instead.');if(text.length>16000)throw new Error('This file contains more than 16,000 characters. Paste the section you want to capture.');return text}
export async function extractCaptureFile(file:File):Promise<string>{
 validateCaptureFile(file)
 const bytes=new Uint8Array(await file.arrayBuffer()),ext=file.name.split('.').pop()!.toLowerCase()
 if(ext==='pdf'){
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('This is not a valid PDF. Paste the text instead.')
  const pdfjs=await import('pdfjs-dist'),worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc=worker.default
  const task=pdfjs.getDocument({data:bytes,stopAtErrors:true})
  try {const pdf=await task.promise;if(pdf.numPages>100)throw new Error('Use a PDF with up to 100 pages or paste the section you need.');let text='';for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();text+=content.items.map(r=>'str' in r?r.str:'').join(' ')+'\n';if(text.length>16000)throw new Error('This file contains more than 16,000 characters. Paste the section you want to capture.')}if(!text.trim())throw new Error('This PDF appears to be a scan. No text could be read. Paste the text instead.');return bounded(text)}finally{await task.destroy()}
 }
 if(ext==='docx'){
  const {Unzip,UnzipInflate}=await import('fflate')
  const xml=await new Promise<string>((resolve,reject)=>{let found=false,done=false;const chunks:Uint8Array[]=[];let length=0
   const unzip=new Unzip(entry=>{if(entry.name!=='word/document.xml')return;found=true;entry.ondata=(error,data,final)=>{if(done)return;if(error){done=true;reject(new Error('This document could not be read. Paste the text instead.'));return}length+=data.length;if(length>2*1024*1024){done=true;entry.terminate();reject(new Error('This document is too large to read. Paste the section you need.'));return}chunks.push(data);if(final){done=true;const bytes=new Uint8Array(length);let i=0;for(const part of chunks){bytes.set(part,i);i+=part.length}resolve(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}};entry.start()});unzip.register(UnzipInflate);try{unzip.push(bytes,true);if(!found)reject(new Error('This is not a readable DOCX file. Paste the text instead.'))}catch{reject(new Error('This document could not be read. Paste the text instead.'))}})
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('This document could not be read. Paste the text instead.')
  const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw new Error('This document could not be read. Paste the text instead.')
  return bounded(Array.from(doc.getElementsByTagNameNS('*','p')).map(p=>Array.from(p.getElementsByTagNameNS('*','t')).map(n=>n.textContent).join('')).join('\n'))
 }
 let text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
 if(ext==='vtt'||ext==='srt')text=text.replace(/^WEBVTT[^\n]*\n/m,'').split('\n').filter(l=>!/^\s*\d+\s*$/.test(l)&&!l.includes('-->')).join('\n').replace(/<[^>]*>/g,'')
 return bounded(text)
}
