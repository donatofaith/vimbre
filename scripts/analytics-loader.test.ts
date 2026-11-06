import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {expect,it} from 'vitest'
const source=readFileSync(new URL('../public/vimbre-analytics.js',import.meta.url),'utf8')
function boot(saved:string|null=null, marketing:string|null=null, pathname='/pricing', hash=''){
 const scripts:Record<string,unknown>[]=[],removed:string[]=[]
 const values=new Map<string,string>();if(saved)values.set('vimbre:analytics-consent:v1',saved);if(marketing)values.set('vimbre:marketing-consent:v1',marketing)
 const listeners=new Map<string,()=>void>()
 const w={dataLayer:[] as unknown[],location:{hostname:'vimbre.com',pathname,hash},localStorage:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,v:string)=>values.set(key,v)},dispatchEvent:(e:Event)=>listeners.get(e.type)?.(),addEventListener:(name:string,fn:()=>void)=>listeners.set(name,fn)}
 const d={querySelector:()=>null,createElement:()=>({}),head:{appendChild:(script:Record<string,unknown>)=>scripts.push(script)},get cookie(){return '_ga=private; sb-auth-token=secure'},set cookie(value:string){removed.push(value)}}
 runInNewContext(source,{window:w,document:d,Event,Date})
 return {w:w as typeof w & {vimbreAnalytics:{consent:string;choose:(value:string)=>void}},d,scripts,removed}
}
it('does not load Google scripts before consent or after rejection',()=>{
 const b=boot();expect(b.scripts).toEqual([])
 b.w.vimbreAnalytics.choose('declined');expect(b.scripts).toEqual([])
 expect(b.w.dataLayer.some((v:unknown)=>(v as {event?:string}).event==='gtm.js')).toBe(false)
})
it('makes the Ads tag detectable on the homepage with denied consent defaults',()=>{
 const b=boot(null,null,'/')
 expect(b.scripts.map(script=>script.src)).toEqual(['https://www.googletagmanager.com/gtag/js?id=AW-18551891096'])
 const commands=b.w.dataLayer.map(v=>Array.from(v as ArrayLike<unknown>))
 const consent=commands.findIndex(v=>v[0]==='consent'&&v[1]==='default')
 const config=commands.findIndex(v=>v[0]==='config')
 expect(consent).toBeGreaterThanOrEqual(0)
 expect(consent).toBeLessThan(config)
 expect(commands[consent][2]).toMatchObject({analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'})
 expect(commands[config][1]).toBe('AW-18551891096')
 b.w.localStorage.setItem('vimbre:marketing-consent:v1','accepted')
 b.w.dispatchEvent(new Event('vimbre:marketing-consent'))
 expect(b.scripts.map(script=>script.src)).toEqual([
  'https://www.googletagmanager.com/gtag/js?id=AW-18551891096',
  'https://www.googletagmanager.com/gtm.js?id=GTM-KTXM87CG',
 ])
 expect(b.w.dataLayer.map(v=>Array.from(v as ArrayLike<unknown>)).filter(v=>v[0]==='config'&&v[1]==='AW-18551891096')).toHaveLength(1)
})
it('keeps the early Ads tag off authenticated routes and fragment URLs',()=>{
 expect(boot(null,null,'/app/chat').scripts).toEqual([])
 expect(boot(null,null,'/','#access_token=fixture').scripts).toEqual([])
})
it('loads the shared Google tag and Tag Manager once after marketing consent',()=>{
 const b=boot(null,'accepted');b.w.vimbreAnalytics.choose('accepted');b.w.vimbreAnalytics.choose('accepted')
 runInNewContext(source,{window:b.w,document:b.d,Event,Date})
 expect(b.scripts).toHaveLength(2)
 expect(b.scripts[1]).toEqual({async:true,referrerPolicy:'origin',src:'https://www.googletagmanager.com/gtm.js?id=GTM-KTXM87CG'})
 expect(b.w.dataLayer.filter(v=>(v as {event?:string}).event==='gtm.js')).toHaveLength(1)
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
 expect(b.scripts.map(script=>script.src)).toEqual(['https://www.googletagmanager.com/gtag/js?id=G-E599PM5PBE'])
 expect(b.w.dataLayer.map(v=>Array.from(v as ArrayLike<unknown>)).filter(v=>v[1]==='conversion')).toHaveLength(0)
 b.w.localStorage.setItem('vimbre:marketing-consent:v1','accepted');b.w.dispatchEvent(new Event('vimbre:marketing-consent'));report()
 const conversion=b.w.dataLayer.map(v=>Array.from(v as ArrayLike<unknown>)).find(v=>v[1]==='conversion')
 expect(conversion?.[2]).toMatchObject({send_to:'AW-18551891096/l-20CPe7zLAdEJjJnY5F',value:1,currency:'GBP'})
})
