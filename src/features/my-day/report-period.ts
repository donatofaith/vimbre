export type PeriodMode='week'|'month'
export function reportPeriod(day:string,mode:PeriodMode){
 const d=new Date(day+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(d.getTime()))throw Error('Choose a valid date.')
 if(mode==='month')d.setUTCDate(1);else d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7)
 const start=d.toISOString().slice(0,10);if(mode==='month')d.setUTCMonth(d.getUTCMonth()+1);else d.setUTCDate(d.getUTCDate()+7)
 d.setUTCDate(d.getUTCDate()-1);return {start,end:d.toISOString().slice(0,10)}
}
export function movePeriod(day:string,mode:PeriodMode,by:number){const {start}=reportPeriod(day,mode);const d=new Date(start+'T12:00:00Z');if(mode==='month')d.setUTCMonth(d.getUTCMonth()+by);else d.setUTCDate(d.getUTCDate()+7*by);return d.toISOString().slice(0,10)}
export function periodLabel(start:string,end:string){return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).formatRange(new Date(start+'T12:00:00Z'),new Date(end+'T12:00:00Z'))}
