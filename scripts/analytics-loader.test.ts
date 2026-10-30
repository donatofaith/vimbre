import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {expect,it} from 'vitest'
const source=readFileSync(new URL('../public/vimbre-analytics.js',import.meta.url),'utf8')
function boot(saved:string|null=null){
 const scripts:Record<string,unknown>[]=[],removed:string[]=[]
 const values=new Map<string,string>();if(saved)values.set('vimbre:analytics-consent:v1',saved)
 const w={dataLayer:[] as unknown[],location:{hostname:'vimbre.com'},localStorage:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,v:string)=>values.set(key,v)},dispatchEvent:()=>{},addEventListener:()=>{}}
 const d={querySelector:()=>null,createElement:()=>({}),head:{appendChild:(script:Record<string,unknown>)=>scripts.push(script)},get cookie(){return '_ga=private; sb-auth-token=secure'},set cookie(value:string){removed.push(value)}}
 runInNewContext(source,{window:w,document:d,Event,Date})
 return {w:w as typeof w & {vimbreAnalytics:{consent:string;choose:(value:string)=>void}},d,scripts,removed}
}
it('does not load Google scripts before consent or after rejection',()=>{
 const b=boot();expect(b.scripts).toEqual([])
 b.w.vimbreAnalytics.choose('declined');expect(b.scripts).toEqual([])
 expect(b.w.dataLayer.some((v:unknown)=>(v as {event?:string}).event==='gtm.js')).toBe(false)
})
it('loads one canonical GTM container after acceptance and never a second direct GA4 tag',()=>{
 const b=boot();b.w.vimbreAnalytics.choose('accepted');b.w.vimbreAnalytics.choose('accepted')
 runInNewContext(source,{window:b.w,document:b.d,Event,Date})
 expect(b.scripts).toHaveLength(1)
 expect(b.scripts[0]).toEqual({async:true,referrerPolicy:'origin',src:'https://www.googletagmanager.com/gtm.js?id=GTM-KTXM87CG'})
 expect(b.w.dataLayer.filter((v:unknown)=>(v as {event?:string}).event==='gtm.js')).toHaveLength(1)
})
it('restores consent and disables GA4 plus its cookies on withdrawal without touching auth cookies',()=>{
 const b=boot('accepted');expect(b.scripts).toHaveLength(1)
 b.w.vimbreAnalytics.choose('declined')
 expect((b.w as unknown as Record<string,unknown>)['ga-disable-G-E599PM5PBE']).toBe(true)
 expect(b.removed.length).toBeGreaterThan(0)
 expect(b.removed.every(cookie=>cookie.startsWith('_ga='))).toBe(true)
})
