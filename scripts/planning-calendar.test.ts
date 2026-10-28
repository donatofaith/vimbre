import {it,expect,vi} from 'vitest'
import {calendarBusy} from '../supabase/functions/capture-connect/calendar'
const start='2026-10-27T08:00:00Z',end='2026-10-27T18:00:00Z',token={access_token:'fixture',calendar:true}
it('reads only Google primary calendar availability and returns no meeting details',async()=>{
 const request=vi.fn(async(_url:RequestInfo|URL,_init?:RequestInit)=>Response.json({calendars:{primary:{busy:[{start:'2026-10-27T09:00:00Z',end:'2026-10-27T10:00:00Z',summary:'Never expose'}]}}}))
 expect(await calendarBusy('gmail',token,start,end,request)).toEqual([{start:'2026-10-27T09:00:00.000Z',end:'2026-10-27T10:00:00.000Z'}]);expect(String(request.mock.calls[0]?.[0])).toBe('https://www.googleapis.com/calendar/v3/freeBusy');expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({timeMin:start,timeMax:end,items:[{id:'primary'}]})
})
it('excludes cancelled/free Outlook events and interprets provider UTC times',async()=>{
 const request=vi.fn(async()=>Response.json({value:[{showAs:'busy',start:{dateTime:'2026-10-27T09:00:00'},end:{dateTime:'2026-10-27T09:30:00'}},{showAs:'free'},{isCancelled:true}]}))
 expect(await calendarBusy('outlook',token,start,end,request)).toEqual([{start:'2026-10-27T09:00:00.000Z',end:'2026-10-27T09:30:00.000Z'}])
})
it('never calls a provider without separate calendar consent',async()=>{const request=vi.fn();await expect(calendarBusy('gmail',{access_token:'fixture'},start,end,request)).rejects.toThrow('calendar_permission');expect(request).not.toHaveBeenCalled()})
it('fails closed on missing permissions, partial pages and invalid busy intervals',async()=>{
 await expect(calendarBusy('gmail',token,start,end,async()=>new Response('',{status:403}))).rejects.toThrow('calendar_permission')
 await expect(calendarBusy('outlook',token,start,end,async()=>Response.json({value:[],'@odata.nextLink':'untrusted'}))).rejects.toThrow('calendar_unavailable')
 await expect(calendarBusy('gmail',token,start,end,async()=>Response.json({calendars:{primary:{busy:[{start:'bad',end:'bad'}]}}}))).rejects.toThrow('calendar_unavailable')
})
