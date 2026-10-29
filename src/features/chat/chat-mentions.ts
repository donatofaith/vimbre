import type {ChatPerson} from './chat-types'

export function mentionAt(text:string,caret:number){
 const match=/(?:^|\s)@([^@\n]{0,100})$/.exec(text.slice(0,caret))
 return match?{start:caret-match[1].length-1,end:caret,query:match[1]}:null
}
export function insertMention(text:string,caret:number,name:string){
 const match=mentionAt(text,caret)
 const prefix=match?text.slice(0,match.start):text.slice(0,caret)+(caret&& !/\s$/.test(text.slice(0,caret))?' ':'')
 const next=prefix+'@'+name+' '
 return {text:next+text.slice(match?.end??caret),caret:next.length}
}
export function bodyMentions(text:string,people:ChatPerson[],self?:string){
 return people.filter(p=>p.id!==self&&p.active!==false).filter(p=>{
  // Duplicate display names require an explicit picker selection, handled by the caller.
  if(people.filter(other=>other.active!==false&&other.full_name.toLowerCase()===p.full_name.toLowerCase()).length!==1)return false
  return hasMention(text,p.full_name)
 }).map(p=>p.id)
}
export function hasMention(text:string,name:string){
 const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
 return new RegExp('(?:^|\\s)@'+escaped+'(?=$|[\\s.,!?;:])','iu').test(text)
}
