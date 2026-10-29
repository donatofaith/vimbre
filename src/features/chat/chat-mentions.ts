import type {ChatPerson} from './chat-types'

export function mentionAt(text:string,caret:number,completedNames:string[]=[]){
 const match=/(?:^|\s)@([^@\n]{0,100})$/.exec(text.slice(0,caret))
 // A completed name ends at its following space/punctuation. Later message text
 // must not reopen the name search, while a new @ still starts another mention.
 if(match&&completedNames.some(name=>match[1].toLocaleLowerCase().startsWith(name.toLocaleLowerCase())&&/^[\s.,!?;:]/.test(match[1].slice(name.length))))return null
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

export function mentionParts(text:string,names:{id:string;name:string}[]){
 const parts:{text:string;id?:string}[]=[]
 const choices=names.filter(p=>p.name).sort((a,b)=>b.name.length-a.name.length)
 let start=0,index=0
 while(index<text.length){
  const person=text[index]==='@'&&(index===0||/\s/.test(text[index-1]))?choices.find(p=>text.slice(index+1,index+1+p.name.length).toLocaleLowerCase()===p.name.toLocaleLowerCase()&&(index+1+p.name.length===text.length||/[\s.,!?;:]/.test(text[index+1+p.name.length]))):undefined
  if(!person){index++;continue}
  if(index>start)parts.push({text:text.slice(start,index)})
  const end=index+person.name.length+1
  parts.push({text:text.slice(index,end),id:person.id});index=end;start=end
 }
 if(start<text.length)parts.push({text:text.slice(start)})
 return parts
}
