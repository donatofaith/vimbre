import {afterEach, beforeEach, expect, it, vi} from 'vitest'
function storage() {const map = new Map<string,string>(); return {getItem:(key:string)=>map.get(key)??null, setItem:(key:string,value:string)=>map.set(key,value), removeItem:(key:string)=>map.delete(key)}}
let analytics: typeof import('./analytics')
let browser: {dataLayer: unknown[];localStorage: ReturnType<typeof storage>;sessionStorage: ReturnType<typeof storage>}
beforeEach(async()=>{
  vi.resetModules()
  browser={dataLayer:[],localStorage:storage(),sessionStorage:storage()}
  browser.localStorage.setItem('vimbre:analytics-consent:v1','accepted')
  vi.stubGlobal('window',browser)
  analytics=await import('./analytics')
})
afterEach(()=>vi.unstubAllGlobals())
it('drops events without consent and does not replay them when consent is later granted',()=>{
  browser.localStorage.removeItem('vimbre:analytics-consent:v1')
  analytics.trackTaskCreated('private-id','manual')
  expect(browser.dataLayer).toEqual([])
  expect(browser.sessionStorage.getItem('vimbre:analytics-seen:v1')).toBeNull()
  browser.localStorage.setItem('vimbre:analytics-consent:v1','accepted')
  analytics.trackTaskCreated('new-id','ai')
  expect(browser.dataLayer).toEqual([{event:'action_created',success:true,source_type:'ai',action_type:'task',action_count:1}])
})
it('removes unexpected PII/content fields at runtime',()=>{
  const params={source_type:'manual' as const,action_type:'task' as const,action_count:1,email:'person@example.com',name:'Private name',document:'Secret contract',message:'Confidential conversation',id:'private-id'}
  analytics.trackEvent('action_created',params,'opaque-key')
  expect(browser.dataLayer).toEqual([{event:'action_created',success:true,source_type:'manual',action_type:'task',action_count:1}])
})
it('rejects arbitrary values in category parameters',()=>{
  analytics.trackEvent('context_generated',{source_type:'text',context_type:'Customer secret' as never},'a')
  analytics.trackEvent('integration_connected',{source_type:'person@example.com' as never},'b')
  analytics.trackEvent('action_created',{source_type:'manual',action_type:'task',action_count:0},'c')
  expect(browser.dataLayer).toEqual([])
})
it('deduplicates the same successful operation, including after a module reload',async()=>{
  analytics.trackTaskCompleted('task-a','plan')
  analytics.trackTaskCompleted('task-a','cover')
  vi.resetModules();const reloaded=await import('./analytics')
  reloaded.trackTaskCompleted('task-a','manual')
  expect(browser.dataLayer).toHaveLength(1)
})
it('queues safely when GTM is unavailable and survives blocked browser storage',()=>{
  vi.stubGlobal('window',{dataLayer:undefined,vimbreAnalytics:{consent:'accepted'},get sessionStorage(){throw Error('blocked')}})
  expect(()=>analytics.trackTaskCreated('task-safe','manual')).not.toThrow()
  expect(window.dataLayer).toHaveLength(1)
  analytics.trackTaskCreated('task-safe','manual')
  expect(window.dataLayer).toHaveLength(1)
})
it('does not throw if a third party replaces or breaks the data layer',()=>{
  vi.stubGlobal('window',{vimbreAnalytics:{consent:'accepted'},dataLayer:{push(){throw Error('blocked')}}})
  expect(()=>analytics.trackTaskCreated('safe','manual')).not.toThrow()
})
it('is safe during server rendering',()=>{
  vi.stubGlobal('window',undefined)
  expect(()=>analytics.trackTaskCreated('safe','manual')).not.toThrow()
})
it('does not count obfuscated existing-email signup responses or absent login sessions',()=>{
  analytics.trackAccountCreated({id:'existing-id',identities:[]})
  analytics.trackAccountCreated(null);analytics.trackLogin(null)
  expect(browser.dataLayer).toEqual([])
  analytics.trackAccountCreated({id:'new-user',identities:[{provider:'email'}]})
  analytics.trackAccountCreated({id:'new-user',identities:[{provider:'email'}]})
  analytics.trackLogin({user:{id:'new-user'},expires_at:123})
  expect(browser.dataLayer).toEqual([{event:'sign_up',method:'email'},{event:'login',success:true,method:'password'}])
})
it('reports only the verified integration type after callback success, without OAuth state',()=>{
  const state='a'.repeat(64)
  analytics.rememberIntegrationStart(state,'gmail')
  analytics.trackConnectedIntegration(state)
  analytics.trackConnectedIntegration(state)
  expect(browser.dataLayer).toEqual([{event:'integration_connected',success:true,source_type:'gmail'}])
  expect(browser.sessionStorage.getItem('vimbre:tool-connect-analytics')).toBeNull()
})
it('ignores integration callback states that do not match the started flow',()=>{
  analytics.rememberIntegrationStart('a'.repeat(64),'gmail')
  analytics.trackConnectedIntegration('b'.repeat(64))
  expect(browser.dataLayer).toEqual([])
})
it('redacts private paths, titles, query strings and callback tokens from SPA pageviews',()=>{
  analytics.trackPageView('/app/chat?conversation=private&email=person@example.com#secret')
  analytics.trackPageView('/app/chat?conversation=another')
  analytics.trackPageView('/app/handovers/private-record?token=secret')
  analytics.trackPageView('/person@example.com')
  expect(browser.dataLayer).toEqual([
    {event:'page_view',page_path:'/app/chat',page_location:'https://vimbre.com/app/chat',page_title:'Vimbre /app/chat',page_referrer:''},
    {event:'page_view',page_path:'/app/handovers',page_location:'https://vimbre.com/app/handovers',page_title:'Vimbre /app/handovers',page_referrer:''},
    {event:'page_view',page_path:'/other',page_location:'https://vimbre.com/other',page_title:'Vimbre /other',page_referrer:''},
  ])
})

it('reports the Ads conversion once for successful new signup, never an existing account',()=>{
 const conversion=vi.fn();Object.assign(browser,{gtag_report_conversion:conversion})
 analytics.trackAccountCreated({id:'new-user',identities:[{}]})
 analytics.trackAccountCreated({id:'new-user',identities:[{}]})
 analytics.trackAccountCreated({id:'existing',identities:[]})
 expect(conversion).toHaveBeenCalledTimes(1)
})

it('pushes the exact signup object to dataLayer even when gtag exists',()=>{const gtag=vi.fn();Object.assign(browser,{gtag});analytics.trackAccountCreated({id:'new-email-account',identities:[{}]});expect(browser.dataLayer).toEqual([{event:'sign_up',method:'email'}]);expect(gtag).not.toHaveBeenCalled()})
it('keeps signup deduplication after a new browser session',async()=>{analytics.trackAccountCreated({id:'once',identities:[{}]});browser.sessionStorage=storage();vi.resetModules();const fresh=await import('./analytics');fresh.trackAccountCreated({id:'once',identities:[{}]});expect(browser.dataLayer).toEqual([{event:'sign_up',method:'email'}])})
