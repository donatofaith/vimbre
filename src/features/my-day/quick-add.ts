import {addDays} from './types'
const weekdays=['sun','mon','tue','wed','thu','fri','sat'];
export function parseQuickTask(input:string,today:string){
 let title=input.trim(),due_date=today,due_time='';
 const reminder=title.match(/\bremind(?: me)?\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i);
 if(reminder)title=title.replace(reminder[0],'');
 const when=title.match(/\b(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i);
 if(when){const word=when[0].toLowerCase();let days=word==='tomorrow'?1:word==='next week'?7:0;if(weekdays.includes(word.slice(0,3))){days=(weekdays.indexOf(word.slice(0,3))-new Date(today+'T12:00:00Z').getUTCDay()+7)%7;if(days===0)days=7}due_date=addDays(today,days);title=title.replace(when[0],'');}
 const time=title.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
 if(time){let h=Number(time[1])%12;if(time[3].toLowerCase()==='pm')h+=12;due_time=String(h).padStart(2,'0')+':'+(time[2]??'00');title=title.replace(time[0],'');}
 let reminder_date:string|undefined;if(reminder){const word=reminder[1].toLowerCase();if(word==='today')reminder_date=today;else if(word==='tomorrow')reminder_date=addDays(today,1);else {const back=(new Date(due_date+'T12:00:00Z').getUTCDay()-weekdays.indexOf(word.slice(0,3))+7)%7;reminder_date=addDays(due_date,-back)}}
 return {title:title.replace(/\s+/g,' ').trim(),due_date,due_time,...(reminder_date?{reminder_date}:{})};
}
