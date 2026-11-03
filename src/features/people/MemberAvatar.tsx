import {useEffect,useState}from 'react'
import {avatarUrl}from './avatar-urls'
import {memberInitials,type Member}from './member'
import './people.css'
export function MemberAvatar({member,size=36}:{member:Member;size?:number}){const [image,setImage]=useState<{path:string;url:string}|null>(null);useEffect(()=>{let live=true;if(member.avatar_path)void avatarUrl(member.avatar_path).then(url=>{if(live)setImage({path:member.avatar_path!,url})});return()=>{live=false}},[member.avatar_path]);const status=member.presence??'offline';return <span className="member-avatar"data-presence={status}style={{width:size,height:size}}aria-label={`${member.full_name} · ${status==='active'?'Active':status==='away'?'Away':'Offline'}`}title={status==='active'?'Active':status==='away'?'Away':'Offline'}>{image?.path===member.avatar_path&&image?.url?<img src={image.url}alt=""onError={()=>setImage(null)}/>:<span aria-hidden="true">{memberInitials(member.full_name)}</span>}<i aria-hidden="true"/></span>}
