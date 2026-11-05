import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {expect,it} from 'vitest'
const source=readFileSync(new URL('../public/vimbre-analytics.js',import.meta.url),'utf8')
function boot(saved:string|null=null, marketing:string|null=null){
 const scripts:Record<string,unknown>[]=[],removed:string[]=[]
 const values=new Map<string,string>();if(saved)values.set('vimbre:analytics-consent:v1',saved);if(marketing)values.set('vimbre:marketing-consent:v1',marketing)
 const listeners=new Map<string,()=>void>()
 const w={dataLayer:[] as unknown[],location:{hostname:'vimbre.com'},localStorage:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,v:string)=>values.set(key,v)},dispatchEvent:(e:Event)=>listeners.get(e.type)?.(),addEventListener:(name:string,fn:()=>void)=>listeners.set(name,fn)}
 const d={querySelector:()=>null,createElement:()=>({}),head:{appendChild:(script:Record<string,unknown>)=>scripts.push(script)},get cookie(){return '_ga=private; sb-auth-token=secure'},set cookie(value:string){removed.push(value)}}
 runInNewContext(source,{window:w,document:d,Event,Date})
 return {w:w as typeof w & {vimbreAnalytics:{consent:string;choose:(value:string)=>void}},d,scripts,removed}
}
it('does not load Google scripts before consent or after rejection',()=>{
 const b=boot();expect(b.scripts).toEqual([])
 b.w.vimbreAnalytics.choose('declined');expect(b.scripts).toEqual([])
 expect(b.w.dataLayer.some((v:unknown)=>(v as {event?:string}).event==='gtm.js')).toBe(false)
})
it('loads one shared Google tag after acceptance and configures both supplied destinations',()=>{
 const b=boot(null,'accepted');b.w.vimbreAnalytics.choose('accepted');b.w.vimbreAnalytics.choose('accepted')
 runInNewContext(source,{window:b.w,document:b.d,Event,Date})
 expect(b.scripts).toHaveLength(1)
 expect(b.scripts[0]).toEqual({async:true,referrerPolicy:'origin',src:'https://www.googletagmanager.com/gtag/js?id=AW-18551891096'})
 const commands=b.w.dataLayer.map(v=>Array.from(v as ArrayLike<unknown>))
 expect(commands.filter(v=>v[0]==='config').map(v=>v[1])).toEqual(['AW-18551891096','G-E599PM5PBE'])
})
it('restores consent and disables GA4 plus its cookies on withdrawal without touching auth cookies',()=>{
 const b=boot('accepted');expect(b.scripts).toHaveLength(1)
 b.w.vimbreAnalytics.choose('declined')
 expect((b.w as unknown as Record<string,unknown>)['ga-disable-G-E599PM5PBE']).toBe(true)
 expect(b.removed.length).toBeGreaterThan(0)
 expect(b.removed.every(cookie=>cookie.startsWith('_ga='))).toBe(true)
})

it('queues the exact GBP conversion only with consent',()=>{
 const b=boot();const report=(b.w as unknown as {gtag_report_conversion:()=>boolean}).gtag_report_conversion
 report();expect(b.w.dataLayer.map(v=>Array.from(v as ArrayLike<unknown>)).filter(v=>v[1]==='conversion')).toHaveLength(0)
 b.w.vimbreAnalytics.choose('accepted');report()
 expect(b.w.dataLayer.map(v=>Array.from(v as ArrayLike<unknown>)).filter(v=>v[1]==='conversion')).toHaveLength(0)
 b.w.localStorage.setItem('vimbre:marketing-consent:v1','accepted');b.w.dispatchEvent(new Event('vimbre:marketing-consent'));report()
 const conversion=b.w.dataLayer.map(v=>Array.from(v as ArrayLike<unknown>)).find(v=>v[1]==='conversion')
 expect(conversion?.[2]).toMatchObject({send_to:'AW-18551891096/l-20CPe7zLAdEJjJnY5F',value:1,currency:'GBP'})
})
