import {typeNames} from './model'
export const steps=['Details','Include','Draft','Send'] as const
export function addDays(day:string,days:number){const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)}
export function nextWorkingDay(day:string){let next=addDays(day,1);while([0,6].includes(new Date(next+'T12:00:00Z').getUTCDay()))next=addDays(next,1);return next}
export function readableDay(day:string){return day?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z')):''}
export function handoverTitle(type:keyof typeof typeNames,start:string,end:string){return `${typeNames[type]}${start?', '+readableDay(start):''}${end&&end!==start?' to '+readableDay(end):''}`}
export function workingDays(start:string,end:string){if(!start||!end||end<start)return 0;let count=0;for(let day=start;day<end;day=addDays(day,1)){if(![0,6].includes(new Date(day+'T12:00:00Z').getUTCDay()))count++;if(count>3660)break}return count}
export function dateErrors(start:string,end:string,unknown:boolean){const errors:Record<string,string>={};if(!start)errors.starts_on='Choose a start date.';if(!unknown&&!end)errors.ends_on='Choose a return date or select that you do not know it yet.';if(start&&end&&end<start)errors.ends_on='Return date must be on or after the start date.';return errors}
export function dueDuring(due:string|null|undefined,start:string,end:string,unknown:boolean){return Boolean(due&&due>=start&&(unknown||end&&due<=end))}
