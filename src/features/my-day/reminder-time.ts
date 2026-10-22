import { addDays,dateInZone } from './types'
export function morningTomorrow(zone:string,now=new Date()){
 const date=addDays(dateInZone(zone,now),1),target=Date.parse(`${date}T09:00:00Z`);let guess=target
 for(let i=0;i<4;i++){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess));const v=(n:string)=>parts.find(p=>p.type===n)!.value;const represented=Date.parse(`${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}:${v('second')}Z`);const next=guess+target-represented;if(next===guess)break;guess=next}
 return new Date(guess).toISOString()
}
