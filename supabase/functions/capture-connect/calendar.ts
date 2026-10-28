import type {Provider,Tokens} from './providers.ts'
export type CalendarSlot={start:string;end:string}
/** Read only the account's own availability. Never return event titles or attendees. */
export async function calendarBusy(provider:Provider,tokens:Tokens,start:string,end:string,request:typeof fetch=fetch):Promise<CalendarSlot[]>{
 if(!tokens.calendar||!['gmail','outlook'].includes(provider))throw Error('calendar_permission')
 if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start)||Date.parse(end)-Date.parse(start)>172800000)throw Error('invalid_input')
 const google=provider==='gmail',base=google?'https://www.googleapis.com/calendar/v3/freeBusy':'https://graph.microsoft.com/v1.0/me/calendarView?'+new URLSearchParams({startDateTime:start,endDateTime:end,'$select':'start,end,showAs,isCancelled','$top':'300'})
 const r=await request(base,{method:google?'POST':'GET',headers:{Authorization:'Bearer '+tokens.access_token,'Content-Type':'application/json',...(google?{}:{Prefer:'outlook.timezone="UTC"'})},...(google?{body:JSON.stringify({timeMin:start,timeMax:end,items:[{id:'primary'}]})}:{}),redirect:'error',signal:AbortSignal.timeout(15000)})
 if(!r.ok)throw Error(r.status===401||r.status===403?'calendar_permission':'calendar_unavailable')
 const text=await r.text();if(text.length>500000)throw Error('calendar_unavailable');const data=JSON.parse(text)
 if(google&&(data.calendars?.primary?.errors||!Array.isArray(data.calendars?.primary?.busy))||!google&&(!Array.isArray(data.value)||data['@odata.nextLink']))throw Error('calendar_unavailable')
 const utc=(value:string)=>/[zZ]$|[+-]\d\d:\d\d$/.test(value)?value:value+'Z'
 const slots:CalendarSlot[]=google?data.calendars.primary.busy:data.value.filter((e:{isCancelled?:boolean;showAs?:string})=>!e.isCancelled&&e.showAs!=='free').map((e:{start:{dateTime:string};end:{dateTime:string}})=>({start:utc(e.start.dateTime),end:utc(e.end.dateTime)}))
 if(slots.length>300||slots.some(s=>!Number.isFinite(Date.parse(s.start))||!Number.isFinite(Date.parse(s.end))||Date.parse(s.end)<=Date.parse(s.start)))throw Error('calendar_unavailable')
 return slots.map(s=>({start:new Date(Math.max(Date.parse(start),Date.parse(s.start))).toISOString(),end:new Date(Math.min(Date.parse(end),Date.parse(s.end))).toISOString()})).filter(s=>s.end>s.start)
}
